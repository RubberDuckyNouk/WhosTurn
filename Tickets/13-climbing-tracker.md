# 13 - Climbing Tracker

## Description
A log of climbs per member over time, visualized as a graph.

## Notes
- Depends on ticket 12 (Bitterballen Index) which creates the `climbs` table and logging API. Do ticket 12 first.
- This ticket adds a graph to the existing bitterballen page (or a separate tab/section).
- Will need a charting library (e.g. Chart.js via CDN).

## Done when
- Time graph with member selection filter that has time on x (with start and end of first and last recorded)

---

## Implementation Steps

### Step 1: Add API endpoint in `server.js`

Add a GET endpoint that returns climb history suitable for graphing:

**GET `/api/climbs/history`** — returns all climbs grouped by date and member:

```js
// Get climb history for graph
app.get("/api/climbs/history", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.climb_date, c.grade, c.grade_value, m.id AS member_id, m.name
             FROM climbs c
             JOIN members m ON c.member_id = m.id
             ORDER BY c.climb_date ASC, m.name`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch climb history" });
    }
});
```

### Step 2: Add Chart.js to `views/bitterballen.html`

Add the Chart.js CDN script (before `bitterballen.js`):

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```

### Step 3: Add graph section to `views/bitterballen.html`

Add below the existing bitterballen content:

```html
<div class="card mt-4">
    <div class="card-body">
        <h5 class="card-title">Climbing Tracker</h5>
        <div class="mb-3">
            <label for="memberFilter" class="form-label">Filter by member</label>
            <select id="memberFilter" class="form-select">
                <option value="all">All members</option>
            </select>
        </div>
        <canvas id="climbChart"></canvas>
    </div>
</div>
```

### Step 4: Add graph logic in `public/js/bitterballen.js`

Add a function that:
1. Fetches `/api/climbs/history`
2. Groups data by member → array of `{ x: climb_date, y: grade_value }` points
3. Creates a Chart.js line chart on the `#climbChart` canvas
   - X-axis: time (date), range = first climb date to last climb date
   - Y-axis: grade (use `GRADES` labels mapped from `grade_value`)
   - One dataset (line) per member, each with a distinct colour
4. Populates the `#memberFilter` dropdown with member names
5. On filter change: show/hide datasets to display only the selected member (or all)

Key Chart.js config notes:
- Use `type: 'line'` with `scales.x.type: 'time'` (requires the Chart.js date adapter — add `https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns` as a script too)
- Y-axis ticks should display grade strings, not numeric values — use a `callback` on `scales.y.ticks` that maps `grade_value` back to the grade string via the `GRADES` array
- Set `tension: 0.1` for slightly smoothed lines

### Step 5: Verify

1. Run `npm run dev`, go to `/bitterballen`
2. Ensure the graph renders with existing climb data
3. Filter to a single member — only their line shows
4. Filter back to "All members" — all lines reappear
5. X-axis spans from earliest to latest recorded climb date
6. Y-axis shows grade labels (not numbers)
