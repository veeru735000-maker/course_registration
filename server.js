const express = require('express');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// 1. Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 2. Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// 4. Create MySQL connection pool using mysql2/promise
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'veeru',
  database: process.env.DB_NAME || 'gpcet',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Detect database schema and table details dynamically
let dbConfig = {
  tableName: 'courses',
  idCol: 'courses_id',
  nameCol: 'courses_name',
  creditsCol: 'courses_credits',
  deptCol: 'courses_dep',
  semCol: 'courses_sem'
};

async function initDbConfig() {
  try {
    const connection = await pool.getConnection();
    console.log('---------------------------------------------------------');
    console.log('✓ Connected to MySQL database successfully!');
    console.log(`  Database: ${process.env.DB_NAME || 'gpcet'}`);
    console.log(`  User:     ${process.env.DB_USER || 'root'}`);
    console.log(`  Host:     ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);

    // Check whether 'courses' or 'course' table exists in database
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log(`  Tables in database: [ ${tableNames.join(', ')} ]`);

    if (tableNames.includes('courses')) {
      dbConfig.tableName = 'courses';
      const [cols] = await connection.query('DESCRIBE courses');
      const colNames = cols.map(c => c.Field);
      dbConfig.idCol = colNames.includes('courses_id') ? 'courses_id' : 'course_id';
      dbConfig.nameCol = colNames.includes('courses_name') ? 'courses_name' : 'course_name';
      dbConfig.creditsCol = colNames.includes('courses_credits') ? 'courses_credits' : (colNames.includes('course_creidts') ? 'course_creidts' : 'credits');
      dbConfig.deptCol = colNames.includes('courses_dep') ? 'courses_dep' : (colNames.includes('course_dept') ? 'course_dept' : 'department');
      dbConfig.semCol = colNames.includes('courses_sem') ? 'courses_sem' : (colNames.includes('course_semister') ? 'course_semister' : 'semester');
    } else if (tableNames.includes('course')) {
      dbConfig.tableName = 'course';
      const [cols] = await connection.query('DESCRIBE course');
      const colNames = cols.map(c => c.Field);
      dbConfig.idCol = colNames.includes('course_id') ? 'course_id' : 'courses_id';
      dbConfig.nameCol = colNames.includes('course_name') ? 'course_name' : 'courses_name';
      dbConfig.creditsCol = colNames.includes('course_creidts') ? 'course_creidts' : 'courses_credits';
      dbConfig.deptCol = colNames.includes('course_dept') ? 'course_dept' : 'courses_dep';
      dbConfig.semCol = colNames.includes('course_semister') ? 'course_semister' : 'courses_sem';
    }

    console.log(`  Active Table: '${dbConfig.tableName}' (Columns: ${dbConfig.idCol}, ${dbConfig.nameCol}, ${dbConfig.creditsCol}, ${dbConfig.deptCol}, ${dbConfig.semCol})`);
    console.log('---------------------------------------------------------');
    connection.release();
  } catch (err) {
    console.error('---------------------------------------------------------');
    console.error('⚠ Database connection error:', err.message);
    console.error('  Please verify MySQL service is running and credentials in .env are correct.');
    console.error('---------------------------------------------------------');
  }
}

initDbConfig();

// =========================================================
// API ROUTES
// =========================================================

/**
 * A. GET /api/courses
 * Fetch all course records from the database
 */
app.get('/api/courses', async (req, res, next) => {
  try {
    const sql = `
      SELECT 
        ${dbConfig.idCol} AS course_id,
        ${dbConfig.nameCol} AS course_name,
        ${dbConfig.creditsCol} AS course_creidts,
        ${dbConfig.deptCol} AS course_dept,
        ${dbConfig.semCol} AS course_semister,
        ${dbConfig.idCol} AS courses_id,
        ${dbConfig.nameCol} AS courses_name,
        ${dbConfig.creditsCol} AS courses_credits,
        ${dbConfig.deptCol} AS courses_dep,
        ${dbConfig.semCol} AS courses_sem
      FROM ${dbConfig.tableName}
      ORDER BY ${dbConfig.idCol} ASC
    `;
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching all courses:', error.message);
    next(error);
  }
});

/**
 * B. GET /api/courses/recent
 * Fetch up to five recently added courses
 */
app.get('/api/courses/recent', async (req, res, next) => {
  try {
    const sql = `
      SELECT 
        ${dbConfig.idCol} AS course_id,
        ${dbConfig.nameCol} AS course_name,
        ${dbConfig.creditsCol} AS course_creidts,
        ${dbConfig.deptCol} AS course_dept,
        ${dbConfig.semCol} AS course_semister,
        ${dbConfig.idCol} AS courses_id,
        ${dbConfig.nameCol} AS courses_name,
        ${dbConfig.creditsCol} AS courses_credits,
        ${dbConfig.deptCol} AS courses_dep,
        ${dbConfig.semCol} AS courses_sem
      FROM ${dbConfig.tableName}
      ORDER BY ${dbConfig.idCol} DESC
      LIMIT 5
    `;
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching recent courses:', error.message);
    next(error);
  }
});

/**
 * C. GET /api/dashboard/stats
 * Fetch aggregate statistics for dashboard cards
 */
app.get('/api/dashboard/stats', async (req, res, next) => {
  try {
    const sql = `
      SELECT 
        COUNT(*) AS totalCourses,
        COALESCE(SUM(${dbConfig.creditsCol}), 0) AS totalCredits,
        COUNT(DISTINCT ${dbConfig.deptCol}) AS totalDepartments,
        COUNT(DISTINCT ${dbConfig.semCol}) AS totalSemesters
      FROM ${dbConfig.tableName}
    `;
    const [rows] = await pool.query(sql);
    const stats = rows[0] || {};

    res.json({
      totalCourses: Number(stats.totalCourses) || 0,
      totalCredits: Number(stats.totalCredits) || 0,
      totalDepartments: Number(stats.totalDepartments) || 0,
      totalSemesters: Number(stats.totalSemesters) || 0
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error.message);
    next(error);
  }
});

/**
 * D. GET /api/courses/:id
 * Fetch a single course by its course_id
 */
app.get('/api/courses/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || id.trim() === '') {
      return res.status(400).json({ error: 'Course ID parameter is required.' });
    }

    const sql = `
      SELECT 
        ${dbConfig.idCol} AS course_id,
        ${dbConfig.nameCol} AS course_name,
        ${dbConfig.creditsCol} AS course_creidts,
        ${dbConfig.deptCol} AS course_dept,
        ${dbConfig.semCol} AS course_semister,
        ${dbConfig.idCol} AS courses_id,
        ${dbConfig.nameCol} AS courses_name,
        ${dbConfig.creditsCol} AS courses_credits,
        ${dbConfig.deptCol} AS courses_dep,
        ${dbConfig.semCol} AS courses_sem
      FROM ${dbConfig.tableName}
      WHERE ${dbConfig.idCol} = ?
    `;
    const [rows] = await pool.query(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: `Course with ID '${id}' was not found.` });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(`Error fetching course ID ${req.params.id}:`, error.message);
    next(error);
  }
});

/**
 * E. POST /api/courses
 * Create a new course record
 */
app.post('/api/courses', async (req, res, next) => {
  try {
    const course_id = req.body.course_id || req.body.courses_id;
    const course_name = req.body.course_name || req.body.courses_name;
    const course_credits = req.body.course_creidts !== undefined ? req.body.course_creidts : req.body.courses_credits;
    const course_dept = req.body.course_dept || req.body.courses_dep;
    const course_sem = req.body.course_semister || req.body.courses_sem;

    // Server-side validation
    if (!course_name || String(course_name).trim() === '') {
      return res.status(400).json({ error: 'Course Name is required.' });
    }
    if (course_credits === undefined || course_credits === null || course_credits === '') {
      return res.status(400).json({ error: 'Course Credits is required.' });
    }
    const parsedCredits = Number(course_credits);
    if (isNaN(parsedCredits) || parsedCredits < 0) {
      return res.status(400).json({ error: 'Course Credits must be a non-negative number.' });
    }
    if (!course_dept || String(course_dept).trim() === '') {
      return res.status(400).json({ error: 'Course Department is required.' });
    }
    if (!course_sem || String(course_sem).trim() === '') {
      return res.status(400).json({ error: 'Course Semester is required.' });
    }

    let insertId = course_id;

    // If ID is not provided, determine next numeric ID if table is not auto-increment
    if (!insertId || String(insertId).trim() === '') {
      const [maxRows] = await pool.query(`SELECT MAX(CAST(${dbConfig.idCol} AS UNSIGNED)) AS maxId FROM ${dbConfig.tableName}`);
      const maxId = maxRows[0]?.maxId;
      insertId = maxId ? String(Number(maxId) + 1) : '101';
    } else {
      insertId = String(insertId).trim();
    }

    // Insert into table
    const insertSql = `
      INSERT INTO ${dbConfig.tableName} (${dbConfig.idCol}, ${dbConfig.nameCol}, ${dbConfig.creditsCol}, ${dbConfig.deptCol}, ${dbConfig.semCol})
      VALUES (?, ?, ?, ?, ?)
    `;
    await pool.query(insertSql, [
      insertId,
      String(course_name).trim(),
      parsedCredits,
      String(course_dept).trim(),
      course_sem
    ]);

    res.status(201).json({
      message: 'Course created successfully.',
      course_id: insertId,
      course: {
        course_id: insertId,
        course_name: String(course_name).trim(),
        course_creidts: parsedCredits,
        course_dept: String(course_dept).trim(),
        course_semister: course_sem
      }
    });
  } catch (error) {
    console.error('Error inserting course:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: `A course with ID '${req.body.course_id || req.body.courses_id}' already exists. Please choose a unique Course ID.`
      });
    }
    next(error);
  }
});

/**
 * F. PUT /api/courses/:id
 * Update an existing course record
 */
app.put('/api/courses/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const course_name = req.body.course_name || req.body.courses_name;
    const course_credits = req.body.course_creidts !== undefined ? req.body.course_creidts : req.body.courses_credits;
    const course_dept = req.body.course_dept || req.body.courses_dep;
    const course_sem = req.body.course_semister || req.body.courses_sem;

    if (!id || id.trim() === '') {
      return res.status(400).json({ error: 'Course ID parameter is required.' });
    }

    // Check if the record exists
    const checkSql = `SELECT ${dbConfig.idCol} FROM ${dbConfig.tableName} WHERE ${dbConfig.idCol} = ?`;
    const [existing] = await pool.query(checkSql, [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: `Course with ID '${id}' was not found.` });
    }

    // Validation
    if (!course_name || String(course_name).trim() === '') {
      return res.status(400).json({ error: 'Course Name is required.' });
    }
    if (course_credits === undefined || course_credits === null || course_credits === '') {
      return res.status(400).json({ error: 'Course Credits is required.' });
    }
    const parsedCredits = Number(course_credits);
    if (isNaN(parsedCredits) || parsedCredits < 0) {
      return res.status(400).json({ error: 'Course Credits must be a non-negative number.' });
    }
    if (!course_dept || String(course_dept).trim() === '') {
      return res.status(400).json({ error: 'Course Department is required.' });
    }
    if (!course_sem || String(course_sem).trim() === '') {
      return res.status(400).json({ error: 'Course Semester is required.' });
    }

    const updateSql = `
      UPDATE ${dbConfig.tableName}
      SET ${dbConfig.nameCol} = ?, ${dbConfig.creditsCol} = ?, ${dbConfig.deptCol} = ?, ${dbConfig.semCol} = ?
      WHERE ${dbConfig.idCol} = ?
    `;
    await pool.query(updateSql, [
      String(course_name).trim(),
      parsedCredits,
      String(course_dept).trim(),
      course_sem,
      id
    ]);

    res.json({
      message: 'Course updated successfully.',
      course: {
        course_id: id,
        course_name: String(course_name).trim(),
        course_creidts: parsedCredits,
        course_dept: String(course_dept).trim(),
        course_semister: course_sem
      }
    });
  } catch (error) {
    console.error(`Error updating course ID ${req.params.id}:`, error.message);
    next(error);
  }
});

/**
 * G. DELETE /api/courses/:id
 * Delete a course record
 */
app.delete('/api/courses/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || id.trim() === '') {
      return res.status(400).json({ error: 'Course ID parameter is required.' });
    }

    const deleteSql = `DELETE FROM ${dbConfig.tableName} WHERE ${dbConfig.idCol} = ?`;
    const [result] = await pool.query(deleteSql, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: `Course with ID '${id}' was not found.` });
    }

    res.json({
      message: `Course with ID '${id}' was deleted successfully.`,
      course_id: id
    });
  } catch (error) {
    console.error(`Error deleting course ID ${req.params.id}:`, error.message);
    next(error);
  }
});

// Catch-all 404 for unknown API endpoints
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route '${req.method} ${req.url}' does not exist.` });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: 'A database or internal server error occurred. Please verify your database connection or try again later.',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`=========================================================`);
  console.log(`CourseHub Application Server is running!`);
  console.log(`Access the application at: http://localhost:${PORT}`);
  console.log(`=========================================================`);
});
