function loadUsername() {
    response = getHttpAsync("/user/get_username/?user_id=-1")

    if (response["success"] == false) {
        return
    }

    username_text = document.getElementById("username_text").textContent = response["data"]["username"]
}

function main() {
    loadUsername()
}

window.addEventListener('load', main)