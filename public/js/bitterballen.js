function showConnectionError() {
    if (document.getElementById("connectionError")) return;
    const banner = document.createElement("div");
    banner.id = "connectionError";
    banner.className = "alert alert-danger text-center mb-0";
    banner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999;border-radius:0";
    banner.innerHTML = 'Connection lost. <a href="" class="alert-link">Refresh the page</a>';
    document.body.prepend(banner);
}

// Current climb filter
let climbFilter = "today";

// Load everything on page load
document.addEventListener("DOMContentLoaded", () => {
    loadClimbData();
    loadDropdowns();
    setupForm();
    loadRecentClimbs();
    loadBitterballenOrders();

    // Climb filter event listeners
    document.querySelectorAll(".climb-filter").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".climb-filter").forEach(b => {
                b.classList.remove("btn-primary", "active");
                b.classList.add("btn-outline-primary");
            });
            btn.classList.remove("btn-outline-primary");
            btn.classList.add("btn-primary", "active");
            climbFilter = btn.dataset.filter;
            loadRecentClimbs();
        });
    });

    document.getElementById("recalcBtn").addEventListener("click", async () => {
        // Collect unchecked member IDs as absent
        const absent = [];
        document.querySelectorAll("#attendanceList input[type=checkbox]").forEach(cb => {
            if (!cb.checked) absent.push(parseInt(cb.value));
        });
        const modal = bootstrap.Modal.getInstance(document.getElementById("attendanceModal"));
        if (modal) modal.hide();
        try {
            await fetch("/api/attendance", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ absent })
            });
        } catch (err) {
            console.error("Failed to save attendance:", err);
        }
        loadClimbData();
    });

    document.getElementById("orderBtn").addEventListener("click", orderBitterballen);
    document.getElementById("orderModal").addEventListener("show.bs.modal", () => {
        loadOrderForm();
        document.getElementById("modalMessage").innerHTML = "";
    });
});

async function loadClimbData() {
    try {
        const res = await fetch("/api/climbs/current");
        const data = await res.json();

        renderThermometer(data.bitterballen_index, data.target);
        renderMemberStats(data.members);
        renderAttendanceCheckboxes(data.members);
    } catch (err) {
        console.error("Failed to load climb data:", err);
        showConnectionError();
    }
}

function renderThermometer(points, target) {
    const bar = document.getElementById("thermometer");
    const text = document.getElementById("indexText");

    const percentage = Math.round((points / target) * 100);

    if (percentage >= 100) {
        bar.style.width = "100%";
    } else {
        bar.style.width = percentage + "%";
    }
    bar.textContent = percentage + "%";
    bar.setAttribute("aria-valuenow", percentage);

    // Colour: pink when over 100%, green at 100%, warning/danger below
    if (percentage > 100) {
        bar.className = "progress-bar";
        bar.style.backgroundColor = "#e91e8c";
    } else if (percentage === 100) {
        bar.className = "progress-bar bg-success";
        bar.style.backgroundColor = "";
    } else if (percentage >= 50) {
        bar.className = "progress-bar bg-warning";
        bar.style.backgroundColor = "";
    } else {
        bar.className = "progress-bar bg-danger";
        bar.style.backgroundColor = "";
    }

    // Explanation text
    if (percentage === 0) {
        text.textContent = "Nobody has climbed at their max yet. Get going!";
    } else if (percentage < 50) {
        text.textContent = "Some effort, but the bitterballen are still frozen...";
    } else if (percentage < 100) {
        text.textContent = "Getting warm! The bitterballen are almost ready!";
    } else if (percentage < 150) {
        text.textContent = "BITTERBALLEN! Everyone crushed it!";
    } else if (percentage < 250) {
        text.textContent = "Someone set a new PR! MEGA BITTERBALLEN!";
    } else {
        text.textContent = "Multiple new PRs! ULTRA BITTERBALLEN! You animals!";
    }
}

function climbTypeBadge(type) {
    if (type === "flashed") return ' <span class="badge bg-warning text-dark">F</span>';
    if (type === "attempted") return ' <span class="badge bg-secondary">A</span>';
    if (type === "climbed") return ' <span class="badge bg-primary">T</span>';
    return "";
}

