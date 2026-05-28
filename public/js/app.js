
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

// Car icon colours per driver
const carColors = { "Nouk": "red" };
const defaultCarColor = "grey";

// Load driving rotation and current driver
async function loadDriving() {
    try {
        const response = await fetch("/api/driving");
        const drivers = await response.json();

        // Show current driver
        const current = drivers.find(d => d.is_current_driver);
        const currentDriver = document.getElementById("currentDriver");
        if (current) {
            const color = carColors[current.name] || defaultCarColor;
            currentDriver.innerHTML = `<i class="bi bi-car-front-fill me-2" style="color: ${color}"></i>${current.name}`;
        } else {
            currentDriver.textContent = "No driver set";
        }

        // Show rotation order
        const drivingOrder = document.getElementById("drivingOrder");
        drivingOrder.innerHTML = drivers.map(driver => {
            const color = carColors[driver.name] || defaultCarColor;
            return `
            <li class="list-group-item ${driver.is_current_driver ? "active" : ""}">
                <i class="bi bi-car-front-fill me-2" style="color: ${color}"></i>${driver.name}
            </li>
        `;
        }).join("");
    } catch (err) {
        console.error("Failed to load driving data:", err);
    }
}

// Group display names
const groupNames = { 1: "DomoYomo", 2: "P.S." };

