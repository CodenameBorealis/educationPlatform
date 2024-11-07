const loginBtn = document.getElementById("submit_form")
const warningText = document.getElementById("warn_text")

const usernameInput = document.getElementById("username")
const passwordInput = document.getElementById("password")

function warn(text) { // Function used to display a red text under the password field in case of an error
    if (!text || text == "") {
        warningText.style.display = "none"
        return
    }

    warningText.textContent = text
    warningText.style.display = "flex"
}

function logIn() {
    if (usernameInput.value == "") { // If username is none, ask user to re-input it
        warn("Missing username.")
        return
    } 

    if (passwordInput.value == "") { // If password is none, ask user to re-input it
        warn("Missing password.")
        return
    } 

    warn() // Clear any warnings that were displayed earlier

    postHttpAsync("/user/login/", { // Send a post request to site.com/user/login/ and ask to log in.
        "username": usernameInput.value,
        "password": passwordInput.value
    }, true, function(result) {
        console.log(result)
    
        if (result["success"] == true) { // Successfully logged in, reload the page to get redirected to main page.
            document.location.reload()
        } else { // Something went wrong, display the error message.
            warn(result["error_message"])
        }
    })
}

loginBtn.addEventListener("click", logIn) // Connect logIn to the login button