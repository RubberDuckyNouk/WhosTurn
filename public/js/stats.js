let grades = [];
let chart = null;

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
        const memberId = select.value;
        if (memberId) {
            loadStats(memberId);
        } else {
            clearChart();
        }
    });
}

async function loadStats(memberId) {
    const [statsRes, topAvgRes] = await Promise.all([
        fetch(`/api/climbs/stats?member_id=${memberId}`),
        fetch(`/api/climbs/top-average?member_id=${memberId}`)
    ]);
    const data = await statsRes.json();
    const topAvgData = await topAvgRes.json();

    // Update top-10 average box
    const topAvgCard = document.getElementById("topAvgCard");
    const topAvgValue = document.getElementById("topAvgValue");
    if (topAvgData.avg_grade_value !== null) {
        const avg = topAvgData.avg_grade_value;
        const lower = grades[Math.floor(avg)] || "?";
        const upper = grades[Math.ceil(avg)] || lower;
        const label = lower === upper ? lower : lower + " / " + upper;
        topAvgValue.textContent = label;
        topAvgCard.classList.remove("d-none");
    } else {
        topAvgCard.classList.add("d-none");
    }

    const noDataMsg = document.getElementById("noDataMsg");
    const canvas = document.getElementById("statsChart");

    if (data.length === 0) {
        noDataMsg.classList.remove("d-none");
        canvas.classList.add("d-none");
        if (chart) { chart.destroy(); chart = null; }
        return;
    }

    noDataMsg.classList.add("d-none");
    canvas.classList.remove("d-none");

    const labels = data.map(d => d.month);
    const routeCounts = data.map(d => d.route_count);
    const maxGrades = data.map(d => d.max_grade_value);

    if (chart) { chart.destroy(); }

    chart = new Chart(canvas, {
        data: {
            labels: labels,
            datasets: [
                {
                    type: "bar",
                    label: "Routes Climbed",
                    data: routeCounts,
                    backgroundColor: "rgba(54, 162, 235, 0.6)",
                    borderColor: "rgba(54, 162, 235, 1)",
                    borderWidth: 1,
                    yAxisID: "yRoutes"
                },
                {
                    type: "line",
                    label: "Max Grade",
                    data: maxGrades,
                    borderColor: "rgba(255, 99, 132, 1)",
                    backgroundColor: "rgba(255, 99, 132, 0.2)",
                    borderWidth: 2,
                    pointRadius: 4,
                    tension: 0.2,
                    yAxisID: "yGrade"
                }
            ]
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
                    title: {
                        display: true,
                        text: "Routes Climbed"
                    },
                    ticks: {
                        stepSize: 1
                    }
                },
                yGrade: {
                    type: "linear",
                    position: "right",
                    min: 0,
                    max: grades.length - 1,
                    title: {
                        display: true,
                        text: "Max Grade"
                    },
                    ticks: {
                        callback: function(value) {
                            return grades[value] || "";
                        },
                        stepSize: 1
                    },
                    grid: {
                        drawOnChartArea: false
                    }
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
    document.getElementById("noDataMsg").classList.add("d-none");
    document.getElementById("topAvgCard").classList.add("d-none");
}

init();
