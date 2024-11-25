const logFrame = document.getElementById("logs")
const toggleLogBtn = document.getElementById("toggle-logs")

const connectBtn = document.getElementById("connect")
const disconnectBtn = document.getElementById("disconnect")

const connectAudio = document.getElementById("connect-audio")
const connectMic = document.getElementById("connect-mic")

const toggleMic = document.getElementById("toggle-mic")
const toggleCam = document.getElementById("toggle-cam")

const tokenInput = document.getElementById("room-token")

const messageSendButton = document.getElementById("send-btn")
const messageInput = document.getElementById("chat-input")

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws'
const host = window.location.host

var candidateQueue = {}

var userId
var ws, localStream, currentToken
var videoCamSender

var peers = {}

var WebRTCStarted = false
var isListener = false

var microphoneEnabled = false
var cameraEnabled = false

var logsShown = false
var chatShown = false

function log(message, type = "LOG") {
    const logEntry = document.createElement('span');
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] - [${type.toUpperCase()}]: ${message}`;

    if (type == "warn") {
        logEntry.style.color = "rgb(255, 255, 0)"
        logEntry.style.fontWeight = "bold"
    } else if (type == "error") {
        logEntry.style.color = "rgb(255, 0, 0)"
        logEntry.style.fontWeight = "bold"
    }

    const lineBreak = document.createElement('br');
    logFrame.appendChild(logEntry);
    logFrame.appendChild(lineBreak);
}

function handleMediaError(error) {
    switch (error.name) {
        case 'NotAllowedError':
            console.error('Permission denied: User blocked camera/microphone.');
            alert('You need to allow access to the camera and microphone to use this feature.');
            break;
        case 'NotFoundError':
            console.error('No media devices found.');
            alert('No camera or microphone detected. Please connect one and try again.');
            break;
        case 'OverconstrainedError':
            console.error('Constraints cannot be satisfied by available devices.');
            alert('Requested media constraints are not supported.');
            break;
        default:
            console.error('Error accessing media devices:', error);
            alert('An unknown error occurred while accessing media devices.');
    }
}

async function getMyUserId() {
    userInfo = await getHttpAsync("/user/get_userinfo")
    json = await userInfo.json()

    if (!json || json["success"] == false) {
        log("Failed to fetch user data")
        return
    }

    userId = json["data"]["user_id"]
}

function addVideo(id, src) {
    const existing = document.getElementById(`video-${id}`)
    if (existing) {
        existing.remove()
        existing.srcObject = null
    }

    const remoteVideo = document.createElement('video')

    remoteVideo.srcObject = src
    remoteVideo.autoplay = true
    remoteVideo.playsInline = true
    remoteVideo.muted = true
    remoteVideo.id = `video-${id}`

    document.getElementById("videos").appendChild(remoteVideo)
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

function addChatMessage(username, message, timestamp, noSound=false) {
    const now = timestamp ? new Date(timestamp) : new Date();
    const timeText = now.toLocaleTimeString({
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    const chatBody = document.getElementById("chat-body")
    const messageDiv = document.createElement('div')
    messageDiv.classList.add("message", username == "?self" ? "sent" : "received")

    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="username">${username == "?self" ? "You" : username}</span>
            <span class="message-meta">(${timeText})</span>
        </div>
        <p>${message}</p>
    `

    if (!noSound) {
        const sound = document.getElementById(username == "?self" ? "send-sound" : "receive-sound")
        sound.currentTime = 0
        sound.play()
    }

    chatBody.appendChild(messageDiv)
    log("Added message.")
}

function removeStream(type, id) {
    const stream = document.getElementById(`${type}-${id}`)

    if (!stream) {
        return
    }

    stream.remove()
    stream.srcObject = null
}

function disconnectUser(userId) {
    if (peers[userId]) {
        peers[userId].close();
        delete peers[userId];
    }

    removeStream("audio", userId)
    removeStream("video", userId)

    log(`Closed peer connection with user-${userId}`)
}

async function handleOffer(offer, remoteUserId) {
    if (!peers[remoteUserId]) {
        createPeerConnection(remoteUserId)
    }

    const peer = peers[remoteUserId]

    await peer.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await peer.createAnswer()
    await peer.setLocalDescription(answer)

    ws.send(JSON.stringify({
        type: 'answer',
        to: Number(remoteUserId),
        answer
    }))

    log("Handled offer from " + remoteUserId + " and sent an answer")
}

async function createOffer(remoteUserId) {
    if (!peers[remoteUserId]) {
        createPeerConnection(remoteUserId);
    }

    const offer = await peers[remoteUserId].createOffer(isListener ? { offerToReceiveVideo: true, offerToReceiveAudio: true } : {})
    await peers[remoteUserId].setLocalDescription(offer)

    ws.send(JSON.stringify({
        type: 'offer',
        to: Number(remoteUserId),
        offer
    }));

    log("Sent offer")
}

