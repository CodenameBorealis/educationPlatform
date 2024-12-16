const fileInput = document.getElementById("fileInput")

const presentationFrame = document.getElementById("presentation-frame")
const presentationSlide = document.getElementById("presentation-slide")

const presControls = document.getElementById("pres-controls")
const presPages = document.getElementById("pres-pages")

const pointer = document.getElementById('pointer');

var presentationRunning = false
var presentingSelf = false

var fileSelectionDisabled = false

var currentPage = 0
var maxPages
var presentationToken

var presentingUser

var mouseTrackingEnabled = false
var mouseTrackingInterval

var isInterpolating = false;
var currentPosition = { x: 0, y: 0}
var targetPosition = { x: 0, y:0 }
var animationFrame

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
    presControls.style.display = "none"
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

    startMouseTracking()

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

    stopMouseTracking()
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

        if (updates > 180) {
            showAlert("Error", "Processing presentation took too long.", "error")
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

function updateMouse(event) {
    if (!mouseTrackingEnabled) {
        return
    }

    const frameRect = document.getElementById('presentation-frame').getBoundingClientRect()
    const imageRect = document.getElementById('presentation-slide').getBoundingClientRect()

    const mouseXInFrame = event.clientX - frameRect.left
    const mouseYInFrame = event.clientY - frameRect.top

    const imageRatioX = imageRect.width / frameRect.width
    const imageRatioY = imageRect.height / frameRect.height

    const mouseXInImage = mouseXInFrame * imageRatioX
    const mouseYInImage = mouseYInFrame * imageRatioY

    const pointer = document.getElementById('pointer')
    pointer.style.left = `${mouseXInFrame}px`
    pointer.style.top = `${mouseYInFrame}px`
    pointer.style.transform = 'translate(-50%, -50%)'

    const relativeX = mouseXInImage / imageRect.width
    const relativeY = mouseYInImage / imageRect.height
    currentPosition = { x: relativeX, y: relativeY }

    console.log(currentPosition)
}

function startMouseTracking() {
    const updateTime = 1000 / 30 // 15 fps

    mouseTrackingEnabled = true
    mouseTrackingInterval = setInterval(() => {
        ws.send(JSON.stringify({
            type: "update-cursor",
            x: currentPosition.x,
            y: currentPosition.y
        }))
    }, updateTime);
}

function stopMouseTracking() {
    mouseTrackingEnabled = false

    clearInterval(mouseTrackingInterval)
    mouseTrackingInterval = null
}

function interpolateCursor() {
    if (!isInterpolating || mouseTrackingEnabled) {
        return
    }
    
    const speed = 0.1

    currentPosition.x += (targetPosition.x - currentPosition.x) * speed
    currentPosition.y += (targetPosition.y - currentPosition.y) * speed

    pointer.style.left = `${currentPosition.x * 100}%`
    pointer.style.top = `${currentPosition.y * 100}%`

    animationFrame = requestAnimationFrame(interpolateCursor)
}

function updateInterpolation(x, y) {
    if (!x || !y) {
        return
    }

    targetPosition = { x: x, y: y }
}

function startInterpolation() {
    isInterpolating = true
    interpolateCursor()
}

function stopInterpolation() {
    isInterpolating = false
    cancelAnimationFrame(animationFrame)
}

fileInput.addEventListener("change", onFileSelection)

presentationFrame.addEventListener("mousemove", updateMouse)