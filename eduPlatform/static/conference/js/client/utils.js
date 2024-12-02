const logFrame = document.getElementById("logs");
var userId, hostId, isHost

const consoleBasedLogs = false
const verboseLogsEnabled = true

function log(message, type = "LOG", is_verbose=true) {
    if (is_verbose && !verboseLogsEnabled) {
        return
    }

    const textContent = `[${new Date().toLocaleTimeString()}] - [${type.toUpperCase()}]: ${message}`;
    
    if (consoleBasedLogs) {
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
        log("Failed to fetch user data", "error")
        return
    }

    userId = json["data"]["user_id"]
}

async function getHostInfo(token) {
    if (!userId) {
        getMyUserId()
    }

    hostInfo = await getHttpAsync(`/conference/api/get-host/?token=${token}`)
    json = await hostInfo.json()

    if (!json || json["success"] == false) {
        log("Failed to fetch conference host data", "error")
        return
    }

    hostId = json["host"]
    isHost = hostId == userId
}

function removeStream(type, id) {
    const stream = document.getElementById(`${type}-${id}`)

    if (!stream) {
        return
    }

    stream.remove()
    stream.srcObject = null
}

async function awaitMapEntry(map, key, timeout = 5000) {
    if (map.has(key)) {
        return map.get(key);
    }

    if (!awaitMapEntry.resolvers) {
        awaitMapEntry.resolvers = new Map();
    }

    if (!awaitMapEntry.resolvers.has(key)) {
        awaitMapEntry.resolvers.set(key, []);
    }

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            const resolvers = awaitMapEntry.resolvers.get(key) || [];
            awaitMapEntry.resolvers.set(
                key,
                resolvers.filter((r) => r !== resolve)
            );

            reject(new Error(`Timeout: No entry for key "${key}" within ${timeout}ms`));
        }, timeout);

        awaitMapEntry.resolvers.get(key).push(resolve);

        const checkMap = () => {
            if (map.has(key)) {
                clearTimeout(timeoutId);
                const value = map.get(key);

                const resolvers = awaitMapEntry.resolvers.get(key) || [];
                resolvers.forEach((r) => r(value));

                awaitMapEntry.resolvers.delete(key);
            }
        };

        if (!awaitMapEntry.listenersAdded) {
            awaitMapEntry.listenersAdded = true;

            map.onUpdate = () => {
                for (const key of awaitMapEntry.resolvers.keys()) {
                    checkMap(key);
                }
            };
        }
    });
}