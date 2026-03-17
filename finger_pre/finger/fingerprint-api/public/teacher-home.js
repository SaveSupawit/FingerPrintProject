const API_BASE = '/api';

const $ = sel => document.querySelector(sel);

function getAuthHeaders() {
    const token = localStorage.getItem('fa_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

function verifyAuth(res) {
    if (res.status === 401) {
        alert('Session expired. Please login again.');
        localStorage.removeItem('fa_token');
        localStorage.removeItem('fa_user');
        window.location.href = '/auth.html';
        throw new Error('Unauthorized');
    }
    return res;
}

let loggedUser = null;
try {
    const raw = localStorage.getItem('fa_user');
    if (raw) loggedUser = JSON.parse(raw);
} catch { }

(function setupHeader() {
    const userEl = $('#user-display') || $('#current-user');
    if (userEl && loggedUser) {
        userEl.innerText = `${loggedUser.username} (${loggedUser.role})`;
    }

    const logoutBtn = $('#btn-logout');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.removeItem('fa_user');
            localStorage.removeItem('fa_token');
            location.href = '/auth.html';
        };
    }
})();

async function loadMyProfile() {
    const res = await fetch(`${API_BASE}/me`, {
        headers: getAuthHeaders()
    });
    verifyAuth(res);

    const data = await res.json();
    if (!res.ok) {
        alert(data.error || 'Failed to load user info');
        return;
    }

    const nameStr = data.user.full_name || data.user.username || 'Teacher';
    const emailStr = data.user.email || '-';

    const greeting = document.getElementById('greeting-title');
    if (greeting) greeting.innerText = `Hi, ${nameStr}!`;

    const profileInitials = document.getElementById('profile-initials');
    if (profileInitials) {
        profileInitials.innerText = nameStr.substring(0, 2).toUpperCase();
    }

    const profileName = document.getElementById('profile-name');
    if (profileName) {
        profileName.innerText = nameStr;
    }

    const profileEmail = document.getElementById('profile-email');
    if (profileEmail) {
        profileEmail.innerText = `Email: ${emailStr}`;
    }
}

async function loadTeacherSubjects() {
    const res = await fetch(`${API_BASE}/teacher/subjects?t=${Date.now()}`, {
        headers: getAuthHeaders()
    });
    verifyAuth(res);

    const data = await res.json();
    if (!res.ok) {
        console.error('API Error:', data.error);
        return;
    }

    const container = document.getElementById('teacher-my-courses-container');
    if (!container) return;

    if (!data.subjects || data.subjects.length === 0) {
        container.innerHTML = '<div class="muted">You have not created any courses yet. Click the button above to create one.</div>';
        return;
    }

    let cardsHtml = '';
    data.subjects.forEach(s => {
        cardsHtml += `
            <div class="card" style="cursor:pointer; flex: 1 1 200px; text-align:center; padding: 20px 10px; border: 1px solid #cbd5e1; transition: transform 0.2s; background: #ffffff;" onclick="focusOnSubject(${s.subject_id})" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
                <div style="font-size: 32px; margin-bottom: 12px;">🏫</div>
                <div style="font-weight: 600; color: #0f172a; font-size: 16px;">${s.subject_name}</div>
                <div class="muted" style="font-size: 12px; margin-top: 8px;">Click to manage course</div>
            </div>
        `;
    });

    container.innerHTML = cardsHtml;
}

function focusOnSubject(subjectId) {
    window.location.href = `teacher.html?subject_id=${subjectId}`;
}

/* Modal Helpers */
function showModal(html) {
    $('#modal').innerHTML = html;
    $('#modal-backdrop').style.display = 'flex';
}

function closeModal() {
    $('#modal-backdrop').style.display = 'none';
    $('#modal').innerHTML = '';
}

function openAddSubject() {
    showModal(`
    <h3>Create Subject</h3>
    <input id="sub-name" placeholder="ชื่อวิชา / Subject Name">
    <div class="row actions">
      <button class="btn" onclick="saveSubject()" style="background-color: #f97316; border: none;">Save</button>
      <button class="btn secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
}

async function saveSubject() {
    const res = await fetch(`${API_BASE}/teacher/subjects`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ subject_name: $('#sub-name').value })
    });

    if (res.ok) {
        await loadTeacherSubjects();
        closeModal();
    } else {
        const data = await res.json();
        alert(data.error || 'Failed to create subject');
    }
}

async function init() {
    try {
        await loadMyProfile();
        await loadTeacherSubjects();
    } catch (e) {
        console.error('Init failed', e);
    }
}

init();
