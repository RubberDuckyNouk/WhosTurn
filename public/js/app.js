
// Load members
async function loadMembers() {
    try {
        const response = await fetch("/api/members");
        const members = await response.json();
        const memberList = document.getElementById("memberList");

        memberList.innerHTML = members.map(member => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                ${member.name}
                ${member.in_carpool
                ? '<span class="badge bg-primary">Carpool</span>'
                : ""}
            </li>
        `).join("");
    } catch (err) {
        console.error("Failed to load members:", err);
    }
}

// Load driving rotation and current driver
async function loadDriving() {
    try {
        const response = await fetch("/api/driving");
        const drivers = await response.json();

        // Show current driver
        const current = drivers.find(d => d.is_current_driver);
        const currentDriver = document.getElementById("currentDriver");
        currentDriver.textContent = current ? current.name : "No driver set";

        // Show rotation order
        const drivingOrder = document.getElementById("drivingOrder");
        drivingOrder.innerHTML = drivers.map(driver => `
            <li class="list-group-item ${driver.is_current_driver ? "active" : ""}">
                ${driver.name}
            </li>
        `).join("");
    } catch (err) {
        console.error("Failed to load driving data:", err);
    }
}

// Load data when the page is ready
loadMembers();
loadDriving();