# 06 - Track Driving Turns

## Description
Implement a rotation system to track whose turn it is to drive. Only members who are in the carpool participate in the driving rotation.

## Tasks
- Add a `drive_order` column to the members table (or a separate tracking table)
- Write logic to determine whose turn it is to drive next
- Display the current driver prominently on the page
- Show the upcoming driving order

## Done when
- The app shows whose turn it is to drive
- Only carpool members are in the driving rotation
- The rotation order is visible

---

## Implementation Steps

### Step 1: Add columns to the members table

We need two new columns: `drive_order` to track the driving rotation position, and `is_current_driver` to mark whose turn it is. Open **psql** and run:

```sql
\c whosturn
ALTER TABLE members ADD COLUMN drive_order INTEGER;
ALTER TABLE members ADD COLUMN is_current_driver BOOLEAN NOT NULL DEFAULT false;
```

Then set the initial driving order for your carpool members. The order number determines the rotation sequence — lower numbers go first:

```sql
UPDATE members SET drive_order = 1, is_current_driver = true WHERE name = 'Nouk';
UPDATE members SET drive_order = 2 WHERE name = 'Levi';
UPDATE members SET drive_order = 3 WHERE name = 'Roel';
```

Non-carpool members (Peter, Sander, Aliona) don't get a `drive_order` — they stay `NULL`.

**What's happening here:**
- `ALTER TABLE ... ADD COLUMN` — adds a new column to an existing table without losing data
- `drive_order` — an integer that determines the rotation position (1 = first, 2 = second, etc.)
- `is_current_driver` — a flag that marks exactly one person as the current driver
- Only carpool members (`in_carpool = true`) get a drive order — non-carpool members don't drive

### Step 2: Update `initDatabase()` to include the new columns

Open `db/database.js` and update the `initDatabase` function so the new columns are created automatically on fresh setups. Replace the existing function with:

```js
async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS members (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            in_carpool BOOLEAN NOT NULL DEFAULT false,
            drive_order INTEGER,
            is_current_driver BOOLEAN NOT NULL DEFAULT false
        )
    `);
    console.log("Database initialized — members table ready");
}
```

**What's happening here:**
- We add `drive_order` and `is_current_driver` to the CREATE TABLE statement
- This doesn't affect your existing table (because of `IF NOT EXISTS`), but ensures new setups get the correct schema
- If you ever recreate the database from scratch, these columns will be there

### Step 3: Add the API endpoint in `server.js`

Add this route after your existing `/api/members` route:

```js
// Get driving rotation
app.get("/api/driving", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM members WHERE in_carpool = true ORDER BY drive_order"
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch driving rotation" });
    }
});
```

**What's happening here:**
- `WHERE in_carpool = true` — only returns members who participate in the carpool
- `ORDER BY drive_order` — returns them in rotation order (1, 2, 3...)
- The frontend will use `is_current_driver` to highlight whose turn it is

### Step 4: Add the driving section to `index.html`

In `views/index.html`, add this section inside `<main>` before the Members card:

```html
        <!-- Current Driver -->
        <div class="card mt-4">
            <div class="card-body text-center">
                <h5 class="card-title">Driving This Week</h5>
                <p class="display-6" id="currentDriver">Loading...</p>
            </div>
        </div>

        <!-- Driving Rotation -->
        <div class="card mt-3">
            <div class="card-body">
                <h5 class="card-title">Driving Order</h5>
                <ol id="drivingOrder" class="list-group list-group-numbered list-group-flush">
                    <!-- Driving order loaded by JavaScript -->
                </ol>
            </div>
        </div>
```

**What's happening here:**
- The first card shows the current driver's name big and centered (`display-6` is a large Bootstrap text size)
- The second card shows the full rotation as a numbered list
- `list-group-numbered` — Bootstrap automatically adds numbers (1, 2, 3...) to the list items
- `id="currentDriver"` and `id="drivingOrder"` — JavaScript will fill these in

### Step 5: Add the JavaScript to load driving data

Open `public/js/app.js` and add this function after the existing `loadMembers` function:

```js
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
```

Then update the bottom of the file to call both functions:

```js
// Load data when the page is ready
loadMembers();
loadDriving();
```

**What's happening here:**
- `fetch("/api/driving")` — calls our new endpoint to get carpool members in order
- `drivers.find(d => d.is_current_driver)` — finds the one member whose `is_current_driver` is true
- `currentDriver.textContent = ...` — shows their name in the big display area
- `driver.is_current_driver ? "active" : ""` — Bootstrap's `active` class highlights the current driver's row in blue in the list
- We call `loadDriving()` alongside `loadMembers()` so both sections load on page open

### Step 6: Verify

1. Run `npm run dev` and go to `http://localhost:3000`
2. You should see a card showing "Nouk" (or whoever you set as current driver) in large text
3. Below that, a numbered list showing the driving order (Nouk, Levi, Roel)
4. The current driver should be highlighted in blue in the list
5. You can test the API directly at `http://localhost:3000/api/driving` to see the raw JSON
6. Non-carpool members (Peter, Sander, Aliona) should NOT appear in the driving section
