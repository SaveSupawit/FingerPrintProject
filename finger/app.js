/* ---------------------------
  Prototype data (in-memory)
----------------------------*/
let state = {
    role: 'student',
    currentUser: { name: 'Somchai', role: 'student', student_id: 101, fingerprint_id: null },
    students: [
        { student_id: 101, name: 'Somchai', class: 'ม.6/1', fingerprint_id: null },
        { student_id: 102, name: 'Mali', class: 'ม.6/2', fingerprint_id: 7 },
        { student_id: 103, name: 'Rungnapha', class: 'ม.6/3', fingerprint_id: 12 }
    ],
    teachers: [
        { teacher_id: 201, name: 'Teacher A' }
    ],
    subjects: [
        { subject_id: 1, subject_name: 'Mathematics', teacher_id: 201 },
        { subject_id: 2, subject_name: 'Physics', teacher_id: 201 }
    ],
    sessions: [],
    attendance: [],
    lastAttendanceId: 1000,
    lastSessionId: 500
};

const $ = sel => document.querySelector(sel);

// event listeners
document.getElementById('role-student').addEventListener('click', () => switchRole('student'));
document.getElementById('role-teacher').addEventListener('click', () => switchRole('teacher'));
document.getElementById('student-subject-select').addEventListener('change', renderStudentAttendance);

function init() {
    // hide teacher quick actions by default on load (start as student)
    const qa = document.getElementById('teacher-quick-actions');
    if (qa) qa.style.display = 'none';

    document.getElementById('current-user').innerText = state.currentUser.name;
    renderSubjectSelectors();
    renderStudents();
    renderStudentSummary();
    renderTeacherSummary();
    renderAttendanceBySession();
}
init();

/* ---------------------------
  Role switch (updated)
----------------------------*/
function switchRole(role) {
    state.role = role;

    // toggle active button
    document.getElementById('role-student').classList.toggle('active', role === 'student');
    document.getElementById('role-teacher').classList.toggle('active', role === 'teacher');

    // show/hide dashboards
    document.getElementById('student-dashboard').style.display = role === 'student' ? 'block' : 'none';
    document.getElementById('teacher-dashboard').style.display = role === 'teacher' ? 'block' : 'none';

    // update current user and teacher quick actions visibility
    const teacherQa = document.getElementById('teacher-quick-actions');
    if (role === 'teacher') {
        state.currentUser = { name: 'Teacher A', role: 'teacher', teacher_id: 201 };
        if (teacherQa) teacherQa.style.display = 'block';
    } else {
        state.currentUser = { name: 'Somchai', role: 'student', student_id: 101, fingerprint_id: state.students.find(s => s.student_id === 101).fingerprint_id || null };
        if (teacherQa) teacherQa.style.display = 'none';
    }

    document.getElementById('current-user').innerText = state.currentUser.name;

    renderStudentSummary();
    renderTeacherSummary();
}

/* ---------------------------
  Subjects / Selects rendering
----------------------------*/
function renderSubjectSelectors() {
    const s1 = $('#student-subject-select'); s1.innerHTML = '';
    const t1 = $('#teacher-subject-select'); if (t1) t1.innerHTML = '<option value="">-- เลือกวิชา --</option>';
    state.subjects.forEach(s => {
        const o = document.createElement('option'); o.value = s.subject_id; o.textContent = s.subject_name;
        s1.appendChild(o);
        if (t1) {
            const o2 = o.cloneNode(true);
            t1.appendChild(o2);
        }
    });
    const firstSub = state.subjects[0];
    if (firstSub) {
        $('#preview-subject').innerText = firstSub.subject_name;
        $('#preview-time').innerText = 'No session';
    }
}

