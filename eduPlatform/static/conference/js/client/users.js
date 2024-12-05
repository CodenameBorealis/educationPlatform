async function addUserToList(userId) {
    const username = await getUsernameFromID(userId)
    const isHost = hostId == userId

    const frame = document.createElement("div")
    frame.classList.add("user")
    frame.id = `user-${userId}`

    frame.innerHTML = `
        <div class="profile-pic">
            <img src="/user/get_pfp/?user_id=${userId}" alt="" class="user-pic">
            <img src="/static/conference/img/mic_muted.png" alt="" class="status-icon red is-muted">
            <img src="/static/conference/img/microphone.png" alt="" class="status-icon normal is-unmuted">
            <img src="/static/conference/img/headphones.png" alt="" class="status-icon normal is-listener">
            <img src="/static/conference/img/connection.png" alt="" class="status-icon red reconnecting">
            <img src="/static/conference/img/disconnected.png" alt="" class="status-icon red failed">
        </div>
        <span>${username}</span>
        ${isHost ? `<img src="/static/conference/img/crown.png" alt="" class="host-icon">` : ''}
    `

    document.getElementById("user-list").appendChild(frame)
}

function updateUserStatus(userId, status) {
    const frame = document.getElementById(`user-${userId}`)
    if (!frame) {
        return
    }

    const possibleStates = [
        'is-muted', 'is-unmuted', 'is-listener', 'failed', 'reconnecting'
    ]
    
    if (!possibleStates.includes(status)) {
        log(`Invalid user status given. (${status})`, "warn")
        return
    }

    for (state of possibleStates) {
        const icon = frame.querySelector("." + state)
        icon.style.display = state == status ? "block" : "none"
    }
}

function removeUser(userId) {
    const frame = document.getElementById(`user-${userId}`)
    if (!frame) {
        return
    }

    frame.remove()
}