async function addIceCandidate(from, candidate) {
    if (!from || !candidate) {
        return
    }

    if (!peers[from]) {
        if (!candidateQueue[from]) {
            candidateQueue[from] = [];
        }
        candidateQueue[from].push(candidate);
        log("Peer connection added to queue")

        return;
    }

    log("Got ICE candidate from " + from)

    const _candidate = new RTCIceCandidate(candidate)
    peers[from].addIceCandidate(_candidate).then(() => {
        log("ICE candidate added")
    }).catch((error) => {
        alert(error)
        log("Error adding ICE candidate", "error")
    })

}

async function loadMessageHistory() {
    try {
        const history = await getHttpAsync(`/conference/api/get-message-history/?token=${currentToken}`)
        const json = await history.json()

        log("Loading message history.")

        console.log(json)
        
        if (!json["success"]) {
            log("Failed to load message history, JSON returned success=False", "error")
            return
        }

        if (json["history"].length <= 0) {
            log("Message history is empty.")
            return
        }

        for (entry of json["history"]) {
            var { user_id, username, content, timestamp } = entry

            if (user_id == userId) {
                username = "?self"
            }

            addChatMessage(username, content, timestamp, true)
        }
    } catch (error) {
        log("Failed to load message history, please check console for more.", "error")
        console.log(error)
    }
}

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

async function turnCameraOff() {
    if (!cameraEnabled) {
        return
    }

    toggleCam.disabled = true
    setTimeout(() => {
        toggleCam.disabled = false
    }, 2500)

    const videoTrack = localStream.getVideoTracks()[0]
    if (!videoTrack) {
        return
    }

    removeStream("video", userId)

    localStream.removeTrack(videoTrack)
    videoTrack.stop()

    for (const [id, peer] of Object.entries(peers)) {
        if (!peer.videoCamSender) {
            continue
        }

        peer.removeTrack(peer.videoCamSender)
        peer.videoCamSender = null

        await createOffer(id)

        ws.send(JSON.stringify({
            type: "webcam_stop",
            to: id
        }))
    }

    cameraEnabled = false
}

async function turnCameraOn() {
    if (cameraEnabled) {
        return
    }

    try {
        toggleCam.disabled = true
        setTimeout(() => {
            toggleCam.disabled = false
        }, 2500)

        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        const videoTrack = stream.getVideoTracks()[0]

        log("Using webcam: " + videoTrack.label)

        const videoTrackExists = localStream.getVideoTracks().find(
            (track) => track.label === videoTrack.label
        )

        if (videoTrackExists) {
            log("Video track already exists.", "warn")
            return
        }

        localStream.addTrack(videoTrack)

        videoTrack.addEventListener("ended", () => {
            log("The video feed has ended unexpectedly.", "error")
            turnCameraOff()
        })

        const videoStream = new MediaStream([videoTrack])
        addVideo(userId, videoStream)

        for (const [id, peer] of Object.entries(peers)) {
            const sender = peer.addTrack(videoTrack, localStream)
            peer.videoCamSender = sender

            await createOffer(id)
        }

        cameraEnabled = true
    } catch (error) {
        handleMediaError(error)
    }
}

async function onMessageReceive(data) {
    const { from, content, timestamp } = data

    const usernameRequest = await getHttpAsync(`/user/get_username/?user_id=${from}`)
    const json = await usernameRequest.json()

    if (!json["success"]) {
        log("Failed to get username for the received message!")
        return
    }

    const username = json["data"]["username"]
    addChatMessage(username, content, timestamp)
}

function sendChatMessage(content) {
    if (!WebRTCStarted) {
        return
    }

    const message = messageInput.value
    if (!message || message === "") {
        return
    }

    addChatMessage("?self", message)
    messageInput.value = ""

    try {
        ws.send(JSON.stringify({
            type: "global-message",
            content: message
        }))
    } catch (error) {
        log("Failed to send message through the websocket, check console for more info.", "error")
        console.log(error)
    }
}

