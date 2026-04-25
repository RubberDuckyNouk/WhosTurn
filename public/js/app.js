
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

// Load payment balances per group
async function loadPayment() {
    try {
        const response = await fetch("/api/payment");
        const groups = await response.json();
        const container = document.getElementById("paymentGroups");

        container.innerHTML = Object.keys(groups).map(groupNum => {
            const members = groups[groupNum];
            const suggestedPayer = members[0]; // Highest balance is first (sorted by server)

            return `
                <!-- Group ${groupNum} Next Payer -->
                <div class="card mt-4">
                    <div class="card-body text-center">
                        <h5 class="card-title">Next to Pay - Group ${groupNum}</h5>
                        <p class="display-6">${suggestedPayer ? suggestedPayer.name : "No members"}</p>
                    </div>
                </div>

                <!-- Group ${groupNum} Balances -->
                <div class="card mt-3">
                    <div class="card-body">
                        <h5 class="card-title">Balances - Group ${groupNum}</h5>
                        <ul class="list-group list-group-flush">
                            ${members.map(m => `
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    ${m.name}
                                    <span class="badge ${m.pay_balance > 0 ? "bg-danger" : m.pay_balance < 0 ? "bg-success" : "bg-secondary"}">
                                        ${m.pay_balance > 0 ? "+" : ""}${m.pay_balance}
                                    </span>
                                </li>
                            `).join("")}
                        </ul>
                    </div>
                </div>

                <!-- Group ${groupNum} Record Session -->
                <div class="card mt-3">
                    <div class="card-body">
                        <h5 class="card-title">Record Session - Group ${groupNum}</h5>
                        <p class="text-muted">Check who's present:</p>
                        ${members.map(m => `
                            <div class="form-check">
                                <input class="form-check-input attendance-${groupNum}"
                                       type="checkbox" value="${m.id}"
                                       id="attend-${m.id}" checked>
                                <label class="form-check-label" for="attend-${m.id}">
                                    ${m.name}
                                </label>
                            </div>
                        `).join("")}
                        <button class="btn btn-success mt-3 record-btn" data-group="${groupNum}">
                            Record Group ${groupNum}
                        </button>
                        <div class="session-message-${groupNum} mt-2"></div>
                    </div>
                </div>
            `;
        }).join("");

        // Add event listeners to record buttons
        document.querySelectorAll(".record-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const groupNum = btn.dataset.group;
                recordSession(parseInt(groupNum));
            });
        });
    } catch (err) {
        console.error("Failed to load payment data:", err);
    }
}

// Record a session for a group
async function recordSession(payGroup) {
    // Get checked (present) member IDs
    const checkboxes = document.querySelectorAll(`.attendance-${payGroup}:checked`);
    const presentIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (presentIds.length === 0) {
        const msgDiv = document.querySelector(`.session-message-${payGroup}`);
        msgDiv.innerHTML = `<span class="text-danger">At least one person must be present</span>`;
        return;
    }

    // Fetch current balances to find the suggested payer among present members
    const response = await fetch("/api/payment");
    const groups = await response.json();
    const members = groups[payGroup];

    // Find the present member with the highest balance
    const presentMembers = members.filter(m => presentIds.includes(m.id));
    const payer = presentMembers[0]; // Already sorted by highest balance

    try {
        const result = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                pay_group: payGroup,
                payer_id: payer.id,
                present_ids: presentIds
            }),
        });

        const data = await result.json();
        const msgDiv = document.querySelector(`.session-message-${payGroup}`);

        if (result.ok) {
            msgDiv.innerHTML = `<span class="text-success">${payer.name} paid! ${data.message}</span>`;
            loadDriving();
            loadPayment();
        } else {
            msgDiv.innerHTML = `<span class="text-danger">${data.error}</span>`;
        }
    } catch (err) {
        console.error("Failed to record session:", err);
    }
}

// Load data when the page is ready
loadMembers();
loadDriving();
loadPayment();