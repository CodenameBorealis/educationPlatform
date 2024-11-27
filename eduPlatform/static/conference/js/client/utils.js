const logFrame = document.getElementById("logs");
var userId

function log(message, type = "LOG", consoleBased=false) {
    const textContent = `[${new Date().toLocaleTimeString()}] - [${type.toUpperCase()}]: ${message}`;
    
    if (consoleBased) {
        console.log(textContent);
        return;
    }

    const logEntry = document.createElement('span');
    const lineBreak = document.createElement('br');

    logEntry.innerHTML = textContent;

    if (type == "warn") {
        logEntry.style.color = "rgb(255, 255, 0)";
        logEntry.style.fontWeight = "bold";
    } else if (type == "error") {
        logEntry.style.color = "rgb(255, 0, 0)";
        logEntry.style.fontWeight = "bold";
    }

    logFrame.appendChild(logEntry);
    logFrame.appendChild(lineBreak);
}

function handleMediaError(error) {
    switch (error.name) {
        case 'NotAllowedError':
            console.error('Permission denied: User blocked camera/microphone.');
            alert('You need to allow access to the respective resource to use this feature.');
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
            console.error('Error:', error);
            alert('An unknown error occurred while processing your request, check console for more.');
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

function removeStream(type, id) {
    const stream = document.getElementById(`${type}-${id}`)

    if (!stream) {
        return
    }

    stream.remove()
    stream.srcObject = null
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
    remoteVideo.classList.add("video-frame")

    document.getElementById("videos").appendChild(remoteVideo)
}