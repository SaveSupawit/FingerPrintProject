const API_BASE = '/api';
const $ = s => document.querySelector(s);

function getAuthHeaders() {
    const token = localStorage.getItem('fa_token');
    return {
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

// ===================== Logout ===================== 
$('#btn-logout')?.addEventListener('click', () => {
    localStorage.clear();
    location.href = '/auth.html';
});

// ===================== Profile Data ===================== 
async function loadMyProfile() {
    const res = await fetch(`${API_BASE}/me`, {
        headers: getAuthHeaders()
    });
    verifyAuth(res);

    const data = await res.json();
    if (!res.ok) {
        alert(data.error || 'โหลดข้อมูลผู้ใช้ไม่ได้');
        return;
    }

    const user = data.user;

    // Greeting
    const title = document.getElementById('greeting-title');
    if (title) title.innerText = `Hi, ${user.username} !`;

    // Top Right
    const rightDisplay = document.getElementById('user-display');
    if (rightDisplay) rightDisplay.innerText = `${user.username}`;

    // Profile Box
    if (user.username) {
        const initials = user.username.substring(0, 2).toUpperCase();
        document.getElementById('profile-initials').innerText = initials;
    }
    document.getElementById('profile-name').innerText = user.username;
    document.getElementById('profile-email').innerHTML = `อีเมล: <a href="mailto:${user.email}" style="color: #3b82f6; text-decoration:none;">${user.email || '-'}</a>`;
}

// ===================== Available Subjects ===================== 
async function loadAvailableSubjects() {
    const res = await fetch(`/api/student/available-subjects?t=${Date.now()}`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const sel = document.getElementById('stu-register-select');

    if (!sel) return;

    if (!data.subjects || data.subjects.length === 0) {
        sel.innerHTML = '<option value="" disabled selected>ไม่มีรายวิชาใหม่ให้ลงทะเบียน</option>';
        return;
    }
    sel.innerHTML = '<option value="" disabled selected>ค้นหารายวิชาบนระบบ...</option>';
    data.subjects.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.subject_id;
        opt.textContent = `${s.subject_name} (Teacher: ${s.teacher_name})`;
        sel.appendChild(opt);
    });
}

// ===================== Registered Courses ===================== 
async function loadStudentSubjects() {
    const res = await fetch(`/api/student/subjects?t=${Date.now()}`, {
        headers: getAuthHeaders()
    });
    verifyAuth(res);
    const data = await res.json();

    if (!res.ok) return;

    const container = document.getElementById('student-my-courses-container');
    if (!container) return;

    if (!data.subjects || data.subjects.length === 0) {
        container.innerHTML = '<div class="muted">You are not registered for any courses yet.</div>';
        return;
    }

    let cardsHtml = '';

    // Define an array of nice gradient colors for the cards
    const colors = [
        'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
        'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
        'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
        'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)'
    ];

    data.subjects.forEach((s, index) => {
        const color = colors[index % colors.length];

        cardsHtml += `
            <div class="course-card" style="width: 250px; cursor:pointer; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: transform 0.2s, box-shadow 0.2s; background: #fff;" onclick="window.location.href='student.html?subject_id=${s.subject_id}'" onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.05)'">
                <div style="height: 120px; background: ${color}; display:flex; align-items:center; justify-content:center;">
                    <span style="font-size: 48px; font-weight: 800; color: rgba(255,255,255,0.7);">${s.subject_name.substring(0, 3).toUpperCase()}</span>
                </div>
                <div style="padding: 16px;">
                    <div style="font-weight: 600; color: #1e293b; font-size: 15px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${s.subject_name}">${s.subject_name}</div>
                    <div class="muted" style="font-size: 13px;">วิชาเรียน</div>
                </div>
            </div>
        `;
    });

    container.innerHTML = cardsHtml;
}

// ===================== Enroll Logic ===================== 
async function enrollSubject() {
    const sel = document.getElementById('stu-register-select');
    if (!sel) return;

    const subjectId = sel.value;
    if (!subjectId) { alert('Please select a course to register.'); return; }

    try {
        const res = await fetch('/api/student/enroll-subject', {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ subject_id: subjectId })
        });
        const data = await res.json();

        if (res.ok && data.ok) {
            alert('Successfully registered for the course!');
            loadStudentSubjects();
            loadAvailableSubjects(); // refresh dropdown
        } else {
            alert(data.error || 'Failed to register.');
        }
    } catch (e) {
        console.error(e);
        alert('Error connecting to server.');
    }
}

// Init
async function init() {
    try {
        await loadMyProfile();
        await loadStudentSubjects();
        await loadAvailableSubjects();
    } catch (e) {
        console.error('Init failed', e);
    }
}

init();
