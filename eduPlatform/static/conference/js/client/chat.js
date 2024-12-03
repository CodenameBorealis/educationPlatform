const messageInput = document.getElementById("chat-input")

async function loadMessageHistory() {
    try {
        const history = await getHttpAsync(`/conference/api/get-message-history/?token=${currentToken}`)
        const json = await history.json()

        log("Loading message history.")

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

            addChatMessage(username, user_id, content, timestamp, true)
        }
    } catch (error) {
        log("Failed to load message history, please check console for more.", "error")
        console.log(error)
    }
}

function addChatMessage(username, user_id = -1, message, timestamp, noSound = false) {
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
            <span class="username">
                <img src="/user/get_pfp/?user_id=${user_id}" class="message-pfp">
                ${username == "?self" ? "You" : username}
            </span>
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

    if (chatBody.scrollHeight > chatBody.clientHeight) {
        chatBody.scrollTop = chatBody.scrollHeight
    }

    log("Added message.")
}

async function onMessageReceive(data) {
    const { from, content, timestamp } = data
    const username = await getUsernameFromID(from)

    addChatMessage(username, from, content, timestamp)
}

function sendChatMessage(content) {
    if (!WebRTCStarted) {
        return
    }

    const message = messageInput.value
    if (!message || message === "") {
        return
    }

    addChatMessage("?self", -1, message)
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
