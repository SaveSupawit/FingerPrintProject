const pool = require('./db');

async function checkSessions() {
    try {
        const [subjects] = await pool.query('SELECT * FROM subjects');
        console.log('--- SUBJECTS ---');
        console.table(subjects);

        const [sessions] = await pool.query('SELECT * FROM sessions');
        console.log('\n--- SESSIONS ---');
        console.table(sessions);
    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        process.exit();
    }
}

checkSessions();
