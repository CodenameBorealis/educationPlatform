const meeting_header = document.getElementById("meeting-header")
const meeting_list = document.getElementById("meeting-list")

async function getMyUserId() {
    userInfo = await getHttpAsync("/user/get_userinfo")
    json = await userInfo.json()

    if (!json || json["success"] == false) {
        log("Failed to fetch user data", "error")
        return
    }

    userId = json["data"]["user_id"]
}

function formatTimestamp(isoTimestamp) {
    const date = new Date(isoTimestamp)

    const hours = date.getHours()
    const minutes = date.getMinutes()

    return `${hours}:${minutes < 10 ? '0' + minutes : minutes}`
}

function addMeetingFrame(meetingData) {
    if (!meetingData) {
        return
    }

    var topText
    var isHappening = false
    const isHost = meetingData.host === userId

    if (!meetingData.started) {
        topText = "Hasn't started yet"
    } else if (meetingData.started && !meetingData.ended) {
        topText = "Happening right now"
        isHappening = true
    } else if (meetingData.started && meetingData.ended) {
        topText = `Ended at ${meetingData.end_time ? formatTimestamp(meetingData.end_time) : "?"}`
    }

    const frame = document.createElement("div")
    frame.classList.add("meeting", "p-3", "mb-3", "rounded")
    frame.innerHTML = `
        <div class="meeting-info">
            <span class="meeting-name d-block fw-bold">${meetingData.name}</span>
            <span class="meeting-host text-muted">Host: ${meetingData.host_name}</span>
        </div>
        <div class="meeting-controls d-flex justify-content-between align-items-center">
            <div class="meeting-time text-end">
                <span class="d-block text-muted ${isHappening ? "text-danger" : ""}">${topText}</span>
                <button class="btn btn-primary join-btn rounded-pill px-4">Join</button>
            </div>
        </div>
    `

    const joinBtn = frame.querySelector(".join-btn")

    if (isHappening) {
        joinBtn.classList.add("join-active")
    } else if (!isHost || meetingData.ended) {
        joinBtn.disabled = true
    }

    if (isHappening || (isHost && !isHappening)) {
        joinBtn.addEventListener("click", () => {
            document.location.assign(`/conference/web/${meetingData.token}`)
        })
    }

    meeting_list.appendChild(frame)
}

async function loadMeetings() {
    await getMyUserId()

    const request = await getHttpAsync("/conference/api/get-conferences/")
    if (!request) {
        console.error("Failed to load conference list")
        return
    }

    const conferences = await request.json()
    if (!conferences) {
        console.error("Failed to load conference json")
        return
    }

    const sortedConferences = conferences.sort((a, b) => {
        if (a.started !== b.started) {
          return a.started ? 1 : -1
        }
      
        if (a.ended !== b.ended) {
          return a.ended ? 1 : -1
        }
      
        if (a.ended && b.ended) {
          return new Date(b.end_time) - new Date(a.end_time)
        }
      
      })

    for (conference of sortedConferences) {
        addMeetingFrame(conference)
    }

    meeting_header.innerHTML = `Your meetings (${conferences.length})`
}

loadMeetings()