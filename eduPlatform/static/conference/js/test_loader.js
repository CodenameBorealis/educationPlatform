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

const cameraSelection = document.getElementById("cameraSelect")
const micSelection = document.getElementById("micSelect")

var currentToken, hostId

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

micSelection.addEventListener("change", (event) => {
    event.preventDefault()
    changeMicrophone(event.target.value)
})

cameraSelection.addEventListener("change", (event) => {
    event.preventDefault()
    changeCameraSelection(event.target.value)
})