const microphoneSelector = document.getElementById("micSelect")
const toggleMic = document.getElementById("toggleMic")

var currentMicId
var microphoneEnabled = false

var prev = null

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

function updateMicrophoneVisual(id, status) {
    const videoFrame = document.getElementById(`video-${id}`)

    if (videoFrame) {
        const micIcon = videoFrame.querySelector(".mute-icon")
        micIcon.style.display = status ? "none" : "block"
    }

    updateUserStatus(id, status ? "is-unmuted" : "is-muted")
}

async function changeMicrophone(deviceId) {
    if (!WebRTCStarted || isListener) {
        return
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: deviceId } : true })
        const audioTrack = stream.getAudioTracks()[0]

        if (!microphoneEnabled) {
            audioTrack.enabled = false
        } 

        if (!audioTrack) {
            log("No audio track was found.")
            return
        }

        for (const [id, peer] of Object.entries(peers)) {
            if (!peer.userMicSender) {
                log(`No microphone sender was found in peer ${id}`)
                continue
            }

            peer.userMicSender.replaceTrack(audioTrack)
                .then(() => {
                    log("Successfully changed microphone track")
                })
                .catch(error => {
                    log("Failed to replace microphone track, check console for errors.", "error")
                })
        }

        localStream.removeTrack(localStream.getAudioTracks()[0])
        localStream.addTrack(audioTrack)

        currentMicId = deviceId
    } catch (error) {
        handleMediaError(error)
    }
}

async function loadMicrophoneSelector() {
    const audioPermissionStatus = await navigator.permissions.query({ name: 'microphone' })

    if (audioPermissionStatus.state !== "granted") {
        log("No permissions granted for microphone, requesting access.")

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            stream.getTracks().forEach(track => track.stop())
        } catch (error) {
            handleMediaError(error)
            return
        }
    }

    const devices = await navigator.mediaDevices.enumerateDevices({ audio: true })
    const microphones = devices.filter(device => device.kind === 'audioinput')

    microphoneSelector.innerHTML = null

    for (mic of microphones) {
        const option = document.createElement("button")

        option.textContent = mic.label || `Microphone ${mic.deviceId}`
        option.value = mic.deviceId
        option.classList.add("dropup-item")
        
        log(`Detected microphone: ${mic.label}`)

        option.addEventListener("click", () => {
            changeMicrophone(mic.deviceId)

            if (prev) {
                prev.classList.remove("selected")
            }

            prev = option
            option.classList.add("selected")
        })

        microphoneSelector.appendChild(option)
    }
}

function toggleMicrophone(status) {
    const stream = localStream.getTracks().find(track => track.kind == 'audio')

    stream.enabled = status
    microphoneEnabled = status

    if (status) {
        toggleMic.dataset.tooltip = "Mute"
        toggleMic.classList.add("control-on")
    } else {
        toggleMic.dataset.tooltip = "Unmute"
        toggleMic.classList.remove("control-on")
    }

    updateMicrophoneVisual(userId, status)

    ws.send(JSON.stringify({
        type: "toggle-microphone",
        status: status
    }))
    
    log("Microphone: " + (status ? "On" : "Off"))
}