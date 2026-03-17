const pool = require('./db');

async function checkSchema() {
    try {
        const [rows] = await pool.query('DESCRIBE sessions');
        console.table(rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkSchema();
