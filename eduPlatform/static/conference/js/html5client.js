const connectionOverlay = document.getElementById("connectionOverlay")
const connectAudio = document.getElementById("connectAudio")
const connectMic = document.getElementById("connectMic")

const screenshareBtn = document.getElementById("screenShare")

const closeCameraSelectorBtn = document.getElementById("close-camera-selector")
const openCameraSelectorBtn = document.getElementById("start-camera-button")

const chatFrame = document.querySelector(".frame-container")
const chatCloseBtn = document.querySelector(".frame-close-btn")
const chatOpenBtn = document.getElementById("chat-btn")
const messageSendButton = document.getElementById("send-btn")

const usersFrame = document.querySelector(".users")
const usersOpenBtn = document.getElementById("users-btn")
const usersCloseBtn = document.querySelector(".users-close-btn")

const path = window.location.pathname
const match = path.match(/\/conference\/web\/([^\/]+)/)[1]

var usersOpen = false
var chatOpen = false

var websocketConnected = false

function connectEventListeners() {
    toggleMic.addEventListener("click", () => {
        if (!WebRTCStarted || isListener) {
            return
        }

        toggleMicrophone(!microphoneEnabled)

        toggleMic.disabled = true
        setTimeout(() => {
            toggleMic.disabled = false
        }, 2500)
    })

    toggleCam.addEventListener("click", () => {
        if (!WebRTCStarted || isListener || cameraSelectorOpen) {
            return
        }
        if (cameraEnabled) {
            turnCameraOff()
        } else {
            openCameraSelector()
        }
    })

    closeCameraSelectorBtn.addEventListener("click", () => {
        closeCameraSelector()
    })
    
    openCameraSelectorBtn.addEventListener("click", () => {
        if (!WebRTCStarted || cameraEnabled || !currentWebcamSelectedStream) {
            return
        }
    
        turnCameraOn(currentWebcamSelectedStream)
        closeCameraSelector(false)
    })

    cameraSelection.addEventListener("change", (event) => {
        event.preventDefault()
        changeCameraSelection(event.target.value)
    })

    messageSendButton.addEventListener("click", () => {
        sendChatMessage()
    })

    messageInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
            return
        }
        sendChatMessage()
    })
}

async function onWebRTCStart() {
    loadMessageHistory()

    await getConferenceInfo(currentToken)
    document.getElementById("conference-name").innerHTML = conferenceInfo["name"]

    if (isHost) {
        loadAsHost()
    }

    if (!isListener) {
        toggleMicrophone(false)
    }

    document.getElementById("background-transition").style.display = "none"

    hideTextOverlay()
    connectEventListeners()

    await addUserToList(userId)
    updateUserStatus(userId, isListener ? "is-listener" : "is-muted")
}

async function connect(isListener) {
    if (WebRTCStarted || !websocketConnected) {
        return
    }

    connectionOverlay.classList.remove("active")
    showTextOverlay("Connecting")

    const successful = await startWebRTC(isListener)

    if (!successful) {
        connectionOverlay.classList.add("active")
        hideTextOverlay()
        
        return
    }

    if (isListener) {
        toggleMic.classList.add("control-disabled")
        toggleMic.dataset.tooltip = "You cannot use microphone in listener mode"

        toggleCam.classList.add("control-disabled")
        toggleCam.dataset.tooltip = "You cannot turn camera on in listener mode"

        screenshareBtn.classList.add("control-disabled")
        screenshareBtn.dataset.tooltip = "You cannot share screen in listener mode"
    }
}

function onWebsocketOpen() {
    websocketConnected = true
    log("Websocket connection established.", "LOG", false)

    hideTextOverlay()
    connectionOverlay.classList.add("active")

    connectAudio.addEventListener("click", () => {
        connect(true)
    })

    connectMic.addEventListener("click", () => {
        connect()
    })
}

function onWebsocketError() {
    if (!websocketConnected) {
        showTextOverlay(
            "Connection failed.",
            "Failed to connect to conference, please ensure that you're using the correct token and the conference still exists" +
            " If you believe that is is a mistake or the issue persists, please contact technical support."
        )
        return
    }
}

async function initializeConnection(token) {
    if (!token || token === "") {
        log("Failed to find URL token.", "error", false)
        return
    }

    log("Initializing HTML5Client", "LOG", false)

    showTextOverlay("Connecting")
    connectWebsocket(match)
}

consoleBasedLogs = true
initializeConnection(match)

chatOpenBtn.addEventListener("click", () => {
    if (chatOpen) {
        return
    }

    chatOpen = true
    chatFrame.style.display = "flex"
})

chatCloseBtn.addEventListener("click", () => {
    if (!chatOpen) {
        return
    }

    chatOpen = false
    chatFrame.style.display = "none"
})

usersOpenBtn.addEventListener("click", () => {
    if (usersOpen) {
        return
    }

    usersOpen = true
    usersFrame.style.display = "block"
})

usersCloseBtn.addEventListener("click", () => {
    if (!usersOpen) {
        return
    }

    usersOpen = false
    usersFrame.style.display = "none"
})