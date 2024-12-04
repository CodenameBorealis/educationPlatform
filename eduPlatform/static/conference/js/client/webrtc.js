const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws'
const host = window.location.host

var WebRTCStarted = false
var isListener = false

var localStream

var peers = {}
var peerData = {}

var candidateQueue = {}

function disconnectUser(userId) {
    if (peers[userId]) {
        peers[userId].close();
        delete peers[userId];
    }

    removeStream("audio", userId)
    removeStream("video", userId)

    removeUser(userId)

    log(`Closed peer connection with user-${userId}`)
}

async function handleOffer(offer, remoteUserId, is_listener=false, default_media_id) {
    if (!peers[remoteUserId]) {
        await createPeerConnection(remoteUserId)
    }

    const peer = peers[remoteUserId]

    await peer.setRemoteDescription(new RTCSessionDescription(offer))

    const answer = await peer.createAnswer()
    await peer.setLocalDescription(answer)

    peer.isListener = is_listener
    if (!is_listener) {
        await setPeerDefaultMediaStream(remoteUserId, default_media_id)
    }

    ws.send(JSON.stringify({
        type: 'answer',
        to: Number(remoteUserId),
        answer
    }))

    log("Handled offer from " + remoteUserId + " and sent an answer")
}

async function createOffer(remoteUserId) {
    if (!peers[remoteUserId]) {
        await createPeerConnection(remoteUserId);
    }

    const offer = await peers[remoteUserId].createOffer(isListener ? { offerToReceiveVideo: true, offerToReceiveAudio: true } : {})
    await peers[remoteUserId].setLocalDescription(offer)

    ws.send(JSON.stringify({
        type: 'offer',
        to: Number(remoteUserId),
        is_listener: isListener,
        default_media_id: !isListener ? localStream.id : null,
        offer
    }));

    log("Sent offer to user-" + remoteUserId)
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
        log("Error adding ICE candidate", "error")
        console.log("Error: ", error)
    })

}

async function onPeerConnected(peer, remoteUserId) {
    log("Running initial sync after connection.")

    var areChangesMade = false

    if (cameraEnabled) {
        if (!webcamTrack) {
            log("Webcam track is not found.", "warn")
        } else {
            areChangesMade = true
            peerAddWebcam(remoteUserId, webcamTrack, localStream)
        }
    }

    if (screenShareSelf) {
        if (!screenShareStream) {
            log("Screenshare track not found.", "warn")
        } else {
            areChangesMade = true

            ws.send(JSON.stringify({
                to: remoteUserId,
                type: "start-screenshare",
                mediaId: screenShareStream.id
            }))
            
            peerAddScreenShareStream(peer, screenShareStream)
        }
    }

    if (areChangesMade) {
        await createOffer(remoteUserId)
    }

    updateUserStatus(remoteUserId, peer.isListener ? "is-listener" : "is-muted")

    ws.send(JSON.stringify({
        type: "toggle-microphone",
        to: remoteUserId,
        status: microphoneEnabled
    }))
}

async function onPeerCreation(peerConnection, remoteUserId) {
    if (candidateQueue[remoteUserId]) {
        candidateQueue[remoteUserId].forEach(candidate => addIceCandidate(remoteUserId, candidate));
        delete candidateQueue[remoteUserId];
    }

    if (!isListener) {
        const micTrack = localStream.getAudioTracks()[0]
        const sender = peerConnection.addTrack(micTrack, localStream)

        peerConnection.userMicSender = sender
    } else {
        peerConnection.addTrack = function (...args) {
            throw new Error("Track addition is not allowed in listener mode.")
        }
    }

    await addUserToList(remoteUserId)
}

async function createPeerConnection(remoteUserId) {
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
    
    peerConnection.streamMap = new Map()
    peerConnection.streamMap.onUpdate = () => {}

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

    peerConnection.ontrack = async (event) => {
        try {
            log("Incoming track stream " + event.streams[0].id)

            const defaultMediaStreamId = await awaitMapEntry(peerConnection.streamMap, "default_stream", 10000)

            if (event.streams[0].id === defaultMediaStreamId) {
                if (event.track.kind === "audio") {
                    addAudio(remoteUserId, event.streams[0])
                } else if (event.track.kind === "video") {
                    addVideo(remoteUserId, event.streams[0])
                }

                return
            }

            const screenshareMediaStreamId = await awaitMapEntry(peerConnection.streamMap, "screenshare_stream", 10000)

            if (event.streams[0].id === screenshareMediaStreamId) {
                if (event.track.kind === "video") {
                    loadScreenShare(event.streams[0])
                }
            }
        } catch (error) {
            log("Failed to process onTrack, check console for errors.", "error")
            console.log(error)
        }
    }

    await onPeerCreation(peerConnection, remoteUserId)

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
            onPeerConnected(peers[remoteUserId], remoteUserId)
        }

        log('Connection State: ' + peerConnection.connectionState);
    };

    log("Made peer connection")
}

function setPeerDefaultMediaStream(remoteUserId, id) {
    if (!id) {
        return
    }

    const peer = peers[remoteUserId]
    if (!peer) {
        return
    }

    peer.streamMap.set("default_stream", id)
    peer.streamMap.onUpdate()

    log("Set default remote stream id for user " + remoteUserId + " to " + id)
}

async function connectUser(remoteUserId, defaultMediaStreamId, isListener=false) {
    log("Connecting user-" + remoteUserId)

    await createOffer(remoteUserId)
    const peer = peers[remoteUserId]

    peer.streamMap.set("default_stream", defaultMediaStreamId)
    peer.streamMap.onUpdate()

    peer.isListener = isListener

    log("Set default stream id to " + defaultMediaStreamId)
}

async function onWebRTCStart() {
    log("onWebRTCStart is not implemented.", "warn", false)
}

async function startWebRTC(is_listener = false) {
    if (!ws) {
        log("Cannot start WebRTC, websocket is not connected.", "error")
        showAlert("Error", "Connection with server was lost, please refresh the page to reconnect.", "error")

        return
    }

    isListener = is_listener

    try {
        if (!is_listener) {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
            await loadMicrophoneSelector()
        }

        ws.send(JSON.stringify({
            type: 'new-participant',
            default_media: !isListener ? localStream.id : null,
            is_listener: is_listener
        }));

        onWebRTCStart()

        WebRTCStarted = true
        log("Started WebRTC")

        return true
    } catch (error) {
        handleMediaError(error)
        return false
    }
} 