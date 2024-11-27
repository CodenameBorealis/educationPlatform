// To whoever is reading the JS code for the client, we both know the code is shit, the least I can do is say sorry

const toggleLogBtn = document.getElementById("toggle-logs")

const tokenInput = document.getElementById("room-token")

const connectBtn = document.getElementById("connect")
const disconnectBtn = document.getElementById("disconnect")

const connectAudio = document.getElementById("connect-audio")
const connectMic = document.getElementById("connect-mic")

const toggleMic = document.getElementById("toggle-mic")
const toggleCam = document.getElementById("toggle-cam")

const screenShareBtn = document.getElementById("screen-share")

const messageSendButton = document.getElementById("send-btn")
const messageInput = document.getElementById("chat-input")

const cameraSelection = document.getElementById("cameraSelect")

var currentToken, hostId

var microphoneEnabled = false

var logsShown = false
var chatShown = false

function toggleMicrophone(status) {
    const stream = localStream.getTracks().find(track => track.kind == 'audio')

    stream.enabled = status
    microphoneEnabled = status

    if (status) {
        toggleMic.innerHTML = "Mute"
    } else {
        toggleMic.innerHTML = "Unmute"
    }

    log("Microphone: " + (status ? "On" : "Off"))
}

async function bindPermissionListeners() {
    const videoPermissionStatus = await navigator.permissions.query({ name: 'camera' })
    const micPermissionStatus = await navigator.permissions.query({ name: 'microphone' })

    videoPermissionStatus.onchange = () => {
        if (isListener) {
            return
        }

        if (videoPermissionStatus.state !== "granted" && cameraEnabled) {
            turnCameraOff()
            log("Camera permissions have been revoked.", "warn")
        }
    }

    micPermissionStatus.onchange = () => {
        if (isListener) {
            return
        }

        if (micPermissionStatus.state !== "granted" && WebRTCStarted) {
            disconnectWebsocket()
            log("Microphone access denied, please ensure microphone access are granted to continue.", "error")
        }
    }
}

function loadAsHost() {
    screenShareBtn.style.display = "block"

    screenShareBtn.addEventListener("click", async () => {
        if (!WebRTCStarted || (isSharingScreen && !screenShareSelf)) {
            return
        }

        if (screenShareSelf) { 
            await stopScreenShare()
            screenShareBtn.innerHTML = "Screen share"

            return
        }

        await startScreenShare()

        if (screenShareSelf) {
            screenShareBtn.innerHTML = "Stop sharing screen"
        }
    })
}

function addAudio(id, src) {
    const existing = document.getElementById(`audio-${id}`)
    if (existing) {
        existing.remove()
        existing.srcObject = null
    }

    const remoteAudio = document.createElement('audio')

    remoteAudio.srcObject = src
    remoteAudio.autoplay = true
    remoteAudio.id = `audio-${id}`

    document.getElementById("mics").appendChild(remoteAudio)
}

connectAudio.disabled = true
connectMic.disabled = true

disconnectBtn.disabled = true

messageSendButton.disabled = true

if (document.querySelector(".chat-container").style.display == "") {
    const chat = document.querySelector(".chat-container")

    const openBtn = document.getElementById("open-chat")
    const closeBtn = document.getElementById("close-chat")

    openBtn.style.display = "block"
    closeBtn.style.display = "block"

    openBtn.addEventListener("click", () => {
        chat.style.display = "flex"
    })

    closeBtn.addEventListener("click", () => {
        chat.style.display = "none"
    })
}

toggleLogBtn.addEventListener("click", () => {
    logsShown = !logsShown

    if (logsShown) {
        logFrame.style.display = "block"
        toggleLogBtn.innerHTML = "Hide logs"
    } else {
        logFrame.style.display = "none"
        toggleLogBtn.innerHTML = "Show logs"
    }
})

connectBtn.addEventListener("click", () => {
    if (!tokenInput.value || ws) {
        return
    }

    connectWebsocket(tokenInput.value)
    
    connectBtn.disabled = true
    disconnectBtn.disabled = false
})

disconnectBtn.addEventListener("click", () => {
    if (!ws) {
        return
    }

    disconnectWebsocket()
})


toggleMic.addEventListener("click", () => {
    if (!WebRTCStarted || isListener) {
        return
    }

    toggleMicrophone(!microphoneEnabled)
})

toggleCam.addEventListener("click", () => {
    if (!WebRTCStarted || isListener || cameraSelectorOpen) {
        return
    }

    if (cameraEnabled) {
        turnCameraOff()
        toggleCam.innerHTML = "Turn camera on"
    } else {
        openCameraSelector()
    }
})


messageSendButton.addEventListener("click", () => {
    sendChatMessage()
})


cameraSelection.addEventListener("change", (event) => {
    event.preventDefault()
    changeCameraSelection(event.target.value)
})

document.getElementById("close-camera-selector").addEventListener("click", () => {
    closeCameraSelector()
})

document.getElementById("start-camera-button").addEventListener("click", () => {
    if (!WebRTCStarted || cameraEnabled || !currentWebcamSelectedStream) {
        return
    }

    turnCameraOn(currentWebcamSelectedStream)
    closeCameraSelector(false)
})