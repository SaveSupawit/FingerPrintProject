/* =====================
   Config
===================== */
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

/* =====================================================
   Helpers: Date/Time Formatting
===================================================== */
function formatDateTh(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateTimeTh(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.split(':').slice(0, 2).join(':');
}

/* =====================
   Logged user
===================== */
let loggedUser = null;
try {
    loggedUser = JSON.parse(localStorage.getItem('fa_user'));
} catch { }

/* =====================
   Header
===================== */
(function setupHeader() {
    const userEl = $('#user-display');
    if (userEl && loggedUser) {
        userEl.innerText = `${loggedUser.username} (student)`;
    }

    $('#btn-logout')?.addEventListener('click', () => {
        localStorage.clear();
        location.href = '/auth.html';
    });
})();



/* =====================
   Load profile (student)
===================== */
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

    const statusEl = $('#student-fp-status');
    if (statusEl) {
        statusEl.innerHTML = // Use innerHTML to allow HTML tags like <span class="chip">
            data.user.fingerprint_id
                ? `<span class="chip">Enrolled (ID ${data.user.fingerprint_id})</span>`
                : '<span class="chip danger">Not Enrolled</span>';
    }
}









async function loadStudentSummary() {
    const res = await fetch('/api/student/summary', {
        headers: getAuthHeaders()
    });
    verifyAuth(res);

    const data = await res.json();
    if (!res.ok) return;

    /* ===============================
       1️⃣ วันนี้เรียนกี่คาบ
    =============================== */
    document.getElementById('student-today-count').innerText =
        data.today_sessions ?? 0;

    /* ===============================
       2️⃣ เช็กชื่อล่าสุด
    =============================== */
    const lastAttEl = document.getElementById('student-last-att');

    if (data.last_attendance) {
        // Pass the whole object to render
        renderLastAttendance(data.last_attendance);
    } else {
        renderLastAttendance(null);
    }


    /* ===============================
       3️⃣ Fingerprint Status
    =============================== */
    const fpStatusEl = document.getElementById('student-fp-status');
    const fpIdEl = document.getElementById('student-fp-id');

    if (data.fingerprint_id) {
        fpStatusEl.innerHTML =
            `<span class="chip">Enrolled</span>`;
        fpIdEl.innerText = data.fingerprint_id;
    } else {
        fpStatusEl.innerHTML =
            `<span class="chip danger">Not Enrolled</span>`;
        fpIdEl.innerText = '—';
        fpIdEl.innerText = '—';
    }
}

/* ===============================
   4️⃣ Live Session Logic
=============================== */
async function checkLiveSession() {
    try {
        const res = await fetch(`${API_BASE}/student/live-session`, {
            headers: getAuthHeaders()
        });
        verifyAuth(res);
        const data = await res.json();

        renderLiveSession(data); // data has { live: boolean, session: object }
    } catch (e) {
        console.error('Check live session error:', e);
    }
}

function renderLiveSession(data) {
    const container = document.getElementById('student-live-session-container');
    if (!container) return;

    if (!data || !data.live || !data.session) {
        // No live session
        container.innerHTML = `
            <div class="card" style="border: 1px solid #e2e8f0; background: #fff;">
                <div class="row" style="align-items:center;">
                    <span style="font-size: 20px; margin-right: 12px;">📴</span>
                    <div class="muted">No live class session at the moment.</div>
                </div>
            </div>`;
        return;
    }

    // Active Live Session
    const s = data.session;
    const dateStr = formatDateTh(s.date);
    const timeStr = formatTime(s.start_time);

    container.innerHTML = `
        <div class="card" style="border: 1px solid #bbf7d0; background: #f0fdf4;">
            <div class="row head" style="margin-bottom: 12px; justify-content: space-between;">
                <h3 style="margin:0; display:flex; align-items:center; gap:8px; color: #15803d;">
                    🔴 Live Class Now
                </h3>
                <span class="chip chip-green">Active</span>
            </div>
            <div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">${s.subject_name}</div>
                <div class="muted">
                    <span>📅 ${dateStr}</span>
                    <span style="margin-left: 12px;">⏰ ${timeStr}</span>
                </div>
            </div>
        </div>
    `;
}

// Auto-refresh live status every 15 seconds
setInterval(checkLiveSession, 15000);

/* helper แปลง status → สี */
function statusClass(status) {
    if (status === 'Present') return 'chip-green';
    if (status === 'Late') return 'chip-yellow';
    return 'chip danger'; // Absent
}


loadStudentSummary();



