const connectBtn = document.getElementById("connect")
const disconnectBtn = document.getElementById("disconnect")

const tokenInput = document.getElementById("room-token")

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws'
const host = window.location.host

var ws, localStream, currentToken
var peers = {}

function log(message) {
    const _reply = document.createElement('span');
    _reply.textContent = message;

    const lineBreak = document.createElement('br');
    reply.appendChild(_reply);
    reply.appendChild(lineBreak);
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

    alert("Please make sure that you gave access to the microphone and camera in order to access this page.")
    document.location.reload()
}

function generateUserId() {
    log("Generated local user id")

    if (!localStorage.getItem('userId')) {
        localStorage.setItem('userId', 'user-' + Math.random().toString(36).substring(2, 15));
    }
    return localStorage.getItem('userId');
}

function getMyUserId() {
    return localStorage.getItem('userId');
}

function createPeerConnection(remoteUserId) {
    const configuration = {
        iceServers: [
            { urls: 'stun:turn.demodeck.ru:3478' },
            { 
                urls: 'turn:turn.demodeck.ru:3478',
                username: 'turnServerUser',
                credential: '3nDHFUy034TdVF2fd7fgd8df32jfgs4sh5937290'
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
                from: getMyUserId()
            }))
            log("Sent ice candidate")
        }
    }

    peerConnection.ontrack = (event) => {
        if (event.track.kind != "video") {
            return
        }

        const remoteVideo = document.createElement('video')

        remoteVideo.srcObject = event.streams[0]
        remoteVideo.autoplay = true
        remoteVideo.id = `video-${remoteUserId}`
        
        document.getElementById("videos").appendChild(remoteVideo)
    }

    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))

    peers[remoteUserId] = peerConnection

    peerConnection.oniceconnectionstatechange = () => {
        log('ICE Connection State: ' + peerConnection.iceConnectionState);

        const state = peerConnection.iceConnectionState;
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

function disconnectUser(userId) {
    if (peers[userId]) {
        peers[userId].close();
        delete peers[userId];
    }
    
    const videoStream = document.getElementById(`video-${userId}`)
    if (videoStream) {
        videoStream.remove()
    }
}

async function handleOffer(offer, remoteUserId) {
    if (!peers[remoteUserId]) {
        createPeerConnection(remoteUserId)
    }

    await peers[remoteUserId].setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await peers[remoteUserId].createAnswer()
    await peers[remoteUserId].setLocalDescription(answer)

    ws.send(JSON.stringify({
        type: 'answer',
        to: remoteUserId,
        from: getMyUserId(),
        answer
    }))

    log("Handled offer from " + remoteUserId + " and sent an answer")
}

async function createOffer(remoteUserId) {
    if (!peers[remoteUserId]) {
        createPeerConnection(remoteUserId);
    }

    const offer = await peers[remoteUserId].createOffer()
    await peers[remoteUserId].setLocalDescription(offer)

    ws.send(JSON.stringify({
        type: 'offer',
        to: remoteUserId,
        from: getMyUserId(),
        offer
    }));

    log("Sent offer")
}

async function start() {
    if (!ws) {
        alert("Cannot start WebRTC, websocket is not connected.")
        return
    }

    try {
        const localVideo = document.getElementById("localvideo")
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        localVideo.autoplay = true
        localVideo.muted = true
        localVideo.srcObject = localStream;

        ws.send(JSON.stringify({ type: 'join', userId: generateUserId() }));
        log("Started WebRTC")
    } catch (error) {
        handleMediaError(error)
    }
}

async function addIceCandidate(from, candidate) {
    log("From " + from)
    log("Candidate " + candidate)

    if (!from || !candidate) {
        return
    }

    log("Got ICE candidate from " + from)

    if (!peers[from]) {
        log("Peer connection not found")
    }

    const _candidate = new RTCIceCandidate(candidate)
    peers[from].addIceCandidate(_candidate).then(() => {
        log("ICE candidate added")
    }).catch((error) => {
        alert(error)
        log("Error adding ICE candidate")
    })

}

async function onWebSocketRecieve(event) {
    const data = JSON.parse(event.data)
    const { type, from, to, offer, answer, candidate } = data

    if (to) {
        if (to === getMyUserId()) {
            log("Got personal WebSocket response - " + type)
        }
    } else {
        log("Got global WebSocket response - " + type)
    }

    if (type === "new-participant" && from !== getMyUserId()) {
        await createOffer(from)
    } else if (type === "offer" && to === getMyUserId()) {
        await handleOffer(offer, from)
    } else if (type === "answer" && to === getMyUserId()) {
        if (peers[from].connected) {
            return
        }

        await peers[from].setRemoteDescription(new RTCSessionDescription(answer))
    } else if (type === "candidate" && to === getMyUserId()) {
        await addIceCandidate(from, candidate)
    }
}

function connectWebsocket(token) {
    ws = new WebSocket(`${protocol}//${host}/ws/signaling/${token}/`)

    ws.onopen = () => {
        log("WebSocket connection established!")
        start()
    }

    ws.onmessage = (event) => {
        try {
            onWebSocketRecieve(event)
        } catch (error) {
            alert("An error occured while handling ws request!", error)
            document.location.reload()
        }
    }

    ws.onclose = (event) => {
        log("WebSocket connection closed")
        disconnectWebsocket()
    }

    ws.onerror = (error) => {
        log("Websocket error" + error.message)
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

    document.location.reload()
}

function sendWebsocketData(data) {
    if (!data || !ws) {
        return
    }

    ws.send(data)
}


disconnectBtn.disabled = true

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