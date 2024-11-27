async function startScreenShare() {
    if (!WebRTCStarted || isSharingScreen) {
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
        screenShareStream.getTracks().forEach(track => log(track.label))

        for (const [id, peer] of Object.entries(peers)) {
            peerAddScreenShareStream(peer, screenShareStream)
            await createOffer(id)
        }

        isSharingScreen = true
    } catch (error) {
        handleMediaError(error)
    }
}