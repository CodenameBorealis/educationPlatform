const connectBtn = document.getElementById("connect")
const token = document.getElementById("room-token")

const disconnectBtn = document.getElementById("disconnect")

const sendBtn = document.getElementById("send")
const data = document.getElementById("data")

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws'
const host = window.location.host

var ws

function log(message) {
    const _reply = document.createElement('span');
    _reply.textContent = message;
    
    const lineBreak = document.createElement('br');
    reply.appendChild(_reply);
    reply.appendChild(lineBreak);
}

function connect(token) {
    ws = new WebSocket(`${protocol}//${host}/ws/signaling/${token}/`)

    ws.onopen = () => {
        log("WebSocket connection opened")
    }

    ws.onmessage = (event) => {
        log("Recieved: " + event.data)
    }

    ws.onclose = (event) => {
        log("WebSocket connection closed")
        disconnect()
    }

    ws.onerror = (error) => {
        log("Websocket error" + error.message)
    }

    connectBtn.disabled = true
    disconnectBtn.disabled = false
}

function disconnect() {
    if (!ws) {
        return
    }

    ws.close()
    ws = null

    disconnectBtn.disabled = true
    connectBtn.disabled = false
}

function sendData(data) {
    if (!data || !ws) {
        return
    }

    ws.send(data)
}

disconnectBtn.disabled = true

connectBtn.addEventListener("click", () => {
    if (!token.value || ws) {
        return
    }

    connect(token.value)
})

sendBtn.addEventListener("click", () => {
    if (!data.value) {
        return
    }

    sendData(data.value)
})    

disconnectBtn.addEventListener("click", () => {
    if (!ws) {
        return
    }

    disconnect()
})