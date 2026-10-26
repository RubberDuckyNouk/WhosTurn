(async function () {
    try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;

        const group = await res.json();
        const userNav = document.getElementById("userNav");

        if (userNav) {
            userNav.classList.remove("d-none");
        }

        const brandGroupName = document.getElementById("brandGroupName");
        if (brandGroupName) {
            brandGroupName.textContent = group.name;
            brandGroupName.classList.remove("d-none");
        }

        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async (e) => {
                e.preventDefault();
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
            });
        }
    } catch (err) {
        // Not logged in — nav stays as-is
    }
})();
