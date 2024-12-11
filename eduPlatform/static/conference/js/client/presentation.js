const fileInput = document.getElementById("fileInput")

var presentationRunning = false
var presentingSelf = false

async function promptPresentationSelection() {
    if (!WebRTCStarted || presentationRunning) {
        return
    }

    fileInput.click()
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

    postFormHttpAsync(`/conference/api/upload-presentation/?token=${currentToken}`, formdata, true, (data) => {
        console.log(data)
    }, true)
}

fileInput.addEventListener("change", onFileSelection)