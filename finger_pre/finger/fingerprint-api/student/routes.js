const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

/* ------------------ Auth Middleware (Duplicated for Independence) ------------------ */
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'No token provided' });
    const parts = header.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid authorization header format' });
    const token = parts[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

/* ------------------ Routes ------------------ */

// Check Live Session
router.get('/live-session', authMiddleware, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'No permission' });
    }

    try {
        // 1. Find ACTIVE scanning session
        const [[scan]] = await pool.query(`
            SELECT * FROM scan_sessions
            WHERE status='scanning'
            ORDER BY started_at DESC
            LIMIT 1
        `);

        if (!scan) {
            return res.json({ live: false });
        }

        // 2. Get Session Details
        const [[details]] = await pool.query(`
            SELECT 
                s.session_id,
                s.date,
                s.start_time,
                sub.subject_name,
                sub.subject_id
            FROM sessions s
            JOIN subjects sub ON s.subject_id = sub.subject_id
            WHERE s.session_id = ?
        `, [scan.session_id]);

        if (!details) {
            return res.json({ live: false });
        }

        res.json({ live: true, session: details });

    } catch (err) {
        console.error('Check live session error:', err);
        res.status(500).json({ error: 'server error' });
    }
});

// Student Dashboard Summary
router.get('/summary', authMiddleware, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'No permission' });
    }

    // Find student_id
    const [[stu]] = await pool.query(
        'SELECT student_id, fingerprint_id FROM students WHERE user_id = ?',
        [req.user.user_id]
    );

    if (!stu) {
        return res.status(404).json({ error: 'student not found' });
    }

    /* 1. Today's sessions count */
    const [[today]] = await pool.query(`
        SELECT COUNT(*) AS total
        FROM sessions
        WHERE date = CURDATE()
    `);

    /* 2. Last check-in */
    const [[last]] = await pool.query(`
        SELECT 
          a.status, 
          a.time_stamp,
          sub.subject_name
        FROM attendance a
        JOIN sessions s ON a.session_id = s.session_id
        JOIN subjects sub ON s.subject_id = sub.subject_id
        WHERE a.student_id = ?
        ORDER BY a.time_stamp DESC
        LIMIT 1
    `, [stu.student_id]);

    res.json({
        today_sessions: today.total,
        last_attendance: last || null,
        fingerprint_id: stu.fingerprint_id
    });
});

// Student Attendance by Subject
router.get('/attendance/by-subject', authMiddleware, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'No permission' });
    }

    const { subject_id, session_id } = req.query;

    const [rows] = await pool.query(`
        SELECT 
            sub.subject_name,
            s.date,
            s.start_time,
            s.end_time,
            COALESCE(a.status, 'Absent') AS status,
            a.time_stamp
        FROM sessions s
        JOIN subjects sub ON sub.subject_id = s.subject_id
        LEFT JOIN attendance a 
            ON a.session_id = s.session_id
           AND a.student_id = (
               SELECT student_id FROM students WHERE user_id = ?
           )
        WHERE s.subject_id = ?
          AND (? IS NULL OR s.session_id = ?)
        ORDER BY s.date DESC
    `, [
        req.user.user_id,
        subject_id,
        session_id || null,
        session_id || null
    ]);

    res.json({ records: rows });
});

// Student Subjects List
router.get('/subjects', authMiddleware, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'No permission' });
    }

    const [rows] = await pool.query(`
        SELECT subject_id, subject_name
        FROM subjects
        ORDER BY subject_name
    `);

    res.json({ subjects: rows });
});

// Student Sessions for a Subject
router.get('/sessions', authMiddleware, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'No permission' });
    }

    const { subject_id } = req.query;
    if (!subject_id) {
        return res.status(400).json({ error: 'missing subject_id' });
    }

    const [rows] = await pool.query(`
        SELECT
          session_id,
          date,
          start_time,
          end_time
        FROM sessions
        WHERE subject_id = ?
        ORDER BY date DESC
    `, [subject_id]);

    res.json({ sessions: rows });
});

module.exports = router;