/* ---------------------------
  Student summary + attendance
----------------------------*/
function renderStudentSummary() {
    const student = state.students.find(s => s.student_id === state.currentUser.student_id) || state.students[0];
    const fpStatusEl = $('#student-fp-status');
    const fpIdEl = $('#student-fp-id');
    if (student && student.fingerprint_id) {
        fpStatusEl.innerHTML = '<span class="chip">Enrolled</span>';
        fpIdEl.innerText = student.fingerprint_id;
        state.currentUser.fingerprint_id = student.fingerprint_id;
    } else {
        fpStatusEl.innerHTML = '<span class="chip" style="background:#fff1f0;color:#7f1d1d">Not Enrolled</span>';
        fpIdEl.innerText = '—';
        state.currentUser.fingerprint_id = null;
    }
    const last = state.attendance.filter(a => a.student_id === student.student_id).sort((a, b) => new Date(b.time) - new Date(a.time))[0];
    $('#student-last-att').innerText = last ? `${new Date(last.time).toLocaleString()} (${last.status})` : '-';
    $('#student-today-count').innerText = state.sessions.filter(sess => isToday(sess.date)).length;
    const sselect = $('#student-subject-select');
    if (sselect && sselect.options.length === 0) renderSubjectSelectors();
    renderStudentAttendance();
}

/* ---------------------------
  Render student attendance table
----------------------------*/
function renderStudentAttendance() {
    const selEl = $('#student-subject-select');
    const sel = selEl ? selEl.value : '';
    const studentId = state.currentUser.student_id;
    let html = '';
    if (!sel) {
        html = '<div class="muted">เลือกวิชาจากเมนูด้านบนเพื่อดูประวัติ</div>';
    } else {
        const subjId = parseInt(sel);
        const sessions = state.sessions.filter(s => s.subject_id === subjId).sort((a, b) => new Date(b.date) - new Date(a.date));
        if (sessions.length === 0) {
            html = '<div class="muted">ยังไม่มี session สำหรับวิชานี้</div>';
        } else {
            html = `<table><thead><tr><th>วันที่</th><th>เวลา</th><th>สถานะ</th></tr></thead><tbody>`;
            sessions.forEach(sess => {
                const att = state.attendance.find(a => a.session_id === sess.session_id && a.student_id === studentId);
                const status = att ? att.status : 'Absent';
                html += `<tr><td>${sess.date}</td><td>${sess.start_time} - ${sess.end_time}</td><td>${status}</td></tr>`;
            });
            html += `</tbody></table>`;
        }
    }
    const target = $('#student-att-table');
    if (target) target.innerHTML = html;
}

/* ---------------------------
  Students management (teacher)
----------------------------*/
function renderStudents() {
    const q = $('#student-search') ? $('#student-search').value.trim().toLowerCase() : '';
    let rowsHtml = `<table><thead><tr><th>รหัส</th><th>ชื่อ</th><th>ห้อง</th><th>Fingerprint</th><th>Actions</th></tr></thead><tbody>`;
    state.students.filter(s => !q || s.name.toLowerCase().includes(q)).forEach(s => {
        rowsHtml += `<tr>
      <td>${s.student_id}</td>
      <td>${s.name}</td>
      <td>${s.class}</td>
      <td>${s.fingerprint_id ? '<span class="chip">ID ' + s.fingerprint_id + '</span>' : '<span class="muted">Not Registered</span>'}</td>
      <td class="table-actions">
        <button class="btn secondary" onclick="openEditStudent(${s.student_id})">Edit</button>
        <button class="btn" onclick="enrollFingerprint(${s.student_id})">Enroll</button>
        <button class="btn secondary" onclick="deleteStudent(${s.student_id})">Delete</button>
      </td>
    </tr>`;
    });
    rowsHtml += `</tbody></table>`;
    const target = $('#students-table');
    if (target) target.innerHTML = rowsHtml;
    const totalEl = $('#teacher-total-students');
    if (totalEl) totalEl.innerText = state.students.length;
}

