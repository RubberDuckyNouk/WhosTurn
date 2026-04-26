# 12 - Bitterballen Index

## Description
Create a page where members can log what they climb, keep track of their personal record grade. Bitterballen index goes up based on group efforts.

## Done when
- App has entry option for name and grade
- Nr of climbs and highest grade of current session is shown per member
- Entered climb is stored with current date in the database
- All climbs per member are stored in the database
- App shows personal record grade for each member
- App shows 'bitterballen index' — a running score (no cap) that resets every Thursday. Each route logged earns points based on how close it is to the climber's PR.
- Bitterballen index is a thermometer style progress bar (can exceed the target).
- Text explaining the current index reached is displayed.

## Point System
Fractional system — each member's full share = `1/N` (where N = member count). Target = 1.0 (100%).

Each **route** earns per climber:
- New PR: **1/N** (full share per route — can exceed 100% with multiple)
- At PR: **1/N** (full share — one route = 100% contribution)
- One grade below PR: **1/2N** (half share — need 2 routes to reach full contribution)
- Anything lower: **0**

100% = every member climbed at their PR once, OR one grade below twice. New PRs and extra routes push past 100%.

No + grades — scale is: 3a, 3b, 3c, 4a, 4b, 4c, 5a, 5b, 5c, 6a, 6b, 6c, 7a, 7b, 7c, 8a, 8b.

If the score exceeds 100%, the thermometer bar turns **pink** with a different celebration text.

## Notes
- Ticket 13 (Climbing Tracker graph) builds on this ticket's data. Do this one first.

---

## Progress

Steps 1-5 are DONE (database table, API endpoints, route, navbar link). What remains is finishing the HTML body and writing the frontend JS.

---

## Step 6: Complete `views/bitterballen.html`

Replace the current file contents with:

```html
<!doctype html>
<html>


<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Bami tracker by Nouk</title>

    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css"
          rel="stylesheet">

    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

    <!-- Custom stylesheet -->
    <link rel="stylesheet" href="css/style.css">

</head>

<body>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container">
            <a class="navbar-brand" href="/">WhosTurn</a>

            <!-- Hamburger button (shows on small screens) -->
            <button class="navbar-toggler" type="button"
                    data-bs-toggle="collapse" data-bs-target="#mainNav"
                    aria-controls="mainNav" aria-expanded="false"
                    aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>

            <!-- Links (collapse into hamburger on small screens) -->
            <div class="collapse navbar-collapse" id="mainNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="/">Home</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link active" href="/bitterballen">Bitterballen</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <main class="container my-4">
        <h1>Bitterballen Index</h1>

        <!-- Thermometer + explanation -->
        <div class="card mt-4">
            <div class="card-body text-center">
                <h5 class="card-title">This Week's Index</h5>
                <div class="progress mt-3" style="height: 2rem;">
                    <div id="thermometer" class="progress-bar" role="progressbar"
                         style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                        0%
                    </div>
                </div>
                <p id="indexText" class="mt-3 fw-bold">Loading...</p>
            </div>
        </div>

        <!-- Member stats table -->
        <div class="card mt-4">
            <div class="card-body">
                <h5 class="card-title">Session Stats</h5>
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>PR</th>
                                <th>Climbs</th>
                                <th>Session High</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody id="memberStats">
                            <!-- Filled by JS -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Log a climb form -->
        <div class="card mt-4">
            <div class="card-body">
                <h5 class="card-title">Log a Climb</h5>
                <form id="climbForm">
                    <div class="row g-3 align-items-end">
                        <div class="col-sm">
                            <label for="climbMember" class="form-label">Member</label>
                            <select id="climbMember" class="form-select" required>
                                <option value="">Select member...</option>
                            </select>
                        </div>
                        <div class="col-sm">
                            <label for="climbGrade" class="form-label">Grade</label>
                            <select id="climbGrade" class="form-select" required>
                                <option value="">Select grade...</option>
                            </select>
                        </div>
                        <div class="col-sm">
                            <label for="climbDate" class="form-label">Date</label>
                            <input type="date" id="climbDate" class="form-control">
                        </div>
                        <div class="col-sm-auto">
                            <button type="submit" class="btn btn-primary">Log Climb</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

    </main>

    <!--Footer-->
    <footer>
        <div class="container">
            <p>Beer poured by
                <a href="https://yosemite.nl/" target="_blank" rel="noopener">
                    <img src="/images/YosemiteLogo.png" alt="Yosemite" style="height: 2em; vertical-align: middle;">
                </a>
            </p>
            <p>Check out my other work.</p>
            <a href="https://www.linkedin.com/in/nouk-g-1718b9170/" target="_blank" rel="noopener"
               class=" me-3 fs-5">
                <i class="bi bi-linkedin"></i>
            </a>
            <a href="https://github.com/RubberDuckyNouk" target="_blank" rel="noopener"
               class="fs-5">
                <i class="bi bi-github"></i>
            </a>
        </div>
    </footer>

    <!-- Bootstrap 5 JS Bundle -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>

    <!-- Bitterballen JavaScript -->
    <script src="/js/bitterballen.js"></script>

    <!-- Live reload -->
    <script src="http://localhost:35729/livereload.js"></script>

</body>
</html>
```

---

## Step 7: Create `public/js/bitterballen.js`

Full contents:

```js
// Load everything on page load
document.addEventListener("DOMContentLoaded", () => {
    loadClimbData();
    loadDropdowns();
    setupForm();
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
    // Bar fills to 100% max visually
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
                // Refresh the data display
                loadClimbData();
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
```

---

## Step 8: Verify

1. Run `npm run dev` and go to `http://localhost:3000/bitterballen`
2. Confirm the page loads with the thermometer at 0% and the empty stats table
3. Select a member and grade, click "Log Climb" — row should appear in the table
4. Log climbs at or above a member's PR — thermometer should increase
5. Confirm the status column shows "NEW PR!" / "At PR" / "Climbed" / "-" correctly
6. Confirm the explanation text changes with the index value
7. Wait for the next Thursday (or manually test by changing dates) to verify the weekly reset
