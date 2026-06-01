// Load everything on page load
document.addEventListener("DOMContentLoaded", () => {
    loadClimbData();
    loadDropdowns();
    setupForm();
    loadRecentClimbs();
});

async function loadClimbData() {
    try {
        const res = await fetch("/api/climbs/current");
        const data = await res.json();

        renderThermometer(data.bitterballen_index, data.target);
        renderMemberStats(data.members);
    } catch (err) {
        console.error("Failed to load climb data:", err);
    }
}

function renderThermometer(points, target) {
    const bar = document.getElementById("thermometer");
    const text = document.getElementById("indexText");

    const percentage = Math.round((points / target) * 100);
    const barWidth = Math.min(percentage, 100);

    bar.style.width = barWidth + "%";
    bar.textContent = percentage + "%";
    bar.setAttribute("aria-valuenow", percentage);

    // Colour stops
    if (percentage > 100) {
        bar.className = "progress-bar";
        bar.style.backgroundColor = "#e91e8c";
    } else if (percentage >= 67) {
        bar.className = "progress-bar bg-success";
        bar.style.backgroundColor = "";
    } else if (percentage >= 34) {
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
    } else if (percentage === 100) {
        text.textContent = "BITTERBALLEN! Everyone crushed it!";
    } else {
        text.textContent = "MEGA BITTERBALLEN! You animals went beyond!";
    }
}

function renderMemberStats(members) {
    const tbody = document.getElementById("memberStats");
    tbody.innerHTML = "";

    for (const m of members) {
        let status = "-";
        if (m.is_new_pr) {
            status = "NEW PR!";
        } else if (m.climbed_at_pr) {
            status = "At PR";
        } else if (m.session_climbs > 0) {
            status = "Climbed";
        }

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${m.name}</td>
            <td>${m.pr || "-"}</td>
            <td>${m.session_climbs}</td>
            <td>${m.session_high || "-"}</td>
            <td>${status}</td>
        `;
        tbody.appendChild(row);
    }
}

async function loadDropdowns() {
    try {
        // Load members
        const membersRes = await fetch("/api/members");
        const members = await membersRes.json();
        const memberSelect = document.getElementById("climbMember");
        for (const m of members) {
            const opt = document.createElement("option");
            opt.value = m.id;
            opt.textContent = m.name;
            memberSelect.appendChild(opt);
        }

        // Load grades
        const gradesRes = await fetch("/api/grades");
        const grades = await gradesRes.json();
        const gradeSelect = document.getElementById("climbGrade");
        for (const g of grades) {
            const opt = document.createElement("option");
            opt.value = g;
            opt.textContent = g;
            gradeSelect.appendChild(opt);
        }

        // Default date to today
        const today = new Date().toISOString().split("T")[0];
        document.getElementById("climbDate").value = today;
    } catch (err) {
        console.error("Failed to load dropdowns:", err);
    }
}

function setupForm() {
    const form = document.getElementById("climbForm");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const member_id = parseInt(document.getElementById("climbMember").value);
        const grade = document.getElementById("climbGrade").value;
        const climb_date = document.getElementById("climbDate").value;

        if (!member_id || !grade) return;

        try {
            const res = await fetch("/api/climbs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ member_id, grade, climb_date })
            });

            if (res.ok) {
                // Check if this climb was at or above PR
                const dataRes = await fetch("/api/climbs/current");
                const data = await dataRes.json();
                const member = data.members.find(m => m.id === member_id);
                if (member && (member.is_new_pr || member.climbed_at_pr)) {
                    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                }
                // Refresh the data display
                renderThermometer(data.bitterballen_index, data.target);
                renderMemberStats(data.members);
                loadRecentClimbs();
                // Reset grade selection but keep member and date
                document.getElementById("climbGrade").value = "";
            } else {
                const err = await res.json();
                alert("Error: " + err.error);
            }
        } catch (err) {
            console.error("Failed to log climb:", err);
        }
    });
}

async function loadRecentClimbs() {
    try {
        const res = await fetch("/api/climbs/recent");
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
                    return `
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <span><strong>${c.member_name}</strong> — ${c.grade} <small class="text-muted">(${date})</small></span>
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