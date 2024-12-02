const microphoneSelector = document.getElementById("micSelect")

var currentMicId
var microphoneEnabled = false

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
        const option = document.createElement("option")
        option.textContent = mic.label || `Microphone ${mic.deviceId}`
        option.value = mic.deviceId
        
        log(`Detected microphone: ${mic.label}`)

        microphoneSelector.appendChild(option)
    }
}