function renderLastAttendance(attData) {
    const statusEl = document.getElementById('student-last-att');
    if (!statusEl) return;

    // We are looking for the container ".stat". 
    // In student.html: <div class="stat"> ... <div id="student-last-att"></div> ... </div>
    const container = statusEl.parentElement;

    // Update container style to match professor's page (White background, card-like)
    // Overriding the default .stat background logic if needed, or just styling inline.
    // Styles are now handled in CSS (.stat-latest)

    if (!attData || !attData.status) {
        container.innerHTML = `
            <div class="muted" style="margin-bottom:8px;">เช็กชื่อล่าสุด</div>
            <div class="muted">-</div>
        `;
        return;
    }

    const { status, time_stamp, subject_name } = attData;

    const d = new Date(time_stamp);
    const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    // Table Layout
    container.innerHTML = `
        <div class="muted" style="margin-bottom:8px; font-size:14px;">เช็กชื่อล่าสุด</div>
        <table style="width:100%; border-collapse: collapse; font-size:14px;">
            <thead>
                <tr style="text-align:left; color:#64748b; font-size:12px; border-bottom:1px solid #f1f5f9;">
                    <th style="padding-bottom:4px; font-weight:500;">วิชา</th>
                    <th style="padding-bottom:4px; font-weight:500;">วันที่</th>
                    <th style="padding-bottom:4px; font-weight:500;">เวลา</th>
                    <th style="padding-bottom:4px; font-weight:500;">สถานะ</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding-top:8px; font-weight:600; color:#0f172a;">${subject_name || '-'}</td>
                    <td style="padding-top:8px;">${dateStr}</td>
                    <td style="padding-top:8px;">${timeStr}</td>
                    <td style="padding-top:8px;"><span class="chip ${statusClass(status)}" style="padding:4px 8px; font-size:12px;">${status}</span></td>
                </tr>
            </tbody>
        </table>
    `;
}




async function loadStudentSubjects() {
    // Add timestamp to prevent caching
    const res = await fetch(`/api/student/subjects?t=${Date.now()}`, {
        headers: getAuthHeaders()
    });
    verifyAuth(res);

    // Remove debug alert
    const data = await res.json();

    if (!res.ok) {
        console.error('API Error:', data.error);
        return;
    }

    if (!data.subjects || data.subjects.length === 0) {
        // Optional: Alert user if no subjects exist in system
        const sel = document.getElementById('stu-subject-select');
        sel.innerHTML = '<option value="">-- ไม่พบรายวิชาในระบบ --</option>';
        return;
    }

    const sel = document.getElementById('stu-subject-select');
    sel.innerHTML = '<option value="">-- วิชาเรียน --</option>';

    data.subjects.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.subject_id;
        opt.textContent = s.subject_name;
        sel.appendChild(opt);
    });
}





async function filterStudentAttendance() {
    const subjectId = document.getElementById('stu-subject-select').value;
    const sessionId = document.getElementById('stu-session-select').value || '';

    if (!subjectId) {
        alert('กรุณาเลือกวิชา');
        return;
    }

    const res = await fetch(
        `/api/student/attendance/by-subject?subject_id=${subjectId}&session_id=${sessionId}`,
        { headers: getAuthHeaders() }
    );

    const data = await res.json();
    if (!res.ok) {
        alert(data.error || 'โหลดข้อมูลไม่สำเร็จ');
        return;
    }

    renderStudentAttendance(data.records);
}




function renderStudentAttendance(rows) {
    const box = document.getElementById('student-attendance-result');

    if (!rows.length) {
        box.innerHTML = '<div class="muted">ไม่มีข้อมูล</div>';
        return;
    }

    let html = `
  <table>
    <thead>
      <tr>
        <th>วันที่</th>
        <th>เวลา</th>
        <th>สถานะ</th>
        <th>เวลาเช็กชื่อ</th>
      </tr>
    </thead>
    <tbody>`;

    rows.forEach(r => {
        html += `
    <tr>
      <td>${formatDateTh(r.date)}</td>
      <td>${formatTime(r.start_time)} - ${r.end_time ? formatTime(r.end_time) : ''}</td>
      <td>
        <span class="chip ${statusClass(r.status)}">${r.status}</span>
      </td>
      <td>${r.time_stamp ? formatDateTimeTh(r.time_stamp) : '-'}</td>
    </tr>`;
    });

    html += '</tbody></table>';
    box.innerHTML = html;
}





// Bind event listener
const subjectSelect = document.getElementById('stu-subject-select');
if (subjectSelect) {
    subjectSelect.addEventListener('change', onStudentSubjectChange);
}


async function onStudentSubjectChange() {
    const subjectId = document.getElementById('stu-subject-select').value;
    const sessionSel = document.getElementById('stu-session-select');

    sessionSel.innerHTML = '<option value="">-- เลือกรอบเรียน --</option>';

    if (!subjectId) return;

    try {
        const res = await fetch(`/api/student/sessions?subject_id=${subjectId}`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Load sessions failed');

        if (data.sessions.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = "-- ไม่มีรอบเรียน --";
            opt.disabled = true;
            sessionSel.appendChild(opt);
            return;
        }

        data.sessions.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.session_id;

            let displayTime = s.start_time;
            try {
                const dateStr = formatDateTh(s.date);
                const timeStr = formatTime(s.start_time);
                displayTime = `${dateStr} ${timeStr}`; // Valid format
            } catch (e) {
                console.error('Date format error', e);
                // Fallback to raw if formatting fails
                displayTime = `${s.date} ${s.start_time}`;
            }

            opt.textContent = displayTime;
            sessionSel.appendChild(opt);
        });
    } catch (err) {
        console.error(err);
        alert('ไม่สามารถโหลดรอบเรียนได้');
    }
}


async function init() {
    try {
        await loadMyProfile();
        await loadStudentSummary();
        await loadStudentSubjects();
        await checkLiveSession();
    } catch (e) {
        console.error('Init failed', e);
    }
}

init();
