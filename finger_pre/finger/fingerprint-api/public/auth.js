// auth.js (client-side)
const API_BASE = '/api';

const $ = id => document.getElementById(id);

/* ฟังก์ชันช่วย: ไปหน้า html ตาม role */
function goToDashboardByRole(user) {
    if (!user || !user.role) {
        window.location.href = '/';
        return;
    }

    if (user.role === 'teacher') {
        window.location.href = '/teacher-home.html';
    } else if (user.role === 'student') {
        window.location.href = '/student-home.html';
    } else if (user.role === 'admin') {
        window.location.href = '/admin.html';
    } else {
        window.location.href = '/';
    }
}

/* สลับแท็บ login / register เหมือนเดิม */
function switchTab(tab) {
    if (tab === 'login') {
        $('tab-login').classList.add('active');
        $('tab-register').classList.remove('active');
        $('login-form').style.display = 'block';
        $('register-form').style.display = 'none';
    } else {
        $('tab-register').classList.add('active');
        $('tab-login').classList.remove('active');
        $('login-form').style.display = 'none';
        $('register-form').style.display = 'block';
    }
}

$('tab-login').addEventListener('click', () => switchTab('login'));
$('tab-register').addEventListener('click', () => switchTab('register'));

/* ---------- Register ---------- */
$('btn-register').addEventListener('click', async () => {
    $('reg-msg').innerText = '';
    const payload = {
        name: $('reg-name').value.trim(),
        username: $('reg-username').value.trim(),
        email: $('reg-email').value.trim(),
        password: $('reg-password').value,
        role: $('reg-role').value,
        student_code: $('reg-studentid').value.trim() || null
    };

    if (!payload.name || !payload.username || !payload.password) {
        $('reg-msg').innerText = 'กรุณากรอกข้อมูลให้ครบ';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const j = await res.json();
        if (!res.ok) {
            $('reg-msg').innerText = j.error || 'register failed';
            return;
        }
        localStorage.setItem('fa_token', j.token);
        localStorage.setItem('fa_user', JSON.stringify(j.user));
        alert('สมัครสำเร็จ');
        goToDashboardByRole(j.user);   // 👈 ตรงนี้เปลี่ยนจาก '/' เป็นตาม role
    } catch (e) {
        console.error(e);
        $('reg-msg').innerText = 'เกิดข้อผิดพลาด';
    }
});

/* ---------- Login ---------- */
$('btn-login').addEventListener('click', async () => {
    $('login-msg').innerText = '';
    const payload = {
        usernameOrEmail: $('login-email').value.trim(),
        password: $('login-password').value
    };
    if (!payload.usernameOrEmail || !payload.password) {
        $('login-msg').innerText = 'กรุณากรอกข้อมูลให้ครบ';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const j = await res.json();
        if (!res.ok) {
            $('login-msg').innerText = j.error || 'login failed';
            return;
        }
        localStorage.setItem('fa_token', j.token);
        localStorage.setItem('fa_user', JSON.stringify(j.user));
        alert('ล็อกอินสำเร็จ');
        goToDashboardByRole(j.user);   // 👈 ตรงนี้เปลี่ยนจาก '/' เป็นตาม role
    } catch (e) {
        console.error(e);
        $('login-msg').innerText = 'เกิดข้อผิดพลาด';
    }
});
