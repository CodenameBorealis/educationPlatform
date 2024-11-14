async function loadUsername() {
    try {
        const response = await getHttpAsync("/user/get_username/?user_id=-1");
        const json = await response.json()

        if (!response || response["success"] === false) {
            return
        }

        document.getElementById("username_text").textContent = json["data"]["username"]
    } catch (error) {
        console.error("Error loading username:", error)
    }
}

function main() {
    loadUsername()

    const toggler = document.querySelector('.navbar-toggler');
    const navbarContent = document.querySelector('.navbar_collapse');

    toggler.addEventListener('click', function () {
        toggler.classList.toggle('open');
        navbarContent.classList.toggle('shown');
    });
}

window.addEventListener('load', main)