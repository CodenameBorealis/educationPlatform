const fileInput = document.getElementById("fileInput")

const presentationFrame = document.getElementById("presentation-frame")
const presentationSlide = document.getElementById("presentation-slide")

const presControls = document.getElementById("pres-controls")
const presPages = document.getElementById("pres-pages")

var presentationRunning = false
var presentingSelf = false

var fileSelectionDisabled = false

var currentPage = 0
var maxPages
var presentationToken

function loadPresentation() {
    if (isSharingScreen || !presentationRunning) {
        return
    }

    presentationFrame.style.display = "flex"

    if (presentingSelf) {
        presControls.style.display = "flex"
    }
}

function unloadPresentation() {
    presentationFrame.style.display = "none"

    if (presentingSelf) {
        presControls.style.display = "none"
    }
}

async function setPresentationPage(pageNumber) {
    if (!presentationRunning) {
        return
    }

    if (currentPage === pageNumber) {
        return
    }

    const slideImage = await getHttpAsync(`/conference/api/get-presentation-slide/?id=${presentationToken}&page=${pageNumber}`)
    if (!slideImage) {
        log("Failed to load slide image, check console for more info.", "error", false)
        return
    }

    const blob = await slideImage.blob()
    const urlObject = URL.createObjectURL(blob)

    presentationSlide.src = urlObject
    currentPage = pageNumber

    if (presentingSelf) { 
        presPages.innerHTML = `${pageNumber + 1}/${maxPages + 1}`

        ws.send(JSON.stringify({
            type: "page-switch",
            page: currentPage
        }))
    }
}

async function startPresentation(token) {
    if (!WebRTCStarted || presentationRunning) {
        return
    }

    const request = await getHttpAsync(`/conference/api/get-presentation-page-count/?id=${token}`)
    if (!request) {
        showAlert("Error", "Failed to start presentation.", "error")
        log("Failed to start presentation, get page count request failed.", "error", false)

        return
    }

    const json = await request.json()
    if (json.pages === null || json.pages < 0) {
        showAlert("Error", "Failed to start presentation.", "error")
        log("Failed to start presentation, get page count request doesn't contain pages field.", "error", false)

        return
    }

    presentationToken = token
    maxPages = Number(json.pages)
    currentPage = -1

    presentingSelf = true
    presentationRunning = true

    loadPresentation()
    setPresentationPage(0)

    showAlert("Presentation", "Loaded presentation.")

    presentationBtn.classList.add("control-on")

    ws.send(JSON.stringify({
        type: "start-presentation",
        token: token,
        page: currentPage
    }))
}

function stopPresentation() {
    if (!presentationRunning || !presentingSelf) {
        return
    }

    presentationRunning = false
    presentingSelf = false

    presentationBtn.classList.remove("control-on")

    unloadPresentation()

    ws.send(JSON.stringify({
        type: "stop-presentation",
    }))
}

async function promptPresentationSelection() {
    if (!WebRTCStarted || presentationRunning || isSharingScreen) {
        return
    }

    if (fileSelectionDisabled) {
        return
    }

    fileInput.click()
}

async function trackPresentationTask(task_id, updateCallback = (data) => {}, successCallback = (data) => {}, failCallback = (data) => {}) {
    if (!task_id) {
        return
    }

    var latestStatus = ""
    var updates = 0

    const update = async () => {
        const result = await getHttpAsync(`/conference/api/get-task-info/?id=${task_id}`)
        if (!result) {
            log("Failed to get task information.", "warn")
            return
        }
        
        const json = await result.json()

        if (json["status"] !== latestStatus) {
            latestStatus = json["status"]
            updateCallback(json)
        }

        if (updates > 60) {
            showAlert("Error", "Processing presentation took too long.", "error")
            clearInterval(interval)
            
            failCallback(json)

            return
        }

        if (latestStatus === "SUCCESS") {
            successCallback(json)
        } else if (json["failed"] === true || latestStatus === "HANDLER_FAILURE") {
            failCallback(json)

            showAlert("Error", `Failed to upload presentation: ${json["result"]["error"] || "No error message given."}`, 'error')
        } else {
            updates += 1
            setTimeout(update, 1000)
        }
    }

    update()
}

async function onFileSelection() {
    if (fileSelectionDisabled) {
        return
    }

    if (fileInput.files.length <= 0) {
        return
    }

    if (!isHost) {
        return
    }

    fileSelectionDisabled = true

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
        fileSelectionDisabled = false

        return
    }

    log(`Presentation task started successfully, task id: ${task_id}, token: ${file_token}`)
    trackPresentationTask(
        task_id,
        (data) => {
            const text = infoFrame.querySelector(".status")
            text.innerHTML = data.result ? data.result.message : data.status
        },
        (data) => {
            infoFrame.remove()
            startPresentation(file_token)
            fileSelectionDisabled = false
        },
        (data) => {
            infoFrame.remove()
            fileSelectionDisabled = false
        }
    )
}

fileInput.addEventListener("change", onFileSelection)