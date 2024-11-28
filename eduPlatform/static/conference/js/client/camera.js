var cameraEnabled = false

var currentWebcamSelectedStream, webcamTrack
var cameraSelectorOpen = false

function addVideo(id, src) {
    const existing = document.getElementById(`video-${id}`)
    if (existing) {
        existing.remove()
        existing.srcObject = null
    }

    const remoteVideo = document.createElement('video')

    remoteVideo.srcObject = src
    remoteVideo.autoplay = true
    remoteVideo.playsInline = true
    remoteVideo.muted = true
    remoteVideo.id = `video-${id}`
    remoteVideo.classList.add("video-frame")

    document.getElementById("videos").appendChild(remoteVideo)
}

function peerAddWebcam(remoteUserId, videoTrack, stream) {
    const peer = peers[remoteUserId]
    const sender = peer.addTrack(videoTrack, stream)
    peer.videoCamSender = sender
}

async function peerRenegotiateWebcam(remoteUserId, videoTrack, stream) {
    peerAddWebcam(remoteUserId, videoTrack, stream)
    await createOffer(remoteUserId)
}

async function turnCameraOff() {
    if (!cameraEnabled) {
        return
    }

    toggleCam.disabled = true
    setTimeout(() => {
        toggleCam.disabled = false
    }, 2500)

    removeStream("video", userId)

    localStream.removeTrack(webcamTrack)
    webcamTrack.stop()

    webcamTrack = null

    for (const [id, peer] of Object.entries(peers)) {
        if (!peer.videoCamSender) {
            continue
        }

        peer.removeTrack(peer.videoCamSender)
        peer.videoCamSender = null

        await createOffer(id)

        ws.send(JSON.stringify({
            type: "webcam_stop",
            to: id
        }))
    }

    cameraEnabled = false
}

async function turnCameraOn(videoStream) {
    if (cameraEnabled || !videoStream) {
        return
    }

    try {
        toggleCam.disabled = true
        setTimeout(() => {
            toggleCam.disabled = false
        }, 2500)

        toggleCam.innerHTML = "Turn camera off"

        const videoTrack = videoStream.getVideoTracks()[0]
        log("Using webcam: " + videoTrack.label)

        const videoTrackExists = localStream.getVideoTracks().find(
            (track) => track.label === videoTrack.label
        )

        if (videoTrackExists) {
            log("Video track already exists.", "warn")
            return
        }

        webcamTrack = videoTrack
        localStream.addTrack(videoTrack)

        videoTrack.addEventListener("ended", () => {
            log("The video feed has ended unexpectedly.", "error")
            turnCameraOff()
        })

        addVideo(userId, videoStream)

        for (const [id, peer] of Object.entries(peers)) {
            await peerRenegotiateWebcam(id, videoTrack, localStream)
        }

        cameraEnabled = true
    } catch (error) {
        handleMediaError(error)
    }
}

async function openCameraSelector() {
    const videoPermissionStatus = await navigator.permissions.query({ name: 'camera' })

    if (videoPermissionStatus.state !== "granted") {
        log("No permissions granted, prompting user")

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true })
            stream.getTracks().forEach((track) => track.stop())
        } catch (error) {
            handleMediaError(error)
            return
        }
    }

    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoCameras = devices.filter(device => device.kind === 'videoinput')

    document.querySelector(".camera-frame-container").style.display = "block"

    currentWebcamSelectedStream = null
    cameraSelection.innerHTML = ""

    for (camera of videoCameras) {
        log("Camera " + camera.label)

        const option = document.createElement('option')
        option.value = camera.deviceId
        option.textContent = camera.label || `Camera ${camera.deviceId}`

        cameraSelection.appendChild(option)
    }

    await changeCameraSelection()
    cameraSelectorOpen = true
}

async function closeCameraSelector(stopTracks = true) {
    if (!cameraSelectorOpen) {
        return
    }

    document.querySelector(".camera-frame-container").style.display = "none"

    if (currentWebcamSelectedStream && stopTracks) {
        await currentWebcamSelectedStream.getTracks().forEach(track => track.stop())
        currentWebcamSelectedStream = null
    }

    cameraSelectorOpen = false
}

async function changeCameraSelection(id) {
    try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: id ? { deviceId: id } : true })

        if (currentWebcamSelectedStream) {
            currentWebcamSelectedStream.getTracks().forEach(track => track.stop())
        }

        document.getElementById("videoPreview").srcObject = videoStream
        currentWebcamSelectedStream = videoStream
    } catch (error) {
        handleMediaError(error)
    }
}