const connectionOverlay = document.getElementById("connectionOverlay")
const connectAudio = document.getElementById("connectAudio")
const connectMic = document.getElementById("connectMic")

const path = window.location.pathname
const match = path.match(/\/conference\/web\/([^\/]+)/)[1]

var websocketConnected = false

function connect(isListener) {
    if (WebRTCStarted || !websocketConnected) {
        return
    }

    connectionOverlay.classList.remove("active")
    showTextOverlay("Connecting")
    
    startWebRTC(isListener)
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
        connect(false)
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