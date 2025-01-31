var ws
var reconnectAttempts = 0

async function handleGlobalSignaling(type, from, data) {
    const handlers = {
        "conference-started": async () => {
            if (conferenceStarted) return
            onConferenceStart()
        },
        "conference-ended": async () => {
            if (!WebRTCStarted) return
            onConferenceEnd()
        },
        "new-participant": async () => {
            if (peers[from]) disconnectUser(from);
            await connectUser(from, data.default_media, data.is_listener);
        },
        "global-message": async () => {
            await onMessageReceive(data);
        },
        "start-screenshare": async () => {
            if (!isSharingScreen) {
                await onWebsocketScreenshare(data.mediaId, from);
            }
        },
        "stop-screenshare": async () => {
            await onWebsockerStopScreenshare(from);
        },
        "toggle-microphone": async () => {
            const peer = peers[from];
            if (peer && !peer.isListener && !peer.failed && peer.connected) {
                peer.micEnabled = data.status;
                updateMicrophoneVisual(from, data.status);
            }
        },
        "disconnect": async () => {
            if (!peers[from]) {
                return
            }
            disconnectUser(from)
        },
        "start-presentation": async () => {
            if (!data.token) {
                log("Ignored start-presentation request, no token given.", "warn", false)
                return
            }

            currentPage = -1
            presentationToken = data.token
            presentationRunning = true

            presentingUser = from

            loadPresentation()
            setPresentationPage(data.page || 0)

            startInterpolation()
        },
        "page-switch": async () => {
            if (!presentationRunning) {
                return
            }

            if (!data.page) {
                log("Ignored page-switch request, no page specified.", "warn", false)
            }
            
            setPresentationPage(data.page)
        },
        "stop-presentation": async () => {
            if (!presentationRunning) {
                return
            }

            currentPage = -1
            presentationToken = null
            presentationRunning = false

            presentingUser = null

            stopInterpolation()
            unloadPresentation()
        },
        "update-cursor": async () => {
            if (!presentationRunning || presentingSelf) {
                return
            }

            if (from !== presentingUser) {
                return
            }

            updateInterpolation(data.x, data.y)
        }
    }

    if (handlers[type]) {
        if (from == userId) {
            return
        }

        await handlers[type]()
    } else {
        log(`Unresolved signaling type: ${type}`, "warn")
    }
}

async function handlePersonalSignaling(type, from, data) {
    const handlers = {
        offer: async () => {
            await handleOffer(data.offer, from, data.is_listener, data.default_media_id);
        },
        answer: async () => {
            await peers[from]?.setRemoteDescription(new RTCSessionDescription(data.answer));
        },
        candidate: async () => {
            await addIceCandidate(from, data.candidate);
        },
        webcam_start: async () => {
            const track = await waitForTrack(peers[from], data.id);
            if (track) {
                addVideo(from, new MediaStream([track]));
            } else {
                log(`Track ID not found: ${data.id}`, "warn");
            }
        },
        webcam_stop: async () => {
            removeStream("video", from);
        },
        "add-cohost": async () => {
            loadAsCoHost();
        },
        "remove-cohost": async () => {
            await unloadCoHost();
        },
    }

    if (handlers[type]) {
        await handlers[type]()
    } else {
        await handleGlobalSignaling(type, from, data)
    }
}

async function onWebSocketRecieve(event) {
    const data = JSON.parse(event.data)
    var { type, from, to } = data;
    
    if (!WebRTCStarted && type !== "conference-started") return

    from = Number(from)
    to = Number(to)

    const isGlobal = !to;
    const isTargeted = to === userId;

    if (isGlobal) {
        log(`Got global websocket response - ${type}`)
    } else if (isTargeted) {
        log(`Got personal websocket response - ${type}`)
    } else {
        return
    }

    if (isTargeted) {
        await handlePersonalSignaling(type, from, data)
        return
    }

    if (isGlobal) {
        await handleGlobalSignaling(type, from, data)
        return
    }
}

function onWebsocketOpen(event) {
    if (!ws) {
        return
    }

    log("onWebsocketOpen is not implemented!", "warn")
}

function onWebsocketError(error) {
    log("onWebsocketError is not implemented!", "warn")
}

async function connectWebsocket(token) {
    await getMyUserId()

    ws = new WebSocket(`${protocol}//${host}/ws/signaling/${token}/`)

    ws.onopen = onWebsocketOpen

    ws.onmessage = (event) => {
        try {
            onWebSocketRecieve(event)
        } catch (error) {
            log("An error occured while handling ws request!", "error", false)
            console.log(error)
        }
    }

    ws.onclose = (event) => {
        log(`WebSocket connection closed. Code: ${event.code}, reason: ${event.code != 1000 ? event.reason || "No reason given." : "Client initiated disconnect."}`, event.code != 1000 ? "warn" : "", false)

        if (event.code != 1000 && WebRTCStarted) {
            showAlert("Error", "Connection with server is lost, please refresh your page to reconnect.", "error", 15000)
        }
    }

    ws.onerror = (error) => {
        log("Websocket error (Check console for more)", "error", false)
        console.log("Websocker error: ", error)

        onWebsocketError(error)
    }

    currentToken = token
}