function renderMemberStats(members) {
    const tbody = document.getElementById("memberStats");
    tbody.innerHTML = "";

    for (const m of members) {
        let status = "-";
        if (!m.is_present) {
            status = "Absent";
        } else if (m.is_new_pr) {
            status = "NEW PR!";
        } else if (m.is_new_flash_pr) {
            status = "Flash PR!";
        } else if (m.climbed_at_pr) {
            status = "At PR";
        } else if (m.session_climbs > 0) {
            status = "Climbed";
        }

        const sessionHighDisplay = m.session_high || "-";

        const row = document.createElement("tr");
        if (!m.is_present) row.classList.add("text-muted");
        row.innerHTML = `
            <td>${m.name}</td>
            <td>${m.pr || "-"}</td>
            <td>${m.session_climbs}</td>
            <td>${sessionHighDisplay}</td>
            <td>${m.points ?? "-"}</td>
            <td>${status}</td>
        `;
        tbody.appendChild(row);
    }
}

function renderAttendanceCheckboxes(members) {
    const container = document.getElementById("attendanceList");
    container.innerHTML = members.map(m => `
        <div class="form-check mb-2">
            <input class="form-check-input" type="checkbox" value="${m.id}" id="att-${m.id}"
                   ${m.is_present ? "checked" : ""}>
            <label class="form-check-label" for="att-${m.id}">${m.name}</label>
        </div>
    `).join("");

    document.getElementById("presentCount").textContent =
        members.filter(m => m.is_present).length;
}

async function loadDropdowns() {
    try {
        // Load members
        const membersRes = await fetch("/api/members?bitterballen=true");
        const members = await membersRes.json();
        const memberSelect = document.getElementById("climbMember");
        for (const m of members) {
            const opt = document.createElement("option");
            opt.value = m.id;
            opt.textContent = m.name;
            memberSelect.appendChild(opt);
        }

        // Grade dropdowns are static in HTML, no loading needed

        // Default date to today
        const today = new Date().toISOString().split("T")[0];
        document.getElementById("climbDate").value = today;
    } catch (err) {
        console.error("Failed to load dropdowns:", err);
    }
}

function setupForm() {
    const form = document.getElementById("climbForm");
    const submitBtn = document.getElementById("climbSubmitBtn");
    const messageDiv = document.getElementById("climbMessage");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const member_id = parseInt(document.getElementById("climbMember").value);
        const gradeNum = document.getElementById("climbGradeNum").value;
        const gradeLetter = document.getElementById("climbGradeLetter").value;
        const isPlus = document.getElementById("climbPlus").checked;
        const grade = gradeNum + gradeLetter + (isPlus ? "+" : "");
        const climb_date = document.getElementById("climbDate").value;
        const climbTypeRadio = document.querySelector('input[name="climbType"]:checked');
        const climb_type = climbTypeRadio ? climbTypeRadio.value : "";

        if (!member_id || !gradeNum || !climb_type) {
            if (!climb_type) messageDiv.innerHTML = '<span class="text-danger">Select a climb type</span>';
            return;
        }

        // Disable button to prevent double-clicks
        submitBtn.disabled = true;
        submitBtn.textContent = "Logging...";
        messageDiv.innerHTML = "";

        try {
            const res = await fetch("/api/climbs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ member_id, grade, climb_date, climb_type })
            });

            if (res.ok) {
                // Check if this climb was at or above PR
                const dataRes = await fetch("/api/climbs/current");
                const data = await dataRes.json();
                const member = data.members.find(m => m.id === member_id);
                if (member && (member.is_new_pr || member.climbed_at_pr)) {
                    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                }
                // Show success feedback
                messageDiv.innerHTML = `<span class="text-success">Logged ${grade} for ${document.getElementById("climbMember").selectedOptions[0].text}</span>`;
                setTimeout(() => { messageDiv.innerHTML = ""; }, 3000);

                // Refresh the data display
                renderThermometer(data.bitterballen_index, data.target);
                renderMemberStats(data.members);
                loadRecentClimbs();
                // Reset plus checkbox and type but keep member, date, grade number and letter
                document.getElementById("climbPlus").checked = false;
                document.querySelectorAll('input[name="climbType"]').forEach(r => r.checked = false);
            } else {
                const err = await res.json();
                messageDiv.innerHTML = `<span class="text-danger">${err.error}</span>`;
            }
        } catch (err) {
            console.error("Failed to log climb:", err);
            showConnectionError();
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Log Climb";
        }
    });
}

