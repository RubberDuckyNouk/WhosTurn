let grades = [];
let chart = null;
let rawData = [];
let currentMemberId = null;

const typeColors = {
    climbed:   { bg: "rgba(54, 162, 235, 0.6)",  border: "rgba(54, 162, 235, 1)" },
    flashed:   { bg: "rgba(255, 193, 7, 0.6)",   border: "rgba(255, 193, 7, 1)" },
    attempted: { bg: "rgba(108, 117, 125, 0.6)",  border: "rgba(108, 117, 125, 1)" }
};

async function init() {
    const gradesRes = await fetch("/api/grades");
    grades = await gradesRes.json();

    const membersRes = await fetch("/api/members");
    const members = await membersRes.json();

    const select = document.getElementById("memberSelect");
    members.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.name;
        select.appendChild(opt);
    });

    select.addEventListener("change", () => {
        currentMemberId = select.value;
        if (currentMemberId) {
            loadStats(currentMemberId);
        } else {
            clearChart();
        }
    });

    // Filter toggle logic
    const filterAll = document.getElementById("filterAll");
    const typeCheckboxes = ["filterAttempted", "filterClimbed", "filterFlashed"].map(id => document.getElementById(id));

    filterAll.addEventListener("change", () => {
        if (filterAll.checked) {
            typeCheckboxes.forEach(cb => cb.checked = true);
        } else {
            typeCheckboxes.forEach(cb => cb.checked = false);
        }
        renderChart();
    });

    typeCheckboxes.forEach(cb => {
        cb.addEventListener("change", () => {
            const allChecked = typeCheckboxes.every(c => c.checked);
            filterAll.checked = allChecked;
            renderChart();
        });
    });
}

function getActiveTypes() {
    const types = [];
    if (document.getElementById("filterAttempted").checked) types.push("attempted");
    if (document.getElementById("filterClimbed").checked) types.push("climbed");
    if (document.getElementById("filterFlashed").checked) types.push("flashed");
    return types;
}

async function loadStats(memberId) {
    const [statsRes, topAvgRes, prsRes] = await Promise.all([
        fetch(`/api/climbs/stats?member_id=${memberId}`),
        fetch(`/api/climbs/top-average?member_id=${memberId}`),
        fetch(`/api/climbs/prs?member_id=${memberId}`)
    ]);
    rawData = await statsRes.json();
    const topAvgData = await topAvgRes.json();
    const prsData = await prsRes.json();

    // Update PR cards
    const prCards = document.getElementById("prCards");
    document.getElementById("climbedPrValue").textContent = prsData.climbed_pr || "\u2014";
    document.getElementById("flashPrValue").textContent = prsData.flash_pr || "\u2014";

    // Update top-10 average
    const topAvgValue = document.getElementById("topAvgValue");
    if (topAvgData.avg_grade_value !== null) {
        const avg = topAvgData.avg_grade_value;
        const lower = grades[Math.floor(avg)] || "?";
        const upper = grades[Math.ceil(avg)] || lower;
        topAvgValue.textContent = lower === upper ? lower : lower + " / " + upper;
    } else {
        topAvgValue.textContent = "\u2014";
    }

    if (prsData.climbed_pr || prsData.flash_pr || topAvgData.avg_grade_value !== null) {
        prCards.classList.remove("d-none");
    } else {
        prCards.classList.add("d-none");
    }

    document.getElementById("typeFilter").classList.toggle("d-none", rawData.length === 0);

    renderChart();
}

function renderChart() {
    const noDataMsg = document.getElementById("noDataMsg");
    const canvas = document.getElementById("statsChart");

    if (rawData.length === 0) {
        noDataMsg.classList.remove("d-none");
        canvas.classList.add("d-none");
        if (chart) { chart.destroy(); chart = null; }
        return;
    }

    const activeTypes = getActiveTypes();

    // Filter data to active types
    const filtered = rawData.filter(d => activeTypes.includes(d.climb_type || "climbed"));

    if (filtered.length === 0) {
        noDataMsg.classList.remove("d-none");
        canvas.classList.add("d-none");
        if (chart) { chart.destroy(); chart = null; }
        return;
    }

    noDataMsg.classList.add("d-none");
    canvas.classList.remove("d-none");

    const allMonths = [...new Set(rawData.map(d => d.month))].sort();

    // Build per-type per-month data
    const routesByType = {};
    const maxGradeByType = {};
    for (const t of activeTypes) {
        routesByType[t] = {};
        maxGradeByType[t] = {};
    }
    for (const row of filtered) {
        const t = row.climb_type || "climbed";
        routesByType[t][row.month] = row.route_count;
        maxGradeByType[t][row.month] = row.max_grade_value;
    }

    const datasets = [];

    // Stacked bars per type
    const barTypes = ["attempted", "climbed", "flashed"];
    const barLabels = { attempted: "Attempts", climbed: "Tops", flashed: "Flashes" };
    for (const t of barTypes) {
        if (!activeTypes.includes(t)) continue;
        datasets.push({
            type: "bar",
            label: barLabels[t],
            data: allMonths.map(m => routesByType[t]?.[m] || 0),
            backgroundColor: typeColors[t].bg,
            borderColor: typeColors[t].border,
            borderWidth: 1,
            yAxisID: "yRoutes",
            stack: "routes"
        });
    }

    // Max grade lines — only for top and flash (not attempted)
    const lineTypes = ["climbed", "flashed"].filter(t => activeTypes.includes(t));
    const lineLabels = { climbed: "Max Grade (Top)", flashed: "Max Grade (Flash)" };
    const lineDash = { climbed: [], flashed: [6, 3] };
    for (const t of lineTypes) {
        const gradeData = allMonths.map(m => maxGradeByType[t]?.[m] ?? null);
        if (gradeData.some(v => v !== null)) {
            datasets.push({
                type: "line",
                label: lineLabels[t],
                data: gradeData,
                borderColor: typeColors[t].border,
                backgroundColor: typeColors[t].bg,
                borderWidth: 2,
                borderDash: lineDash[t],
                pointRadius: 4,
                tension: 0.2,
                yAxisID: "yGrade",
                spanGaps: true
            });
        }
    }

    if (chart) { chart.destroy(); }

    chart = new Chart(canvas, {
        data: {
            labels: allMonths,
            datasets: datasets
        },
        options: {
            responsive: true,
            interaction: {
                mode: "index",
                intersect: false
            },
            scales: {
                yRoutes: {
                    type: "linear",
                    position: "left",
                    beginAtZero: true,
                    stacked: true,
                    title: { display: true, text: "Routes" },
                    ticks: { stepSize: 1 }
                },
                yGrade: {
                    type: "linear",
                    position: "right",
                    min: 0,
                    max: grades.length - 1,
                    title: { display: true, text: "Max Grade" },
                    ticks: {
                        callback: function(value) { return grades[value] || ""; },
                        stepSize: 1
                    },
                    grid: { drawOnChartArea: false }
                },
                x: {
                    stacked: true
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.yAxisID === "yGrade") {
                                return context.dataset.label + ": " + (grades[context.raw] || context.raw);
                            }
                            return context.dataset.label + ": " + context.raw;
                        }
                    }
                }
            }
        }
    });
}

function clearChart() {
    if (chart) { chart.destroy(); chart = null; }
    rawData = [];
    document.getElementById("noDataMsg").classList.add("d-none");
    document.getElementById("prCards").classList.add("d-none");
    document.getElementById("typeFilter").classList.add("d-none");
}

init();
