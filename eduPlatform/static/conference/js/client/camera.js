var cameraEnabled = false

var currentWebcamSelectedStream, webcamTrack
var cameraSelectorOpen = false

const toggleCam = document.getElementById("toggleCam")
const videos = document.getElementById("videos")

const cameraSelection = document.getElementById("cameraSelect")
const videoPreview = document.getElementById("videoPreview")

async function addVideo(id, src, micEnabled=false) {
    if (id !== userId && peers[id].failed) {
        return
    }

    const existing = document.getElementById(`video-${id}`)
    if (existing) {
        existing.remove()
        existing.srcObject = null
    }

    const frame = document.createElement('div')
    frame.id = `video-${id}`
    frame.innerHTML = `
    <div class="video-card">
        <video class="video"></video>
        <div class="video-footer">
            <span class="username">${await getUsernameFromID(id)}</span>
            <img src="/static/conference/img/mic_muted.png" alt="" class="mute-icon">
        </div>
    </div>
    `

    const remoteVideo = frame.querySelector(".video")
    remoteVideo.srcObject = src
    remoteVideo.autoplay = true
    remoteVideo.playsInline = true
    remoteVideo.muted = true

    if ((peers[id] && peers[id].micEnabled === true) || micEnabled) {
        frame.querySelector(".mute-icon").style.display = "none"
    }
    
    videos.appendChild(frame)
}

function peerAddWebcam(remoteUserId, videoTrack, stream) {
    try {
        const peer = peers[remoteUserId]
        const sender = peer.addTrack(videoTrack, stream)
        peer.videoCamSender = sender
    } catch (error) {
        log("Failed to add video to peer connection, check console for more info", "error", false)
        console.log(error)
    }
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
            to: Number(id)
        }))
    }

    toggleCam.dataset.tooltip = "Turn camera on"
    toggleCam.classList.remove("control-on")

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

        toggleCam.dataset.tooltip = "Turn camera off"
        toggleCam.classList.add("control-on")

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

        addVideo(userId, videoStream, microphoneEnabled)

        for (const [id, peer] of Object.entries(peers)) {
            await peerRenegotiateWebcam(id, videoTrack, localStream)
        }
        
        ws.send(JSON.stringify({
            type: "toggle-microphone",
            status: microphoneEnabled
        }))

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
        log("Detected camera: " + camera.label)

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

        videoPreview.srcObject = videoStream
        currentWebcamSelectedStream = videoStream
    } catch (error) {
        handleMediaError(error)
    }
}