const pool = require('./db');

async function checkSessions() {
    try {
        console.log('--- JOINED SESSIONS ---');
        const [rows] = await pool.query(`
            SELECT s.session_id, sub.subject_name, s.date, s.start_time 
            FROM sessions s
            JOIN subjects sub ON s.subject_id = sub.subject_id
            ORDER BY sub.subject_name
        `);
        console.table(rows);

        console.log('\n--- ALL SUBJECTS ---');
        const [subs] = await pool.query('SELECT * FROM subjects');
        console.table(subs);

    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        process.exit();
    }
}

checkSessions();
