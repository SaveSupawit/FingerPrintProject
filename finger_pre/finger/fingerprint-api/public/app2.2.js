/* =====================
   Config
===================== */
const API_BASE = '/api';
const $ = s => document.querySelector(s);

function getAuthHeaders() {
    const token = localStorage.getItem('fa_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
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
   Helpers
===================== */
function statusClass(status) {
    if (status === 'Present') return 'chip-green';
    if (status === 'Late') return 'chip-yellow';
    return 'chip danger'; // Absent
}

async function loadMyProfile() {
    const res = await fetch('/api/me', {
        headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!res.ok) return;

    const fpStatusEl = document.getElementById('student-fp-status');
    const fpIdEl = document.getElementById('student-fp-id');

    if (!fpStatusEl || !fpIdEl) return;

    if (data.user.fingerprint_id) {
        fpStatusEl.innerHTML = `<span class="chip">Enrolled</span>`;
        fpIdEl.innerText = data.user.fingerprint_id;
    } else {
        fpStatusEl.innerHTML = `<span class="chip danger">Not Enrolled</span>`;
        fpIdEl.innerText = '—';
    }
}


/* =====================
   Student Summary
===================== */
async function loadStudentSummary() {
    const res = await fetch(`${API_BASE}/student/summary`, {
        headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) return;

    // วันนี้เรียนกี่คาบ
    $('#student-today-count').innerText = data.today_sessions ?? 0;

    // เช็กชื่อล่าสุด
    if (data.last_attendance) {
        const time = new Date(data.last_attendance.time_stamp)
            .toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

        renderLastAttendance(data.last_attendance.status, time);
    } else {
        renderLastAttendance('-', '-');
    }
}

function renderLastAttendance(status, time) {
    const statusEl = document.getElementById('student-last-att');
    const timeEl = statusEl?.nextElementSibling;

    if (!statusEl || !timeEl) return;

    if (!status || status === '-') {
        statusEl.innerHTML = '-';
        timeEl.innerHTML = 'เวลา: -';
        return;
    }

    statusEl.innerHTML = `
        <span class="chip ${statusClass(status)}">${status}</span>
    `;
    timeEl.innerHTML = `เวลา: <strong>${time}</strong>`;
}

/* =====================
   Subjects (จาก session ที่อาจารย์สร้าง)
===================== */
async function loadStudentSubjects() {
    const res = await fetch(`${API_BASE}/student/subjects`, {
        headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) return;

    const sel = document.getElementById('stu-subject-select');
    if (!sel) return;

    sel.innerHTML = '<option value="">-- วิชาเรียน --</option>';
    data.subjects.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.subject_id;
        opt.textContent = s.subject_name;
        sel.appendChild(opt);
    });
}

/* =====================
   Sessions (ตามวิชา)
===================== */
async function onStudentSubjectChange() {
    const subjectId = document.getElementById('stu-subject-select').value;
    const sessionSel = document.getElementById('stu-session-select');

    if (!sessionSel) return;
    sessionSel.innerHTML = '<option value="">-- ทุกรอบเรียน --</option>';

    if (!subjectId) return;

    const res = await fetch(
        `${API_BASE}/student/sessions?subject_id=${subjectId}`,
        { headers: getAuthHeaders() }
    );
    const data = await res.json();
    if (!res.ok) return;

    data.sessions.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.session_id;
        opt.textContent = `${s.date} ${s.start_time} - ${s.end_time}`;
        sessionSel.appendChild(opt);
    });
}

/* =====================
   Attendance by Subject
===================== */
async function filterStudentAttendance() {
    const subjectId = document.getElementById('stu-subject-select').value;
    const sessionId = document.getElementById('stu-session-select').value || '';

    if (!subjectId) {
        alert('กรุณาเลือกวิชา');
        return;
    }

    const res = await fetch(
        `${API_BASE}/student/attendance/by-subject?subject_id=${subjectId}&session_id=${sessionId}`,
        { headers: getAuthHeaders() }
    );
    const data = await res.json();
    if (!res.ok) return;

    renderStudentAttendance(data.records);
}

function renderStudentAttendance(rows) {
    const box = document.getElementById('student-attendance-result');
    if (!box) return;

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
      <tbody>
    `;

    rows.forEach(r => {
        html += `
        <tr>
          <td>${r.date}</td>
          <td>${r.start_time} - ${r.end_time}</td>
          <td><span class="chip ${statusClass(r.status)}">${r.status}</span></td>
          <td>${r.time_stamp ?? '-'}</td>
        </tr>
        `;
    });

    html += '</tbody></table>';
    box.innerHTML = html;
}

/* =====================
   Init
===================== */
async function init() {
    await loadMyProfile();
    await loadStudentSummary();
    await loadStudentSubjects();
}

init();
