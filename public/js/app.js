
// Car icon colours per driver
const carColors = { "Nouk": "red" };
const defaultCarColor = "grey";

// Load driving section (rotation with skip flag)
async function loadDriving() {
    try {
        const response = await fetch("/api/driving");
        const drivers = await response.json();

        // Suggested = skipped member first, otherwise current rotation driver
        const skipped = drivers.find(d => d.drive_skipped);
        const current = drivers.find(d => d.is_current_driver);
        const suggested = skipped || current;

        const suggestedEl = document.getElementById("suggestedDriver");
        if (suggested) {
            const color = carColors[suggested.name] || defaultCarColor;
            suggestedEl.innerHTML = `<i class="bi bi-car-front-fill me-2" style="color: ${color}"></i>${suggested.name}`;
        } else {
            suggestedEl.textContent = "No drivers set";
        }
    } catch (err) {
        console.error("Failed to load driving data:", err);
    }
}

// Load beer payment section (balance-based, flat list)
async function loadPayment() {
    try {
        const response = await fetch("/api/payment");
        const members = await response.json();

        const suggestedPayer = document.getElementById("suggestedPayer");
        if (members.length > 0) {
            suggestedPayer.textContent = members[0].name;
        } else {
            suggestedPayer.textContent = "No members set";
        }

        const balances = document.getElementById("beerBalances");
        balances.innerHTML = members.map(m => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                ${m.name}
                <span class="badge ${m.beer_balance < 0 ? "bg-danger" : m.beer_balance > 0 ? "bg-success" : "bg-secondary"}">
                    ${m.beer_balance > 0 ? "+" : ""}${m.beer_balance}
                </span>
            </li>
        `).join("");
    } catch (err) {
        console.error("Failed to load payment data:", err);
    }
}

// Populate drive modal
async function loadDriveForm() {
    try {
        const response = await fetch("/api/driving");
        const drivers = await response.json();

        document.getElementById("driveDate").value = new Date().toISOString().split("T")[0];

        // Pre-select the suggested driver
        const skipped = drivers.find(d => d.drive_skipped);
        const current = drivers.find(d => d.is_current_driver);
        const suggestedId = (skipped || current)?.id;

        const driverSelect = document.getElementById("driverSelect");
        driverSelect.innerHTML = drivers.map(d =>
            `<option value="${d.id}" ${d.id === suggestedId ? "selected" : ""}>${d.name}</option>`
        ).join("");
    } catch (err) {
        console.error("Failed to load drive form:", err);
    }
}

// Populate beer modal
async function loadBeerForm() {
    try {
        const response = await fetch("/api/payment");
        const members = await response.json();

        document.getElementById("beerDate").value = new Date().toISOString().split("T")[0];

        document.getElementById("payerSelect").innerHTML = members.map(m =>
            `<option value="${m.id}">${m.name}</option>`
        ).join("");

        document.getElementById("beerCounts").innerHTML = members.map(m => `
            <div class="input-group mb-2">
                <span class="input-group-text" style="min-width: 120px;">${m.name}</span>
                <button type="button" class="btn btn-outline-danger beer-minus" data-member="${m.id}">-</button>
                <span class="form-control text-center beer-count-display" data-member="${m.id}">0</span>
                <button type="button" class="btn btn-outline-success beer-plus" data-member="${m.id}">+</button>
            </div>
        `).join("");

        document.querySelectorAll(".beer-plus").forEach(btn => {
            btn.addEventListener("click", () => {
                const display = document.querySelector(`.beer-count-display[data-member="${btn.dataset.member}"]`);
                display.textContent = parseInt(display.textContent) + 1;
            });
        });
        document.querySelectorAll(".beer-minus").forEach(btn => {
            btn.addEventListener("click", () => {
                const display = document.querySelector(`.beer-count-display[data-member="${btn.dataset.member}"]`);
                const val = parseInt(display.textContent);
                if (val > 0) display.textContent = val - 1;
            });
        });
    } catch (err) {
        console.error("Failed to load beer form:", err);
    }
}

// Record drive
async function recordDrive() {
    const sessionDate = document.getElementById("driveDate").value;
    const driverId = parseInt(document.getElementById("driverSelect").value);

    try {
        const result = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                session_date: sessionDate,
                driver_id: driverId,
                present_ids: [driverId]
            })
        });

        if (result.ok) {
            const modal = bootstrap.Modal.getInstance(document.getElementById("driveModal"));
            if (modal) modal.hide();
            showMessage("Drive recorded!", "success", "sessionMessage");
            loadDriving();
            loadHistory();
        } else {
            const data = await result.json();
            showMessage(data.error, "danger", "driveMessage");
        }
    } catch (err) {
        console.error("Failed to record drive:", err);
    }
}

// Record beer payment
async function recordBeer() {
    const sessionDate = document.getElementById("beerDate").value;
    const payerId = parseInt(document.getElementById("payerSelect").value);

    const beerCounts = {};
    document.querySelectorAll(".beer-count-display").forEach(el => {
        const count = parseInt(el.textContent) || 0;
        if (count > 0) {
            beerCounts[el.dataset.member] = count;
        }
    });

    const totalBeers = Object.values(beerCounts).reduce((sum, c) => sum + c, 0);
    if (totalBeers < 1) {
        showMessage("At least one beer must be recorded", "danger", "beerMessage");
        return;
    }

    // present_ids = everyone with a beer count + the payer
    const presentIds = Object.keys(beerCounts).map(id => parseInt(id));
    if (!presentIds.includes(payerId)) {
        presentIds.push(payerId);
    }

    try {
        const result = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                session_date: sessionDate,
                payer_id: payerId,
                beer_counts: beerCounts,
                present_ids: presentIds
            })
        });

        if (result.ok) {
            const modal = bootstrap.Modal.getInstance(document.getElementById("beerModal"));
            if (modal) modal.hide();
            showMessage("Beer payment recorded!", "success", "sessionMessage");
            loadPayment();
            loadHistory();
        } else {
            const data = await result.json();
            showMessage(data.error, "danger", "beerMessage");
        }
    } catch (err) {
        console.error("Failed to record beer:", err);
    }
}

function showMessage(text, type, target) {
    const msgDiv = document.getElementById(target || "sessionMessage");
    msgDiv.innerHTML = `<span class="text-${type}">${text}</span>`;
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
                    const date = new Date(s.session_date).toLocaleDateString();
                    const details = [];
                    if (s.driver_name) details.push(`Drove: ${s.driver_name}`);
                    if (s.payer_name) details.push(`Paid: ${s.payer_name}`);
                    if (s.beer_details && s.beer_details.length > 0) {
                        details.push(`Beers: ${s.beer_details.join(", ")}`);
                    }

                    return `
                        <li class="list-group-item">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <strong>${date}</strong><br>
                                    <small class="text-muted">${details.join(" | ")}</small>
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

        document.querySelectorAll(".delete-session-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                deleteSession(parseInt(btn.dataset.id));
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
            loadDriving();
            loadPayment();
        }
    } catch (err) {
        console.error("Failed to delete session:", err);
    }
}

// Button handlers
document.getElementById("confirmDrive").addEventListener("click", recordDrive);
document.getElementById("confirmBeer").addEventListener("click", recordBeer);

// Reset forms when modals open
document.getElementById("driveModal").addEventListener("show.bs.modal", () => {
    loadDriveForm();
    document.getElementById("driveMessage").innerHTML = "";
});

document.getElementById("beerModal").addEventListener("show.bs.modal", () => {
    loadBeerForm();
    document.getElementById("beerMessage").innerHTML = "";
});

// Load data on page ready
loadDriving();
loadPayment();
loadHistory();
