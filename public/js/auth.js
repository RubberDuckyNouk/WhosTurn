function showError(msg) {
    const el = document.getElementById("errorMsg");
    el.textContent = msg;
    el.classList.remove("d-none");
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("name").value;
        const password = document.getElementById("password").value;

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, password })
            });
            const data = await res.json();

            if (res.ok) {
                window.location.href = "/";
            } else {
                showError(data.error);
            }
        } catch (err) {
            showError("Something went wrong. Try again.");
        }
    });
}

const signupForm = document.getElementById("signupForm");
if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();

            if (res.ok) {
                window.location.href = "/";
            } else {
                showError(data.error);
            }
        } catch (err) {
            showError("Something went wrong. Try again.");
        }
    });
}