function openAddStudent() {
    showModal(`<div class="flex-between"><h3>เพิ่มนักเรียน</h3><button onclick="closeModal()" class="btn secondary">Close</button></div>
  <div style="margin-top:12px">
    <div class="form-row"><input id="new-name" placeholder="ชื่อ–สกุล"></div>
    <div class="form-row"><input id="new-class" placeholder="ห้อง เช่น ม.6/1"></div>
    <div style="margin-top:12px;display:flex;gap:8px"><button class="btn" onclick="addStudent()">Save</button><button class="btn secondary" onclick="closeModal()">Cancel</button></div>
  </div>`);
}
function addStudent() {
    const name = $('#new-name').value.trim(); const cls = $('#new-class').value.trim();
    if (!name) { alert('กรุณากรอกชื่อ'); return; }
    const newId = Math.max(0, ...state.students.map(s => s.student_id)) + 1;
    state.students.push({ student_id: newId, name, class: cls || '', fingerprint_id: null });
    closeModal();
    renderStudents();
    renderSubjectSelectors();
}
function openEditStudent(id) {
    const s = state.students.find(x => x.student_id === id);
    showModal(`<div class="flex-between"><h3>แก้ไขนักเรียน</h3><button onclick="closeModal()" class="btn secondary">Close</button></div>
  <div style="margin-top:12px">
    <div class="form-row"><input id="edit-name" value="${s.name}"></div>
    <div class="form-row"><input id="edit-class" value="${s.class}"></div>
    <div style="margin-top:12px;display:flex;gap:8px"><button class="btn" onclick="saveEditStudent(${s.student_id})">Save</button><button class="btn secondary" onclick="closeModal()">Cancel</button></div>
  </div>`);
}
function saveEditStudent(id) { const s = state.students.find(x => x.student_id === id); s.name = $('#edit-name').value.trim(); s.class = $('#edit-class').value.trim(); closeModal(); renderStudents(); }
function deleteStudent(id) { if (!confirm('ลบนักเรียนใช่ไหม?')) return; state.students = state.students.filter(s => s.student_id !== id); renderStudents(); renderStudentSummary(); }

function enrollFingerprint(student_id) {
    const newFp = Math.floor(Math.random() * 900) + 100;
    const s = state.students.find(x => x.student_id === student_id);
    if (!s) return alert('ไม่พบข้อมูล');
    s.fingerprint_id = newFp;
    alert(`ลงทะเบียนสำเร็จ fingerprint_id = ${newFp} for ${s.name}`);
    renderStudents(); renderStudentSummary();
}

function openCreateSession() {
    const subjectOptions = state.subjects.map(s => `<option value="${s.subject_id}">${s.subject_name}</option>`).join('');
    showModal(`<div class="flex-between"><h3>Create Session</h3><button onclick="closeModal()" class="btn secondary">Close</button></div>
  <div style="margin-top:12px">
    <div class="form-row"><select id="new-subject">${subjectOptions}</select></div>
    <div class="form-row"><input id="new-date" type="date" /></div>
    <div class="form-row"><input id="new-start" type="time" /> <input id="new-end" type="time" /></div>
    <div style="margin-top:12px;display:flex;gap:8px"><button class="btn" onclick="createSession()">Create</button><button class="btn secondary" onclick="closeModal()">Cancel</button></div>
  </div>`);
}
function createSession() {
    const subj = parseInt($('#new-subject').value); const date = $('#new-date').value; const start = $('#new-start').value; const end = $('#new-end').value;
    if (!subj || !date || !start) { alert('กรอกข้อมูลไม่ครบ'); return; }
    state.lastSessionId++;
    const sess = { session_id: state.lastSessionId, subject_id: subj, teacher_id: state.currentUser.teacher_id || 201, date, start_time: start, end_time: end || '' };
    state.sessions.push(sess);
    closeModal();
    renderSubjectSelectors();
    renderTeacherSummary();
    renderAttendanceBySession();
}

