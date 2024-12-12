const fileInput = document.getElementById("fileInput")

var presentationRunning = false
var presentingSelf = false

async function promptPresentationSelection() {
    if (!WebRTCStarted || presentationRunning) {
        return
    }

    fileInput.click()
}

async function trackPresentationTask(task_id, updateCallback = (data) => {}, successCallback = (data) => {}, failCallback = (data) => {}) {
    if (!task_id) {
        return
    }

    var latestStatus = ""
    var interval
    var updates = 0

    const update = async () => {
        updates += 1

        const result = await getHttpAsync(`/conference/api/get-task-info/?id=${task_id}`)
        if (!result) {
            log("Failed to get task information.", "warn")
            return
        }
        
        const json = await result.json()

        if (json["status"] == latestStatus) {
            return
        }

        latestStatus = json["status"]
        updateCallback(json)

        if (updates > 120) {
            showAlert("Error", "Processing presentation took too long.", "error")
            clearInterval(interval)
            
            failCallback(json)

            return
        }

        if (latestStatus === "SUCCESS") {
            successCallback(json)
            clearInterval(interval)
        } else if (json["failed"] === true) {
            failCallback(json)

            showAlert("Error", `Failed to upload presentation: ${json["result"]["message"] || "No error message given."}`)
            clearInterval(interval)
        }
    }

    interval = setInterval(update, 500)
}

async function onFileSelection() {
    if (fileInput.files.length <= 0) {
        return
    }

    if (!isHost) {
        return
    }

    const file = fileInput.files[0]
    const formdata = new FormData()
    formdata.append('file', file)

    const infoFrame = document.createElement("div")
    infoFrame.classList.add("alert")
    infoFrame.innerHTML = `
        <div class="message">
            <strong>Uploading presentation</strong>
            <p class="status">Uploading</p>
        </div>
        <div class="loading-circle">
            <img src="/static/conference/img/loading.png" alt="">
        </div>
    `

    alertContainer.appendChild(infoFrame)

    const json = await postFormHttpAsync(`/conference/api/upload-presentation/?token=${currentToken}`, formdata, true)
    if (!json) {
        infoFrame.remove()
        showAlert("Error", "Something went wrong while trying to upload the presentation.", "error")

        return
    }

    const { success, task_id, file_token} = json
    if (!success) {
        showAlert("Error", "Server failed to process the request.", "error")
        return
    }

    log(`Presentation task started successfully, task id: ${task_id}, file token: ${file_token}`)
    trackPresentationTask(
        task_id,
        (data) => {
            const text = infoFrame.querySelector(".status")
            text.innerHTML = data.result ? data.result.message : data.status
        },
        (data) => {
            infoFrame.remove()
            showAlert("Success", "Success")
        },
        (data) => {
            infoFrame.remove()
        }
    )
}

fileInput.addEventListener("change", onFileSelection)