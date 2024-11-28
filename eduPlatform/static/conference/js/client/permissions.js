function addCoHost(remoteUserId) {
    if (!isHost || !remoteUserId) {
        return
    }

    ws.send(JSON.stringify({
        "to": remoteUserId,
        "type": "add-cohost",
    }))

    log(`Request to add user ${remoteUserId} as a co-host was sent`)
}

function removeCoHost(remoteUserId) {
    if (!isHost || !remoteUserId) {
        return
    }

    ws.send(JSON.stringify({
        "to": remoteUserId,
        "type": "remove-cohost"
    }))

    log(`Request to remove user ${remoteUserId} from the co-host list was sent`)
}

function loadAsCoHost() {
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

    isHost = true
    log("Loaded co-host view")
}

function loadAsHost() {
    loadAsCoHost()
}

async function unloadCoHost() {
    if (screenShareSelf) {
        await stopScreenShare()
    }
    
    screenShareBtn.style.display = "none"
    screenShareBtn.removeEventListener("click")
    
    isHost = false
    log("Unloaded host view")
}