function renderAttendanceBySession() {
    const subj = parseInt($('#teacher-subject-select').value) || null;
    const sessSel = $('#teacher-session-select');
    sessSel.innerHTML = '<option value="">-- เลือกรอบเรียน --</option>';
    const sessions = subj ? state.sessions.filter(s => s.subject_id === subj) : state.sessions;
    sessions.forEach(s => {
        const opt = document.createElement('option'); opt.value = s.session_id;
        const d = new Date(s.date);
        const dateStr = !isNaN(d) ? d.toLocaleDateString('th-TH') : s.date;
        opt.textContent = `${dateStr} ${s.start_time}`;
        sessSel.appendChild(opt);
    });
    const chosen = parseInt(sessSel.value) || (sessions[0] ? sessions[0].session_id : null);
    if (!chosen) {
        $('#attendance-table').innerHTML = '<div class="muted">ยังไม่มี session ให้แสดง</div>';
        return;
    }
    const rows = state.students.map(st => {
        const att = state.attendance.find(a => a.session_id === chosen && a.student_id === st.student_id);
        return `<tr>
      <td>${st.student_id}</td>
      <td>${st.name}</td>
      <td>${att ? new Date(att.time).toLocaleTimeString() : '--'}</td>
      <td>${att ? att.status : 'Absent'}</td>
      <td>${att ? att.source_device : '-'}</td>
    </tr>`;
    }).join('');
    $('#attendance-table').innerHTML = `<table><thead><tr><th>รหัส</th><th>ชื่อ</th><th>เวลา</th><th>สถานะ</th><th>device</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function simulateScan() {
    if (state.sessions.length === 0) { alert('ไม่มี session ใดๆ ให้ทดสอบ'); return; }
    const latestSession = state.sessions[state.sessions.length - 1];
    const registered = state.students.filter(s => s.fingerprint_id);
    if (registered.length === 0) { alert('ยังไม่มีนักเรียนลงทะเบียนลายนิ้วมือ'); return; }
    const chosen = registered[Math.floor(Math.random() * registered.length)];
    state.lastAttendanceId++;
    const timeNow = new Date().toISOString();
    state.attendance.push({ attendance_id: state.lastAttendanceId, student_id: chosen.student_id, session_id: latestSession.session_id, time: timeNow, status: 'Present', source_device: 'MCU-01' });
    alert(`Simulated: ${chosen.name} checked-in for session ${latestSession.session_id}`);
    renderTeacherSummary();
    renderAttendanceBySession();
    renderStudentSummary();
}
function simulateStudentScan() {
    const student = state.students.find(s => s.student_id === state.currentUser.student_id);
    if (!student) { alert('ไม่พบข้อมูลนักเรียน'); return; }
    if (!state.sessions.length) { alert('ยังไม่มี session สร้างไว้'); return; }
    if (!student.fingerprint_id) { alert('คุณยังไม่ได้ลงทะเบียนลายนิ้วมือ'); return; }
    const latestSession = state.sessions[state.sessions.length - 1];
    state.lastAttendanceId++;
    state.attendance.push({ attendance_id: state.lastAttendanceId, student_id: student.student_id, session_id: latestSession.session_id, time: new Date().toISOString(), status: 'Present', source_device: 'MCU-01' });
    alert('เช็กชื่อสำเร็จ (simulate)');
    renderStudentSummary();
    renderTeacherSummary();
}

function renderTeacherSummary() {
    const latest = state.sessions[state.sessions.length - 1];
    $('#teacher-current-session').innerText = latest ? `${state.subjects.find(s => s.subject_id === latest.subject_id).subject_name} (${latest.date} ${latest.start_time})` : 'No session';
    $('#preview-subject').innerText = latest ? state.subjects.find(s => s.subject_id === latest.subject_id).subject_name : '—';
    $('#preview-time').innerText = latest ? `${latest.date} ${latest.start_time} - ${latest.end_time}` : '—';
    $('#preview-status').innerText = latest ? 'Live' : 'Idle';
    if (latest) {
        const count = state.attendance.filter(a => a.session_id === latest.session_id).length;
        $('#teacher-present-count').innerText = count;
    } else $('#teacher-present-count').innerText = 0;
}

function showModal(html) {
    $('#modal').innerHTML = html;
    $('#modal-backdrop').style.display = 'flex';
}
function closeModal() { $('#modal-backdrop').style.display = 'none'; $('#modal').innerHTML = ''; }

function showEnrollmentGuide() {
    showModal(`<div class="flex-between"><h3>Enrollment Guide</h3><button onclick="closeModal()" class="btn secondary">Close</button></div>
    <div style="margin-top:12px">
      <ol>
        <li>เลือกนักเรียนที่ต้องการลงทะเบียนจากหน้า Manage Students</li>
        <li>คลิกปุ่ม <strong>Enroll</strong> เพื่อทำการจำลองการสแกน</li>
        <li>ระบบจะสร้าง fingerprint_id แบบสุ่มและผูกกับนักเรียน</li>
        <li>หลังจากลงทะเบียน นักเรียนสามารถสแกนเช็กชื่อได้ (simulate)</li>
      </ol>
      <p class="muted">เมื่อเชื่อม ESP32 จริง ให้ ESP32 ส่ง POST /api/attendance กับ payload ที่มี fingerprint_id และ session_id</p>
    </div>`);
}

function isToday(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

document.getElementById('teacher-subject-select').addEventListener('change', () => {
    $('#teacher-session-select').innerHTML = '<option value="">-- เลือกรอบเรียน --</option>';
});
document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal();
});

