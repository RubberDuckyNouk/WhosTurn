# 10 - Session History

## Description
Show a log of past sessions so users can see who drove, who paid, and who was present on each date. This provides transparency and lets users undo mistakes. Each session has a delete button that reverses the balance changes.

## Implementation Steps

### Step 1: Add the GET `/api/sessions` endpoint in `server.js`

Add this after the existing POST `/api/sessions` route:

```js
// Get session history
app.get("/api/sessions", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT s.id, s.session_date, s.pay_group,
                    p.name AS payer_name, d.name AS driver_name
             FROM sessions s
             JOIN members p ON s.payer_id = p.id
             LEFT JOIN members d ON s.driver_id = d.id
             ORDER BY s.session_date DESC, s.id DESC`
        );

        // Get attendance for each session
        const sessions = [];
        for (const row of result.rows) {
            const attendance = await pool.query(
                `SELECT m.name FROM session_attendance sa
                 JOIN members m ON sa.member_id = m.id
                 WHERE sa.session_id = $1
                 ORDER BY m.name`,
                [row.id]
            );
            sessions.push({
                ...row,
                present: attendance.rows.map(a => a.name)
            });
        }

        res.json(sessions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch session history" });
    }
});
```

### Step 2: Add the DELETE `/api/sessions/:id` endpoint in `server.js`

Add this after the GET `/api/sessions` route. This reverses the balance changes before deleting:

```js
// Delete a session and reverse balance changes
app.delete("/api/sessions/:id", async (req, res) => {
    const sessionId = parseInt(req.params.id);

    try {
        // Get the session details
        const session = await pool.query(
            "SELECT * FROM sessions WHERE id = $1",
            [sessionId]
        );

        if (session.rows.length === 0) {
            return res.status(404).json({ error: "Session not found" });
        }

        const { payer_id } = session.rows[0];

        // Get who was present
        const attendance = await pool.query(
            "SELECT member_id FROM session_attendance WHERE session_id = $1",
            [sessionId]
        );
        const presentIds = attendance.rows.map(r => r.member_id);
        const otherPresent = presentIds.filter(id => id !== payer_id);

        // Reverse balance changes: payer loses the points they gained
        await pool.query(
            "UPDATE members SET pay_balance = pay_balance - $1 WHERE id = $2",
            [otherPresent.length, payer_id]
        );

        // Others gain back their -1
        if (otherPresent.length > 0) {
            await pool.query(
                "UPDATE members SET pay_balance = pay_balance + 1 WHERE id = ANY($1)",
                [otherPresent]
            );
        }

        // Delete attendance records, then the session
        await pool.query(
            "DELETE FROM session_attendance WHERE session_id = $1",
            [sessionId]
        );
        await pool.query(
            "DELETE FROM sessions WHERE id = $1",
            [sessionId]
        );

        res.json({ message: "Session deleted and balances reversed" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete session" });
    }
});
```

### Step 3: Add a Session History section in `index.html`

Add this before the closing `</main>` tag:

```html
        <!-- Session History -->
        <div class="card mt-4">
            <div class="card-body">
                <h5 class="card-title">Session History</h5>
                <div id="sessionHistory">
                    <!-- Loaded by JavaScript -->
                </div>
            </div>
        </div>
```

### Step 4: Add `loadHistory()` and `deleteSession()` in `app.js`

Add these functions before the `loadMembers();` calls at the bottom:

```js
// Load session history
async function loadHistory() {
    try {
        const response = await fetch("/api/sessions");
        const sessions = await response.json();
        const container = document.getElementById("sessionHistory");

        if (sessions.length === 0) {
            container.innerHTML = `<p class="text-muted">No sessions recorded yet.</p>`;
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
```

### Step 5: Call `loadHistory()` on page load

Update the load calls at the bottom of `app.js`:

```js
// Load data when the page is ready
loadMembers();
loadDriving();
loadPayment();
loadHistory();
```

### Step 6: Refresh history after recording

In the `recordSession()` function, add `loadHistory();` next to the existing `loadPayment();` call inside the `if (result.ok)` block.

### Step 7: Verify

1. Run `npm run dev` and go to `http://localhost:3000`
2. Record a session — it should appear in the history
3. Check the date, payer, driver, and present members are correct
4. Click the delete button — confirm the popup
5. The session should disappear and balances should reverse
6. Record multiple sessions — history should show newest first

## Done when
- Past sessions are displayed on the page with date, payer, driver, and who was present
- Sessions are sorted with newest first
- Each session has a delete button
- Deleting a session reverses the balance changes
- History refreshes after recording or deleting
