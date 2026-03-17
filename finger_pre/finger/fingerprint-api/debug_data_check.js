const pool = require('./db');

async function checkData() {
    try {
        const [subjects] = await pool.query('SELECT subject_id, subject_name FROM subjects');
        console.log('--- SUBJECTS ---');
        console.log(JSON.stringify(subjects, null, 2));

        for (const sub of subjects) {
            const [sessions] = await pool.query('SELECT session_id, date, start_time FROM sessions WHERE subject_id = ?', [sub.subject_id]);
            console.log(`\nSubject: ${sub.subject_name} (ID: ${sub.subject_id}) has ${sessions.length} sessions.`);
            if (sessions.length > 0) {
                console.log(JSON.stringify(sessions, null, 2));
            }
        }

    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        process.exit();
    }
}

checkData();
