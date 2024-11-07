function getHttpAsync(url) {
    let xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", url, false);
    xmlHttp.send(null);
    return JSON.parse(xmlHttp.responseText);
}

async function postHttpAsync(url, data = {}, await_for_response = false, callback = function (data) {}, await_for_json = true) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': "application/json",
                'X-CSRFToken': csrftoken || ""
            }
        });

        if (await_for_response && response.ok) {
            if (await_for_json) {
                data = await response.json()

                if (callback) {
                    callback(data)
                } else {
                    return data
                }

                return
            }
            callback({})
        } else {
            window.alert(response.statusText + " (Error code: " + response.status + ")")
        }
    } catch (error) {
        alert("Client request failed: error " + error.name + ": " + error.message + "\n" + error.stack)
    }
}

async function postFormHttpAsync(url, form_data, files=null, await_for_response = false, callback = function (data) {}, await_for_json = true) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            files: files,
            mode: "no-cors",
            body: form_data,
            headers: {'X-CSRFToken': csrftoken || ""}
        });

        if (await_for_response && response.ok) {
            if (await_for_json) {
                let data = await JSON.parse(response.body)
                callback(data)
                return
            }

            callback({})
        } else {
            window.alert(response.statusText + " (Error code: " + response.status + ")")
        }
    } catch (error) {
        alert("Client request failed: error " + error.name + ": " + error.message + "\n" + error.stack)
    }
}