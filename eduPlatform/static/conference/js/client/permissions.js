const screenshareBtn = document.getElementById("screenShare")
const presentationBtn = document.getElementById("presentation")

const presPrevious = document.getElementById("pres-prev")
const presNext = document.getElementById("pres-next")

function addCoHost(remoteUserId) {
    if (!isHost || !remoteUserId) {
        return
    }

    ws.send(JSON.stringify({
        "to": remoteUserId,
        "type": "add-cohost",
    }))

    log(`Request to add user ${remoteUserId} as a co-host was sent`, "LOG", false)
}

function removeCoHost(remoteUserId) {
    if (!isHost || !remoteUserId) {
        return
    }

    ws.send(JSON.stringify({
        "to": remoteUserId,
        "type": "remove-cohost"
    }))

    log(`Request to remove user ${remoteUserId} from the co-host list was sent`, "LOG", false)
}

function loadAsCoHost() {
    screenshareBtn.style.display = "block"
    presentationBtn.style.display = "block"

    screenshareBtn.addEventListener("click", async () => {
        if (!WebRTCStarted || (isSharingScreen && !screenShareSelf)) {
            return
        }

        if (screenShareSelf) {
            await stopScreenShare()

            screenshareBtn.classList.remove("control-on")
            screenshareBtn.dataset.tooltip = "Screen share"

            return
        }

        await startScreenShare()

        if (screenShareSelf) {
            screenshareBtn.classList.add("control-on")
            screenshareBtn.dataset.tooltip = "Stop sharing screen"
        }
    })

    presentationBtn.addEventListener("click", () => {
        if (!WebRTCStarted) {
            return
        }

        if (!presentationRunning) {
            promptPresentationSelection()
        } else if (presentingSelf) {
            stopPresentation()
        }
    })

    presPrevious.addEventListener("click", () => {
        if (!isHost || !presentationRunning) return
        if (!presentingSelf) return

        if (currentPage - 1 < 0) return
        setPresentationPage(currentPage - 1)
    })

    presNext.addEventListener("click", () => {
        if (!isHost || !presentationRunning) return
        if (!presentingSelf) return

        if (currentPage + 1 > maxPages) return
        setPresentationPage(currentPage + 1)
    })

    isHost = true
    log("Loaded co-host view")
}

function loadAsHost() {
    loadAsCoHost()
    endConferenceBtn.style.display = "inline-block"
}

async function unloadCoHost() {
    if (screenShareSelf) {
        await stopScreenShare()
    }

    screenshareBtn.style.display = "none"
    screenshareBtn.removeEventListener("click")

    presentationBtn.style.display = "none"
    screenshareBtn.removeEventListener("click")

    isHost = false
    log("Unloaded host view")
}
