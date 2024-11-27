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

    if (type == "new-participant" && from != userId) {
        if (peers[from]) {
            disconnectUser(from)
        }

        await createOffer(from)
    } else if (type == "global-message") {
        if (from == userId) {
            return
        }

        await onMessageReceive(data)
    }

    if (!to == userId) {
        return
    }

    if (type == "offer") {
        await handleOffer(offer, from)
    } else if (type == "answer") {
        await peers[from].setRemoteDescription(new RTCSessionDescription(answer))
    } else if (type == "candidate") {
        await addIceCandidate(from, candidate)
    }

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
    }
}

function onWebsocketOpen(event) {
    if (!ws) {
        return
    }

    log("Websocket connection established")

    connectAudio.disabled = false
    connectMic.disabled = false

    connectAudio.addEventListener("click", () => {
        connectAudio.disabled = true
        connectMic.disabled = true

        startWebRTC(true)
    })

    connectMic.addEventListener("click", () => {
        connectAudio.disabled = true
        connectMic.disabled = true

        startWebRTC()
    })
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
            alert("An error occured while handling ws request!", error)
            document.location.reload()
        }
    }

    ws.onclose = (event) => {
        log(`WebSocket connection closed. Code: ${event.code}, reason: ${event.code != 1000 ? event.reason || "No reason given." : "Client initiated disconnect."}`, event.code != 1000 ? "warn" : "")
    }

    ws.onerror = (error) => {
        log("Websocket error (Check console for more)", "error")
        console.log("Websocker error: ", error)
    }

    currentToken = token
}