async function loadRecentClimbs() {
    try {
        const res = await fetch(`/api/climbs/recent?filter=${climbFilter}`);
        const climbs = await res.json();
        const container = document.getElementById("recentClimbs");

        if (climbs.length === 0) {
            container.innerHTML = `<p class="text-muted">No climbs logged yet.</p>`;
            return;
        }

        container.innerHTML = `
            <ul class="list-group list-group-flush">
                ${climbs.map(c => {
                    const date = new Date(c.climb_date).toLocaleDateString();
                    const typeBadge = climbTypeBadge(c.climb_type);
                    return `
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <span><strong>${c.member_name}</strong> — ${c.grade}${typeBadge} <small class="text-muted">(${date})</small></span>
                            <button class="btn btn-sm btn-outline-danger delete-climb-btn" data-id="${c.id}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </li>
                    `;
                }).join("")}
            </ul>
        `;

        container.querySelectorAll(".delete-climb-btn").forEach(btn => {
            btn.addEventListener("click", () => deleteClimb(parseInt(btn.dataset.id)));
        });
    } catch (err) {
        console.error("Failed to load recent climbs:", err);
    }
}

async function deleteClimb(climbId) {
    if (!confirm("Delete this climb?")) return;

    try {
        const res = await fetch(`/api/climbs/${climbId}`, { method: "DELETE" });
        if (res.ok) {
            loadRecentClimbs();
            loadClimbData();
        }
    } catch (err) {
        console.error("Failed to delete climb:", err);
    }
}

// Populate bitterballen order form
async function loadOrderForm() {
    try {
        const res = await fetch("/api/members");
        const members = await res.json();
        const beerMembers = members.filter(m => m.beer);

        document.getElementById("bitterballenPayer").innerHTML = beerMembers.map((m, i) =>
            `<option value="${m.id}" ${i === 0 ? "selected" : ""}>${m.name}</option>`
        ).join("");
    } catch (err) {
        console.error("Failed to load order form:", err);
    }
}

// Load and display today's bitterballen orders
async function loadBitterballenOrders() {
    try {
        const res = await fetch("/api/bitterballen-orders");
        const orders = await res.json();
        const container = document.getElementById("todaysOrders");

        if (orders.length === 0) {
            container.innerHTML = `<p class="text-muted">No orders yet today.</p>`;
            return;
        }

        container.innerHTML = `
            <ul class="list-group list-group-flush">
                ${orders.map(o => `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <span><strong>${o.bitterballen_payer_name}</strong> ordered a portion of bitterballen</span>
                        <button class="btn btn-sm btn-outline-danger delete-order-btn" data-id="${o.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </li>
                `).join("")}
            </ul>
        `;

        container.querySelectorAll(".delete-order-btn").forEach(btn => {
            btn.addEventListener("click", () => deleteBitterballenOrder(parseInt(btn.dataset.id)));
        });
    } catch (err) {
        console.error("Failed to load bitterballen orders:", err);
    }
}

// Order a portion of bitterballen
async function orderBitterballen() {
    const payerId = parseInt(document.getElementById("bitterballenPayer").value);
    const today = new Date().toISOString().split("T")[0];

    try {
        const res = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                session_date: today,
                bitterballen_payer_id: payerId,
                present_ids: [payerId]
            })
        });

        if (res.ok) {
            const modal = bootstrap.Modal.getInstance(document.getElementById("orderModal"));
            if (modal) modal.hide();
            document.getElementById("orderMessage").innerHTML =
                `<span class="text-success">Order recorded!</span>`;
            loadBitterballenOrders();
        } else {
            const data = await res.json();
            document.getElementById("modalMessage").innerHTML =
                `<span class="text-danger">${data.error}</span>`;
        }
    } catch (err) {
        console.error("Failed to order bitterballen:", err);
    }
}

// Delete a bitterballen order
async function deleteBitterballenOrder(sessionId) {
    if (!confirm("Delete this order and reverse the balance changes?")) return;

    try {
        const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
        if (res.ok) {
            loadBitterballenOrders();
            loadOrderForm();
            loadClimbData();
        }
    } catch (err) {
        console.error("Failed to delete bitterballen order:", err);
    }
}