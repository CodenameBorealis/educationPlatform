// The JS code for this project is low-key shit, we both know that, yell at me for it later

const connectionOverlay = document.getElementById("connectionOverlay")
const connectAudio = document.getElementById("connectAudio")
const connectMic = document.getElementById("connectMic")

const closeCameraSelectorBtn = document.getElementById("close-camera-selector")
const openCameraSelectorBtn = document.getElementById("start-camera-button")

const chatFrame = document.querySelector(".frame-container")
const chatCloseBtn = document.querySelector(".frame-close-btn")
const chatOpenBtn = document.getElementById("chat-btn")
const messageSendButton = document.getElementById("send-btn")

const usersFrame = document.querySelector(".users")
const usersOpenBtn = document.getElementById("users-btn")
const usersCloseBtn = document.querySelector(".users-close-btn")

const endConferenceBtn = document.getElementById("stop-conference")

const path = window.location.pathname
const match = path.match(/\/conference\/web\/([^\/]+)/)[1]

var usersOpen = false
var chatOpen = false

var conferenceStarted = false
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

    endConferenceBtn.addEventListener("click", () => {
        if (!WebRTCStarted) {
            return
        }

        if (hostId !== userId) {
            return
        }

        showTextOverlay(
            "End conference", "Are you sure you want to end the conference?",
            "yes-no-timed", {
                "yes": () => {
                    endConference()
                },
                "no": () => {},
                "delay": 5,
            }
        )
    })
}

async function onWebRTCStart() {
    loadMessageHistory()
    await getConferenceInfo(currentToken)

    document.getElementById("conference-name").innerHTML = conferenceInfo["name"]
    document.getElementById("title").innerHTML = conferenceInfo["name"]

    if (isHost) {
        loadAsHost()
    }

    if (!isListener) {
        toggleMicrophone(false, false)
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

function displayNotStarted() {
    if (userId == hostId) {
        showTextOverlay(
            "Conference hasn't started yet",
            "Do you wish to start the conference now?",
            "start-prompt-host"
        )

        document.getElementById("start-conference-btn").addEventListener("click", (event) => {
            if (!websocketConnected || !isHost || !currentToken) {
                console.log(websocketConnected, isHost, currentToken)
                return
            }

            event.target.innerHTML = "Starting..."
            event.target.disabled = true

            postHttpAsync(`/conference/api/start/?token=${currentToken}`)
            log("Sent a request to start the conference", "LOG", false)
        })

        return
    }

    showTextOverlay(
        "Conference hasn't started yet",
        "The conference that you're trying to connect to hasn't started yet." +
        "You dont have to refresh the page, you will be automatically connected when host starts the conference.",
        "waiting-host", { host_id: hostId }
    )
}

function onConferenceStart() {
    updateElapsedTime()
    setInterval(updateElapsedTime, 1000)

    document.getElementById("start-sound").play()

    hideTextOverlay()
    connectionOverlay.classList.add("active")

    connectAudio.addEventListener("click", () => {
        connect(true)
    })

    connectMic.addEventListener("click", () => {
        connect()
    })
}

function onConferenceEnd() {
    stopWebRTC()

    var countdown = 11
    const countdownFunc = () => {
        countdown -= 1
        showTextOverlay(
            "The conference has ended!",
            `You will be redirected back to the home page in ${countdown} seconds.`
        )

        if (countdown > 0) {
            setTimeout(countdownFunc, 1000)
        } else {
            document.location.assign("/")
        }
    }

    document.getElementById("background-transition").style.display = "block"
    document.getElementById("end-sound").play()

    if (endCountdownInterval) {
        clearInterval(endCountdownInterval)
    }

    countdownFunc()
}

function onWebsocketOpen() {
    websocketConnected = true
    log("Websocket connection established.", "LOG", false)

    if (!conferenceInfo["started"]) {
        displayNotStarted()
        return
    }

    if (conferenceInfo["ended"]) {
        const date = new Date(conferenceInfo.end_time)

        const options = {
            weekday: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
            hour12: true
        }

        const formattedDate = new Intl.DateTimeFormat("en-US", options).format(date)

        showTextOverlay(
            "Conference ended",
            `This conference has already ended on ${formattedDate}`
        )
        return
    }

    conferenceStarted = true
    onConferenceStart()
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

function endConference() {
    if (!isHost) {
        return
    }

    postHttpAsync(`/conference/api/end/?token=${currentToken}`)
    log("Sent a request to end the conference.", "LOG", false)
}

async function initializeConnection(token) {
    if (!token || token === "") {
        log("Failed to find URL token.", "error", false)
        return
    }

    log("Initializing HTML5Client", "LOG", false)
    showTextOverlay("Connecting")

    try {
        await getMyUserId()
        await getConferenceInfo(token)
    } catch (error) {
        showTextOverlay(
            "Failed to fetch",
            "Failed to connect to conference, please ensure that you're using the correct token and the conference still exists" +
            " If you believe that is is a mistake or the issue persists, please contact technical support."
        )
        return
    }

    connectWebsocket(match)
}

consoleBasedLogs = true
verboseLogsEnabled = false

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