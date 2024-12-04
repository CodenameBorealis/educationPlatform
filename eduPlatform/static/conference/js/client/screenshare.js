var isSharingScreen, screenShareSelf, screenShareStream, screenShareMediaID

const screenShareVideo = document.getElementById("screen-share-video")
const screenShareAudio = document.getElementById("screen-share-audio")

const screenshareFrame = document.getElementById("screenshare-frame")
const screensharePlaceholder = document.getElementById("screenshare-placeholder")

function loadScreenShare(stream, placeholder_name) {
    if (!isSharingScreen) {
        return
    }

    screensharePlaceholder.innerHTML = `${placeholder_name} is currently sharing their screen.`
    screenshareFrame.style.display = "flex"

    screenShareVideo.autoplay = true
    screenShareVideo.playsInline = true
    screenShareVideo.muted = true
    screenShareVideo.srcObject = stream

    if (stream.getAudioTracks()[0]) {
        screenShareAudio.muted = screenShareSelf ? true : false
        screenShareAudio.autoplay = true
        screenShareAudio.srcObject = stream
    }

    log("Loaded screen share")
}

function unloadScreenShare() {
    screensharePlaceholder.innerHTML = ``
    screenshareFrame.style.display = "none"

    screenShareVideo.srcObject = null

    screenShareAudio.muted = true
    screenShareAudio.srcObject = null
}

async function renegotiatePeerScreenShare(remoteUserId, stream) {
    const peer = peers[remoteUserId]
    if (!peer) {
        return
    }

    peerAddScreenShareStream(peer, stream)
    await createOffer(remoteUserId)
}

function peerAddScreenShareStream(peer, stream) {
    const audio = stream.getAudioTracks()[0]
    const video = stream.getVideoTracks()[0]

    if (!video) {
        log("Did not add sharescreen stream to peer connection: video track is not present.", "warn")
        return
    }

    if (audio) {
        const audioSender = peer.addTrack(stream.getAudioTracks()[0], stream)
        peer.screenAudioSender = audioSender
    }

    const videoSender = peer.addTrack(stream.getVideoTracks()[0], stream)
    peer.screenVideoSender = videoSender
}

function peerRemoveScreenShareStream(peer) {
    if (peer.screenVideoSender) {
        peer.removeTrack(peer.screenVideoSender)
        peer.screenVideoSender = null
    }

    if (peer.screenAudioSender) {
        peer.removeTrack(peer.screenAudioSender)
        peer.screenAudioSender = null
    }
}

async function startScreenShare() {
    if (!WebRTCStarted || isSharingScreen || isListener) {
        return
    }

    if (!isHost) {
        showAlert("Access denied.", "You must be a host/co-host of this conference to share your screen.", "error")
        return
    }

    try {
        const displayMediaOptions = {
            video: {
                cursor: "always"
            },
            audio: true
        }

        screenShareStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
        log("Screenshare media ID: " + screenShareStream.id)

        for (const [id, peer] of Object.entries(peers)) {
            renegotiatePeerScreenShare(id, screenShareStream)
        }

        isSharingScreen = true
        screenShareSelf = true

        screenShareStream.getVideoTracks()[0].onended = () => {
            log("Screenshare videotrack ended unexpectedly", "warn")
            stopScreenShare()
        }

        ws.send(JSON.stringify({
            type: "start-screenshare",
            mediaId: screenShareStream.id
        }))

        await loadScreenShare(screenShareStream)
    } catch (error) {
        handleMediaError(error)
    }
}

async function stopScreenShare() {
    if (!WebRTCStarted || !isSharingScreen) {
        return
    }

    if (!screenShareSelf) {
        showAlert("Access denied.", "You can only stop the screenshare if you're the one who started it.", "error")
        return
    }

    try {
        if (screenShareStream) {
            screenShareStream.getTracks().forEach(track => track.stop())
        }

        for (const [id, peer] of Object.entries(peers)) {
            peerRemoveScreenShareStream(peer)
            await createOffer(id)
        }

        screenShareSelf = false
        isSharingScreen = false

        screenshareBtn.classList.remove("control-on")
        screenshareBtn.dataset.tooltip = "Screen share"

        ws.send(JSON.stringify({
            type: "stop-screenshare",
        }))

        unloadScreenShare()
        screenShareStream = null
    } catch (error) {
        log("An error occured while trying to stop screenshare, check console for more info.", "error")
    }
}

async function onWebsocketScreenshare(mediaId, userId) {
    if (!mediaId || !userId) {
        return
    }

    log("Received screenshare data from websocket.")

    const peer = peers[userId]
    if (!peer) {
        log("Failed to find a peer for screenshare userId", "error")
        return
    }

    isSharingScreen = true

    peer.streamMap.set("screenshare_stream", mediaId)
    peer.streamMap.onUpdate()
}

async function onWebsockerStopScreenshare(userId) {
    if (!userId) {
        return
    }

    log("Received request to stop remote screenshare.")

    const peer = peers[userId]
    if (!peer) {
        log("Failed to find a peer for screenshare userId", "error")
        return
    }

    isSharingScreen = false

    peer.streamMap.delete("screenshare-id")
    peer.streamMap.onUpdate()

    unloadScreenShare()
}