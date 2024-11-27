const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws'
const host = window.location.host

var WebRTCStarted = false
var isListener = false

var localStream

var peers = {}
var candidateQueue = {}

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

async function renegotiatePeerWebcam(remoteUserId, videoTrack, stream) {
    const peer = peers[remoteUserId]
    const sender = peer.addTrack(videoTrack, stream)
    peer.videoCamSender = sender

    await createOffer(remoteUserId)
}

function peerAddScreenShareStream(peer, stream) {
    const audioSender = peer.addTrack(stream.getAudioTracks()[0], stream)
    const videoSender = peer.addTrack(stream.getVideoTracks()[0], stream)

    stream.audioSender = audioSender
    stream.videoSender = videoSender
}

async function onPeerConnected(peer, remoteUserId) {
    log("Running initial sync after connection.")

    if (cameraEnabled) {
        if (!webcamTrack) {
            log("Webcam track is not found.", "warn")
            return
        }

        renegotiatePeerWebcam(remoteUserId, webcamTrack, localStream)
    }
}

function onPeerCreation(peerConnection, remoteUserId) {
    if (candidateQueue[remoteUserId]) {
        candidateQueue[remoteUserId].forEach(candidate => addIceCandidate(remoteUserId, candidate));
        delete candidateQueue[remoteUserId];
    }

    if (!isListener) {
        localStream.getAudioTracks().forEach((track) => peerConnection.addTrack(track, localStream))
    } else {
        peerConnection.addTrack = function (...args) {
            throw new Error("Track addition is not allowed in listener mode.")
        }
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
        console.log(event.streams[0].id)

        if (event.track.kind === "audio") {
            addAudio(remoteUserId, event.streams[0])
        } else if (event.track.kind === "video") {
            addVideo(remoteUserId, event.streams[0])
        }
    }

    onPeerCreation(peerConnection, remoteUserId)

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
        if (peerConnection.connectionState === "connected") {
            onPeerConnected(peerConnection, remoteUserId)
        }

        log('Connection State: ' + peerConnection.connectionState);
    };

    log("Made peer connection")
}

async function onWebRTCStart() {
    messageSendButton.disabled = false
    loadMessageHistory()

    if (!isListener) {
        toggleMicrophone(false)
    }
}

async function startWebRTC(is_listener = false) {
    if (!ws) {
        alert("Cannot start WebRTC, websocket is not connected.")
        return
    }

    isListener = is_listener

    try {
        if (!is_listener) {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
            console.log(localStream)
        } else {
            toggleCam.disabled = true
            toggleMic.disabled = true
        }

        ws.send(JSON.stringify({ type: 'join' }));

        onWebRTCStart()

        WebRTCStarted = true
        log("Started WebRTC")
    } catch (error) {
        handleMediaError(error)
    }
}