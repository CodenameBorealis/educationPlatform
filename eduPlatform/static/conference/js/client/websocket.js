var ws

async function onWebSocketRecieve(event) {
    if (!WebRTCStarted) {
        return
    }

    const data = JSON.parse(event.data)
    const { type, from, to, offer, answer, candidate } = data

    if (to) {
        if (to === userId) {
            log("Got personal WebSocket response - " + type)
        }
    } else {
        log("Got global WebSocket response - " + type)
    }

    // Global signaling calls

    if (type == "new-participant" && from != userId) {
        if (peers[from]) {
            disconnectUser(from)
        }
        await connectUser(from, data["default_media"])
    } else if (type == "global-message") {
        if (from == userId) {
            return
        }
        await onMessageReceive(data)
    } else if (type == "start-screenshare" && from != userId) {
        if (isSharingScreen) {
            return
        }

        await onWebsocketScreenshare(data["mediaId"], from)
    } else if (type == "stop-screenshare" && from != userId) {
        await onWebsockerStopScreenshare(from)
    }

    if (!to == userId) {
        return
    }

    // WebRTC calls

    if (type == "offer") {
        await handleOffer(offer, from)
    } else if (type == "answer") {
        await peers[from].setRemoteDescription(new RTCSessionDescription(answer))
    } else if (type == "candidate") {
        await addIceCandidate(from, candidate)
    } else if (type == "set_default_media") {
        setPeerDefaultMediaStream(from, data["id"])
    }

    // Personal response calls

    if (type == "webcam_start") {
        log("Track ID: " + data["id"])

        const track = await waitForTrack(peers[from], data["id"])
        if (!track) {
            log("Track ID not found in track map.", "warn")
            return
        }

        addVideo(from, new MediaStream([track]))
    } else if (type == "webcam_stop") {
        removeStream("video", from)
    } else if (type == "add-cohost") {
        loadAsCoHost()
    } else if (type == "remove-cohost") {
        await unloadCoHost()
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

function disconnectWebsocket() {
    if (!ws) {
        return
    }

    ws.close()
    ws = null

    for (const [id, peer] of Object.entries(peers)) {
        disconnectUser(id)
    }

    removeStream("video", userId)

    disconnectBtn.disabled = true
    log("Disconnected")
}

async function connectWebsocket(token) {
    await getMyUserId()

    ws = new WebSocket(`${protocol}//${host}/ws/signaling/${token}/`)

    ws.onopen = onWebsocketOpen

    ws.onmessage = (event) => {
        try {
            onWebSocketRecieve(event)
        } catch (error) {
            alert("An error occured while handling ws request!", error, false)
            document.location.reload()
        }
    }

    ws.onclose = (event) => {
        log(`WebSocket connection closed. Code: ${event.code}, reason: ${event.code != 1000 ? event.reason || "No reason given." : "Client initiated disconnect."}`, event.code != 1000 ? "warn" : "")
    }

    ws.onerror = (error) => {
        log("Websocket error (Check console for more)", "error", false)
        console.log("Websocker error: ", error)

        onWebsocketError(error)
    }

    currentToken = token
}