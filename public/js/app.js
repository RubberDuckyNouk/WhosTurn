
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

// Load payment rotation per group
async function loadPayment() {
    try {
        const response = await fetch("/api/payment");
        const groups = await response.json();
        const container = document.getElementById("paymentGroups");

        container.innerHTML = Object.keys(groups).map(groupNum => {
            const members = groups[groupNum];
            const current = members.find(m => m.is_current_payer);

            return `
                <!-- Group ${groupNum} Current Payer -->
                <div class="card mt-4">
                    <div class="card-body text-center">
                        <h5 class="card-title">Paying - Group ${groupNum}</h5>
                        <p class="display-6">${current ? current.name : "No payer set"}</p>
                    </div>
                </div>

                <!-- Group ${groupNum} Rotation -->
                <div class="card mt-3">
                    <div class="card-body">
                        <h5 class="card-title">Payment Order - Group ${groupNum}</h5>
                        <ol class="list-group list-group-numbered list-group-flush">
                            ${members.map(m => `
                                <li class="list-group-item ${m.is_current_payer ? "active" : ""}">
                                    ${m.name}
                                </li>
                            `).join("")}
                        </ol>
                    </div>
                </div>
            `;
        }).join("");
    } catch (err) {
        console.error("Failed to load payment data:", err);
    }
}

// Record a session for a group
async function recordSession(payGroup) {
    try {
        const response = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pay_group: payGroup }),
        });

        const data = await response.json();
        const sessionMessage = document.getElementById("sessionMessage");

        if (response.ok) {
            sessionMessage.innerHTML = `<span class="text-success">${data.message}</span>`;
            // Reload all data to show updated rotations
            loadDriving();
            loadPayment();
        } else {
            sessionMessage.innerHTML = `<span class="text-danger">${data.error}</span>`;
        }
    } catch (err) {
        console.error("Failed to record session:", err);
    }
}

// Button event listeners
document.getElementById("recordGroup1").addEventListener("click", () => recordSession(1));
document.getElementById("recordGroup2").addEventListener("click", () => recordSession(2));

// Load data when the page is ready
loadMembers();
loadDriving();
loadPayment();