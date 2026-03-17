require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'fingerprint_attendance',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function migrate() {
    try {
        console.log('Checking for template column in students table...');
        const [rows] = await pool.query("SHOW COLUMNS FROM students LIKE 'template_data'");
        if (rows.length === 0) {
            console.log('Adding template_data column...');
            await pool.query("ALTER TABLE students ADD COLUMN template_data TEXT DEFAULT NULL");
            console.log('Column added successfully.');
        } else {
            console.log('Column already exists.');
        }

        // Also check enroll_commands for template_data during enroll done
        // When enroll finishes do we need template_data there?
        // Actually the ESP32 will send { command_id, template_data } to POST /api/iot/enroll/done
        // The server will then UPDATE students SET template_data = ? WHERE student_id = ?
        // That's sufficient.

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        pool.end();
    }
}

migrate();
