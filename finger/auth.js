/* ========= Helper ========= */
const $ = id => document.getElementById(id);

/* ========= Tab Switching ========= */
$("tab-login").onclick = () => switchTab("login");
$("tab-register").onclick = () => switchTab("register");

function switchTab(tab) {
    if (tab === "login") {
        $("tab-login").classList.add("active");
        $("tab-register").classList.remove("active");
        $("login-form").style.display = "block";
        $("register-form").style.display = "none";
    } else {
        $("tab-register").classList.add("active");
        $("tab-login").classList.remove("active");
        $("login-form").style.display = "none";
        $("register-form").style.display = "block";
    }
}

/* ========= LocalStorage ========= */
function getUsers() {
    try {
        return JSON.parse(localStorage.getItem("fa_users")) || [];
    } catch {
        return [];
    }
}

function saveUsers(users) {
    localStorage.setItem("fa_users", JSON.stringify(users));
}

function setCurrentUser(u) {
    localStorage.setItem("fa_currentUser", JSON.stringify(u));
}

/* ========= Register ========= */
$("btn-register").onclick = () => doRegister();

function doRegister() {
    const name = $("reg-name").value.trim();
    const username = $("reg-username").value.trim();
    const email = $("reg-email").value.trim();
    const pass = $("reg-password").value;
    const role = $("reg-role").value;
    const student_id = $("reg-studentid").value.trim() || null;

    $("reg-msg").innerText = "";

    if (!name || !username || !pass) {
        return $("reg-msg").innerText = "กรุณากรอกข้อมูลให้ครบ";
    }

    const users = getUsers();

    if (users.some(u => u.username === username || u.email === email)) {
        return $("reg-msg").innerText = "มี username หรือ email นี้แล้ว";
    }

    const newUser = {
        id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
        name,
        username,
        email,
        password: pass,
        role,
        student_id: role === "student" ? student_id : null,
        fingerprint_id: null
    };

    users.push(newUser);
    saveUsers(users);
    setCurrentUser(newUser);

    alert("สมัครสำเร็จ!");
    location.href = "index.html";
}

/* ========= Login ========= */
$("btn-login").onclick = () => doLogin();

function doLogin() {
    const input = $("login-email").value.trim();
    const pass = $("login-password").value;

    $("login-msg").innerText = "";

    const users = getUsers();
    const user = users.find(u =>
        (u.username === input || u.email === input) && u.password === pass
    );

    if (!user) {
        $("login-msg").innerText = "ไม่พบผู้ใช้หรือรหัสผ่านผิด";
        return;
    }

    setCurrentUser(user);
    alert("เข้าสู่ระบบสำเร็จ!");
    location.href = "index.html";
}

/* ========= Seed Demo User (ครั้งแรกเท่านั้น) ========= */
(function () {
    if (getUsers().length === 0) {
        saveUsers([
            { id: 1, name: "Teacher A", username: "teacher", email: "teacher@school", password: "pass", role: "teacher", student_id: null, fingerprint_id: null },
            { id: 2, name: "Somchai", username: "somchai", email: "somchai@school", password: "pass", role: "student", student_id: "101", fingerprint_id: null },
            { id: 3, name: "Mali", username: "mali", email: "mali@school", password: "pass", role: "student", student_id: "102", fingerprint_id: 7 }
        ]);
    }
})();
