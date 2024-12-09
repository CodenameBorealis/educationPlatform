const endCountdown = document.getElementById("end-countdown")
var endCountdownInterval

var userId, hostId, isHost, conferenceInfo

var consoleBasedLogs = true
var verboseLogsEnabled = true

var _text_overlay_shown = false
var _text_overlay_handler = ""

function log(message, type = "LOG", is_verbose = true) {
    if (is_verbose && !verboseLogsEnabled) {
        return
    }

    if (type === "") {
        type = "LOG"
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
            showAlert('Error', 'You need to allow access to the respective resource to use this feature.', 'error');
            break;
        case 'NotFoundError':
            console.error('No media devices found.');
            showAlert('Error', 'No camera or microphone detected. Please connect one and try again.', 'error');
            break;
        case 'OverconstrainedError':
            console.error('Constraints cannot be satisfied by available devices.');
            showAlert('Error', 'Requested media constraints are not supported.', 'error');
            break;
        default:
            console.error('Error:', error);
            showAlert('Error', 'An unknown error occurred while processing your request, check console for more.', 'error');
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

async function getConferenceInfo(token) {
    if (!userId) {
        getMyUserId()
    }

    hostInfo = await getHttpAsync(`/conference/api/get-data/?token=${token}`)
    json = await hostInfo.json()

    if (!json || json["success"] == false) {
        log("Failed to fetch conference host data", "error")
        return
    }

    hostId = json["host"]
    isHost = hostId == userId

    conferenceInfo = json
}

async function getUsernameFromID(id) {
    const usernameRequest = await getHttpAsync(`/user/get_username/?user_id=${id}`)
    const json = await usernameRequest.json()

    if (!json["success"]) {
        log("Failed to get username for the received message!")
        return
    }

    return json["data"]["username"] || ""
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

function showTextOverlay(topText = "", bottomText = "", customHandlerName, handlerData) {
    if (_text_overlay_shown && customHandlerName != _text_overlay_handler) {
        hideTextOverlay()
    }

    const overlay = document.getElementById("textOverlay")
    const header = overlay.querySelector(".header")
    const bottom = overlay.querySelector(".bottom-text")

    const customHandlers = {
        "waiting-host": () => {
            const waiting_div = overlay.querySelector(".waiting-host")
            const pfp = waiting_div.querySelector("img")

            waiting_div.style.display = "flex"
            pfp.src = `/user/get_pfp/?user_id=${handlerData["host_id"]}`
        },
        "start-prompt-host": () => {
            document.getElementById("start-conference-btn").style.display = "block"
        },
        "yes-no-timed": () => {
            const frame = overlay.querySelector(".yes-no-timed")
            const yes = overlay.querySelector(".btn-yes")
            const no = overlay.querySelector(".btn-no")

            var seconds = handlerData["delay"]
            var timeout

            frame.style.display = "flex"

            const countdown = () => {
                seconds -= 1
                yes.disabled = true

                if (seconds > 0) {
                    timeout = setTimeout(countdown, 1000)
                    yes.innerHTML = `Yes (${seconds})`
                } else {
                    yes.innerHTML = "Yes"
                    yes.disabled = false
                }
            }

            yes.addEventListener("click", () => {
                if (timeout) {
                    clearTimeout(timeout)
                }

                if (handlerData["yes"]) handlerData["yes"]()
                hideTextOverlay()
            })

            no.addEventListener("click", () => {
                if (timeout) {
                    clearTimeout(timeout)
                }

                if (handlerData["no"]) handlerData["no"]()
                hideTextOverlay()
            })

            countdown()
        }
    }

    header.innerHTML = topText
    bottom.innerHTML = bottomText

    if (customHandlers[customHandlerName]) {
        customHandlers[customHandlerName]()
        _text_overlay_handler = customHandlerName
    }

    if (!_text_overlay_shown) {
        overlay.classList.add("active")
        _text_overlay_shown = true
    }
}

function hideTextOverlay() {
    const overlay = document.getElementById("textOverlay")
    overlay.classList.remove("active")

    const handlerCleaners = {
        "waiting-host": () => {
            const waiting_div = overlay.querySelector(".waiting-host")
            waiting_div.style.display = "none"
        },
        "start-prompt-host": () => {
            document.getElementById("start-conference-btn").style.display = "none"
        },
        "yes-no-timed": () => {
            const frame = overlay.querySelector(".yes-no-timed")
            const yes = overlay.querySelector(".btn-yes")
            const no = overlay.querySelector(".btn-no")

            frame.style.display = "none"
        }
    }

    _text_overlay_shown = false

    if (_text_overlay_handler !== "" && handlerCleaners[_text_overlay_handler]) {
        handlerCleaners[_text_overlay_handler]()
        _text_overlay_handler = ""
    }
}

function updateElapsedTime() {
    const now = new Date()
    const start = new Date(conferenceInfo["start_time"])
    const elapsedMs = now - start

    if (elapsedMs < 0) {
        document.getElementById("conference-duration").textContent = ""
        return
    }

    const seconds = Math.floor((elapsedMs / 1000) % 60)
    const minutes = Math.floor((elapsedMs / (1000 * 60)) % 60)
    const hours = Math.floor(elapsedMs / (1000 * 60 * 60))

    if (hours > 0) {
        document.getElementById("conference-duration").textContent = `${hours}:${minutes}:${seconds}`
    } else {
        document.getElementById("conference-duration").textContent = `${minutes}:${seconds}`
    }

    if (conferenceInfo.max_duration <= 0) {
        return
    }

    const currentTime = new Date();
    const startTime = new Date(conferenceInfo.start_time)
    const endTime = new Date(startTime.getTime() + conferenceInfo.max_duration * 60 * 1000)
    
    const remainingTime = endTime - currentTime;
    const minutesLeft = Math.floor(remainingTime / (60 * 1000))

    if (minutesLeft > 0 && minutesLeft <= 15 && !endCountdownInterval && WebRTCStarted) {
        endCountdown.style.display = "block"
        endCountdownInterval = setInterval(updateEndTime, 1000)
    }
}

function updateEndTime() {
    const currentTime = new Date();
    
    const startTime = new Date(conferenceInfo.start_time)
    const endTime = new Date(startTime.getTime() + conferenceInfo.max_duration * 60 * 1000)

    const timeLeft = Math.max(0, (endTime - currentTime) / 1000)

    if (timeLeft <= 0) {
        clearInterval(endCountdownInterval)
        endCountdown.innerHTML = "The time has ran out, this conference will end shortly."

        return
    }

    const minutes = Math.floor(timeLeft / 60)
    const seconds = Math.floor(timeLeft % 60)
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

    endCountdown.innerHTML = `${formattedTime} is left until this conference ends.`
}

document.addEventListener("DOMContentLoaded", () => {
    const btnControl = document.querySelector(".drop-up-btn");
    const dropupMenu = document.querySelector(".dropup-menu");

    btnControl.addEventListener("click", () => {
        dropupMenu.style.display = dropupMenu.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", (e) => {
        if (!btnControl.contains(e.target)) {
            dropupMenu.style.display = "none";
        }
    });
});