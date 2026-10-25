(async function () {
    try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;

        const group = await res.json();
        const userNav = document.getElementById("userNav");
        const navGroupName = document.getElementById("navGroupName");

        if (userNav && navGroupName) {
            navGroupName.textContent = group.name;
            userNav.classList.remove("d-none");
        }

        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
            });
        }
    } catch (err) {
        // Not logged in — nav stays as-is
    }
})();
