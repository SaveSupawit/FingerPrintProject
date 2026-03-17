const pool = require('./db');

async function migrate() {
    try {
        console.log('Adding columns...');
        await pool.query(`ALTER TABLE sessions ADD COLUMN late_condition INT DEFAULT 15`);
        await pool.query(`ALTER TABLE sessions ADD COLUMN absent_condition INT DEFAULT 30`);
        console.log('Done.');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

migrate();
