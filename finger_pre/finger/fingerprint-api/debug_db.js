const pool = require('./db');

async function checkSubjects() {
    try {
        const [rows] = await pool.query('SELECT * FROM subjects');
        console.log('--- SUBJECTS IN DB ---');
        console.log(JSON.stringify(rows, null, 2));
        console.log('----------------------');
    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        process.exit();
    }
}

checkSubjects();
