const alertContainer = document.getElementById("alert-container");
const errorSound = document.getElementById("error-sound")

function showAlert(title, message, type, duration = 5000) {
    const alert = document.createElement("div");
    alert.className = "alert";
    alert.innerHTML = `
        <div class="message">
            <strong>${title}</strong>
            <p>${message}</p>
        </div>
        <button class="dismiss-btn">&times;</button>
        <div class="progress-bar" style="animation-duration: ${duration}ms"></div>
    `;

    if (type === "error" || type === "warning") {
        alert.classList.add(type)

        errorSound.currentTime = 0
        errorSound.play()
    }

    alertContainer.appendChild(alert);

    const autoDismissTimeout = setTimeout(() => dismissAlert(alert), duration);

    const dismissButton = alert.querySelector(".dismiss-btn");
    dismissButton.addEventListener("click", () => {
        clearTimeout(autoDismissTimeout);
        dismissAlert(alert);
    });
}

function dismissAlert(alert) {
    alert.style.animation = "fadeOut 0.5s forwards";
    alert.addEventListener("animationend", () => alert.remove());
}