// Load payment balances per group
async function loadPayment() {
    try {
        const response = await fetch("/api/payment");
        const groups = await response.json();
        const container = document.getElementById("paymentGroups");

        container.innerHTML = Object.keys(groups).map(groupNum => {
            const members = groups[groupNum];
            const suggestedPayer = members[0]; // Lowest balance is first (sorted by server)
            const groupName = groupNames[groupNum] || `Group ${groupNum}`;

            return `
                <div class="row mt-4">
                    <!-- Group ${groupNum} Next Payer -->
                    <div class="col-md-6">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <h5 class="card-title">Next to Pay - ${groupName}</h5>
                                <p class="display-6">${suggestedPayer ? suggestedPayer.name : "No members"}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Group ${groupNum} Balances -->
                    <div class="col-md-6">
                        <div class="card h-100">
                            <div class="card-body">
                                <h5 class="card-title">Beer Karma - ${groupName}</h5>
                                <ul class="list-group list-group-flush">
                                    ${members.map(m => `
                                        <li class="list-group-item d-flex justify-content-between align-items-center">
                                            ${m.name}
                                            <span class="badge ${m.pay_balance < 0 ? "bg-danger" : m.pay_balance > 0 ? "bg-success" : "bg-secondary"}">
                                                ${m.pay_balance > 0 ? "+" : ""}${m.pay_balance}
                                            </span>
                                        </li>
                                    `).join("")}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Group ${groupNum} Record Button -->
                <div class="text-center mt-3">
                    <button class="btn btn-success record-btn" data-group="${groupNum}"
                            data-bs-toggle="modal" data-bs-target="#recordModal-${groupNum}">
                        Record Payment - ${groupName}
                    </button>
                    <div class="session-message-${groupNum} mt-2"></div>
                </div>

                <!-- Group ${groupNum} Record Modal -->
                <div class="modal fade" id="recordModal-${groupNum}" tabindex="-1"
                     aria-labelledby="recordModalLabel-${groupNum}" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="recordModalLabel-${groupNum}">
                                    Record Payment - ${groupName}
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div class="mb-3">
                                    <label class="form-label" for="sessionDate-${groupNum}">Date</label>
                                    <input type="date" class="form-control session-date"
                                           id="sessionDate-${groupNum}" data-group="${groupNum}"
                                           value="${new Date().toISOString().split("T")[0]}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" for="payer-${groupNum}">Who's paying?</label>
                                    <select class="form-select payer-select" id="payer-${groupNum}" data-group="${groupNum}">
                                        ${members.map(m => `
                                            <option value="${m.id}" ${m.id === suggestedPayer.id ? "selected" : ""}>
                                                ${m.name}
                                            </option>
                                        `).join("")}
                                    </select>
                                </div>
                                <p class="text-muted">Uncheck absent members:</p>
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
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-success confirm-record-btn" data-group="${groupNum}">
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        // Keep payer dropdown in sync with attendance checkboxes
        document.querySelectorAll(".form-check-input[class*='attendance-']").forEach(cb => {
            cb.addEventListener("change", () => {
                const groupNum = cb.className.match(/attendance-(\d+)/)[1];
                const payerSelect = document.getElementById(`payer-${groupNum}`);
                const checkedIds = Array.from(document.querySelectorAll(`.attendance-${groupNum}:checked`))
                    .map(c => c.value);

                // Disable options for absent members
                Array.from(payerSelect.options).forEach(opt => {
                    opt.disabled = !checkedIds.includes(opt.value);
                });

                // If current payer is unchecked, switch to first present member
                if (!checkedIds.includes(payerSelect.value)) {
                    payerSelect.value = checkedIds[0] || "";
                }
            });
        });

        // Add event listeners to confirm buttons inside modals
        document.querySelectorAll(".confirm-record-btn").forEach(btn => {
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
    const sessionDate = document.getElementById(`sessionDate-${payGroup}`).value;

    if (presentIds.length < 2) {
        const msgDiv = document.querySelector(`.session-message-${payGroup}`);
        msgDiv.innerHTML = `<span class="text-danger">At least 2 people must be present</span>`;
        return;
    }

    const payerId = parseInt(document.getElementById(`payer-${payGroup}`).value);
    const payerName = document.getElementById(`payer-${payGroup}`).selectedOptions[0].textContent.trim();

    if (!presentIds.includes(payerId)) {
        const msgDiv = document.querySelector(`.session-message-${payGroup}`);
        msgDiv.innerHTML = `<span class="text-danger">Payer must be present</span>`;
        return;
    }

    try {
        const result = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                pay_group: payGroup,
                payer_id: payerId,
                present_ids: presentIds,
                session_date: sessionDate
            }),
        });

        const data = await result.json();
        const msgDiv = document.querySelector(`.session-message-${payGroup}`);

        if (result.ok) {
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById(`recordModal-${payGroup}`));
            if (modal) modal.hide();
            msgDiv.innerHTML = `<span class="text-success">${payerName} paid! ${data.message}</span>`;
            loadDriving();
            loadPayment();
            loadHistory();
        } else {
            msgDiv.innerHTML = `<span class="text-danger">${data.error}</span>`;
        }
    } catch (err) {
        console.error("Failed to record session:", err);
    }
}

// Current history filter
let historyFilter = "week";

// Load session history
async function loadHistory() {
    try {
        const response = await fetch(`/api/sessions?filter=${historyFilter}`);
        const sessions = await response.json();
        const container = document.getElementById("sessionHistory");

        if (sessions.length === 0) {
            container.innerHTML = `<p class="text-muted">No sessions found for this period.</p>`;
            return;
        }

        container.innerHTML = `
            <ul class="list-group list-group-flush">
                ${sessions.map(s => {
                    const groupName = groupNames[s.pay_group] || `Group ${s.pay_group}`;
                    const date = new Date(s.session_date).toLocaleDateString();
                    return `
                        <li class="list-group-item">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <strong>${date}</strong> — ${groupName}<br>
                                    <small class="text-muted">
                                        Paid: ${s.payer_name}
                                        ${s.driver_name ? ` | Drove: ${s.driver_name}` : ""}
                                        | Present: ${s.present.join(", ")}
                                    </small>
                                </div>
                                <button class="btn btn-sm btn-outline-danger delete-session-btn"
                                        data-id="${s.id}">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </li>
                    `;
                }).join("")}
            </ul>
        `;

        // Add event listeners to delete buttons
        document.querySelectorAll(".delete-session-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const sessionId = parseInt(btn.dataset.id);
                deleteSession(sessionId);
            });
        });
    } catch (err) {
        console.error("Failed to load session history:", err);
    }
}

// History filter event listeners
document.querySelectorAll(".history-filter").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".history-filter").forEach(b => {
            b.classList.remove("btn-primary", "active");
            b.classList.add("btn-outline-primary");
        });
        btn.classList.remove("btn-outline-primary");
        btn.classList.add("btn-primary", "active");
        document.getElementById("historyMonth").value = "";
        historyFilter = btn.dataset.filter;
        loadHistory();
    });
});

document.getElementById("historyMonth").addEventListener("change", (e) => {
    if (e.target.value) {
        document.querySelectorAll(".history-filter").forEach(b => {
            b.classList.remove("btn-primary", "active");
            b.classList.add("btn-outline-primary");
        });
        historyFilter = e.target.value;
        loadHistory();
    }
});

// Delete a session
async function deleteSession(sessionId) {
    if (!confirm("Delete this session and reverse the balance changes?")) return;

    try {
        const result = await fetch(`/api/sessions/${sessionId}`, {
            method: "DELETE"
        });

        if (result.ok) {
            loadHistory();
            loadPayment();
        }
    } catch (err) {
        console.error("Failed to delete session:", err);
    }
}

// Load data when the page is ready
loadMembers();
loadDriving();
loadPayment();
loadHistory();