
let members = [];
let editingId = null;

async function loadMembers() {
    try {
        const response = await fetch("/api/members");
        members = await response.json();
        renderMembers();
    } catch (err) {
        console.error("Failed to load members:", err);
    }
}

function renderMembers() {
    const container = document.getElementById("memberList");
    container.innerHTML = members.map(m => {
        if (m.id === editingId) {
            return `
                <div class="card mb-2">
                    <div class="card-body">
                        <input type="text" class="form-control mb-2" id="editName" value="${m.name}">
                        <div class="d-flex gap-3 mb-2 flex-wrap">
                            <div class="form-check">
                                <input type="checkbox" class="form-check-input" id="editCarpool" ${m.carpool ? "checked" : ""}>
                                <label class="form-check-label" for="editCarpool">Carpool</label>
                            </div>
                            <div class="form-check">
                                <input type="checkbox" class="form-check-input" id="editBeer" ${m.beer ? "checked" : ""}>
                                <label class="form-check-label" for="editBeer">Beer</label>
                            </div>
                            <div class="form-check">
                                <input type="checkbox" class="form-check-input" id="editBitterballen" ${m.bitterballen ? "checked" : ""}>
                                <label class="form-check-label" for="editBitterballen">Climbing</label>
                            </div>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-success btn-sm save-btn" data-id="${m.id}"><i class="bi bi-check-lg me-1"></i>Save</button>
                            <button class="btn btn-secondary btn-sm cancel-btn"><i class="bi bi-x-lg me-1"></i>Cancel</button>
                        </div>
                    </div>
                </div>
            `;
        }

        const badges = [];
        if (m.carpool) badges.push('<span class="badge bg-primary">Carpool</span>');
        if (m.beer) badges.push('<span class="badge bg-warning text-dark">Beer</span>');
        if (m.bitterballen) badges.push('<span class="badge bg-info text-dark">Climbing</span>');

        return `
            <div class="card mb-2">
                <div class="card-body d-flex justify-content-between align-items-center py-2">
                    <div>
                        <strong>${m.name}</strong>
                        <div class="d-flex gap-1 mt-1">${badges.join("")}</div>
                    </div>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${m.id}"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${m.id}"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    container.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            editingId = parseInt(btn.dataset.id);
            renderMembers();
        });
    });

    container.querySelectorAll(".save-btn").forEach(btn => {
        btn.addEventListener("click", () => saveMember(parseInt(btn.dataset.id)));
    });

    container.querySelectorAll(".cancel-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            editingId = null;
            renderMembers();
        });
    });

    container.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", () => deleteMember(parseInt(btn.dataset.id)));
    });
}

async function addMember() {
    const name = document.getElementById("newMemberName").value.trim();
    if (!name) {
        showMessage("Name is required", "danger");
        return;
    }

    const body = {
        name,
        carpool: document.getElementById("newCarpool").checked,
        beer: document.getElementById("newBeer").checked,
        bitterballen: document.getElementById("newBitterballen").checked
    };

    try {
        const result = await fetch("/api/members", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (result.ok) {
            document.getElementById("newMemberName").value = "";
            document.getElementById("newCarpool").checked = false;
            document.getElementById("newBeer").checked = false;
            document.getElementById("newBitterballen").checked = false;
            showMessage("Member added!", "success");
            loadMembers();
        } else {
            const data = await result.json();
            showMessage(data.error, "danger");
        }
    } catch (err) {
        console.error("Failed to add member:", err);
    }
}

async function saveMember(id) {
    const name = document.getElementById("editName").value.trim();
    if (!name) return;

    const body = {
        name,
        carpool: document.getElementById("editCarpool").checked,
        beer: document.getElementById("editBeer").checked,
        bitterballen: document.getElementById("editBitterballen").checked
    };

    try {
        const result = await fetch(`/api/members/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (result.ok) {
            editingId = null;
            loadMembers();
        } else {
            const data = await result.json();
            showMessage(data.error, "danger");
        }
    } catch (err) {
        console.error("Failed to save member:", err);
    }
}

async function deleteMember(id) {
    const member = members.find(m => m.id === id);
    if (!confirm(`Delete ${member?.name}?`)) return;

    try {
        const result = await fetch(`/api/members/${id}`, { method: "DELETE" });

        if (result.ok) {
            loadMembers();
        } else {
            const data = await result.json();
            showMessage(data.error, "danger");
        }
    } catch (err) {
        console.error("Failed to delete member:", err);
    }
}

function showMessage(text, type) {
    const msgDiv = document.getElementById("addMessage");
    msgDiv.innerHTML = `<span class="text-${type}">${text}</span>`;
}

document.getElementById("addMemberBtn").addEventListener("click", addMember);

loadMembers();
