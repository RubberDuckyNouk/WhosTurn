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

// Load members when the page is ready
loadMembers();