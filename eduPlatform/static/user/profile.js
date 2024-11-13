var currentTab = "profile";

var profile_username, profile_picture, username, email, description, save_description
var edit_username, edit_email, edit_password

var originalDescription

const tab_list = ["profile", "security", "etc"]

async function loadUserData() {
    userData = await getHttpAsync("/user/get_userinfo/")
    json = await userData.json()
    
    if (!userData || !json) {
        alert("Failed to load user profile data!")
        return
    }

    data = json["data"]
    
    profile_username.textContent = data["username"]
    username.textContent = data["username"]
    email.textContent = data["email"]
    description.value = data["description"]
}

function changeTab(tab_name) {
    if (tab_name == currentTab) {
        return
    }

    if (currentTab) {
        const prevTab = document.getElementById("tab_" + currentTab)
        const prevBtn = document.getElementById("btn_" + currentTab)

        prevTab.style.display = "none"
        prevBtn.classList.remove("selected")
    }

    currentTab = tab_name

    const tab = document.getElementById("tab_" + currentTab)
    const btn = document.getElementById("btn_" + currentTab)

    tab.style.display = "block"
    btn.classList.add("selected")
}

function saveUserDescription() {
    const desc = description.value

    if (desc === originalDescription) {
        return
    }

    if (desc.length > 350) {
        alert("Cannot set description with over 350 characters!")
        return;
    }

    save_description.disabled = true
    description.readOnly = true

    postHttpAsync("/user/set_description/", {"description": desc}, true, (data) => {
        if (data["success"] == false) {
            alert("Failed to set user description.")
            description.value = originalDescription
        }

        save_description.disabled = false
        description.readOnly = false
    }, true)
}

async function main() {
    for (tab of tab_list) {
        const btn = document.getElementById("btn_" + tab)
        const tab_name = tab

        if (!btn) {
            continue
        }

        btn.addEventListener("click", () => {
            changeTab(tab_name)
        })
    }

    profile_username = document.getElementById("profile_username")
    profile_picture = document.getElementById("change_pfp")
    username = document.getElementById("username")
    email = document.getElementById("email")
    description = document.getElementById("description")
    
    save_description = document.getElementById("save_description")
    edit_username = document.getElementById("edit_username")
    edit_email = document.getElementById("edit_email")
    edit_password = document.getElementById("edit_password")

    await loadUserData()
    
    originalDescription = description.value
    save_description.addEventListener("click", saveUserDescription)
}

window.addEventListener("load", main)