function createPeerConnection(remoteUserId) {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            {
                urls: 'turn:turn.demodeck.ru:3478',
                username: 'turnServerAdmin',
                credential: 'AYP04e23t6yusr223oui61aljfka7kwn3ez'
            }
        ]
    }

    var peerConnection = new RTCPeerConnection(configuration)

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({
                type: 'candidate',
                to: remoteUserId,
                candidate: event.candidate,
            }))
            log("Sent ice candidate")
        }
    }

    peerConnection.ontrack = (event) => {
        if (event.track.kind === "video") {
            addVideo(remoteUserId, event.streams[0])
        } else if (event.track.kind === "audio") {
            addAudio(remoteUserId, event.streams[0])
        }
    }

    if (candidateQueue[remoteUserId]) {
        candidateQueue[remoteUserId].forEach(candidate => addIceCandidate(remoteUserId, candidate));
        delete candidateQueue[remoteUserId];
    }

    if (!isListener) {
        localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))
    } else {
        peerConnection.addTrack = function (...args) {
            throw new Error("Track addition is not allowed in listener mode.")
        }
    }

    peers[remoteUserId] = peerConnection

    peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        log(`User-${remoteUserId} - ICE Connection State: ${state}`, state === "failed" || state === "disconnected" ? "error" : "");

        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
            disconnectUser(remoteUserId)
        } else if (state === 'connected') {
            peers[remoteUserId].connected = true
        }
    };

    peerConnection.onconnectionstatechange = () => {
        log('Connection State: ' + peerConnection.connectionState);
    };

    log("Made peer connection")
}

async function onStart() {
    messageSendButton.disabled = false
    loadMessageHistory()

    if (!isListener) {
        toggleMicrophone(false)
    }
}

async function start(is_listener = false) {
    if (!ws) {
        alert("Cannot start WebRTC, websocket is not connected.")
        return
    }

    isListener = is_listener

    try {
        if (!is_listener) {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        } else {
            toggleCam.disabled = true
            toggleMic.disabled = true
        }
        
        ws.send(JSON.stringify({ type: 'join' }));

        onStart()

        WebRTCStarted = true
        log("Started WebRTC")
    } catch (error) {
        handleMediaError(error)
    }
}

async function onWebSocketRecieve(event) {
    if (!WebRTCStarted) {
        return
    }

    const data = JSON.parse(event.data)
    const { type, from, to, offer, answer, candidate } = data

    console.log(data)

    if (to) {
        if (to === userId) {
            log("Got personal WebSocket response - " + type)
        }
    } else {
        log("Got global WebSocket response - " + type)
    }

    if (type == "new-participant" && from != userId) {
        if (peers[from]) {
            disconnectUser(from)
        }

        await createOffer(from)
    } else if (type == "global-message") {
        if (from == userId) {
            return
        }

        await onMessageReceive(data)
    }

    if (!to == userId) {
        return
    }

    if (type == "offer") {
        await handleOffer(offer, from)
    } else if (type == "answer") {
        await peers[from].setRemoteDescription(new RTCSessionDescription(answer))
    } else if (type == "candidate") {
        await addIceCandidate(from, candidate)
    } else if (type == "webcam_stop") {
        removeStream("video", from)
    }
}

async function bindPermissionListeners() {
    const videoPermissionStatus = await navigator.permissions.query({ video: true })
    const micPermissionStatus = await navigator.permissions.query({ audio: true })


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

function onWebsocketOpen(event) {
    if (!ws) {
        return
    }

    log("Websocket connection established")

    connectAudio.disabled = false
    connectMic.disabled = false

    connectAudio.addEventListener("click", () => {
        connectAudio.disabled = true
        connectMic.disabled = true

        start(true)
    })

    connectMic.addEventListener("click", () => {
        connectAudio.disabled = true
        connectMic.disabled = true

        start()
    })
}

async function connectWebsocket(token) {
    await getMyUserId()

    ws = new WebSocket(`${protocol}//${host}/ws/signaling/${token}/`)

    ws.onopen = onWebsocketOpen

    ws.onmessage = (event) => {
        try {
            onWebSocketRecieve(event)
        } catch (error) {
            alert("An error occured while handling ws request!", error)
            document.location.reload()
        }
    }

    ws.onclose = (event) => {
        log(`WebSocket connection closed. Code: ${event.code}, reason: ${event.code != 1000 ? event.reason || "No reason given." : "Client initiated disconnect."}`, event.code != 1000 ? "warn" : "")
    }

    ws.onerror = (error) => {
        log("Websocket error (Check console for more)", "error")
        console.log("Websocker error: ", error)
    }

    currentToken = token

    connectBtn.disabled = true
    disconnectBtn.disabled = false
}

function disconnectWebsocket() {
    if (!ws) {
        return
    }

    ws.close()
    ws = null

    for (const [id, peer] of Object.entries(peers)) {
        disconnectUser(id)
    }

    removeStream("video", userId)

    disconnectBtn.disabled = true
    log("Disconnected")
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
    if (!WebRTCStarted || isListener) {
        return
    }

    if (!cameraEnabled) {
        turnCameraOn()
        toggleCam.innerHTML = "Turn camera off"
    } else {
        turnCameraOff()
        toggleCam.innerHTML = "Turn camera on"
    }
})

messageSendButton.addEventListener("click", () => {
    sendChatMessage()
})