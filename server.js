const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt'); // <-- ADD THIS for password hashing
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

const dbUrl = new URL(process.env.DATABASE_URL);
const dbConfig = {
    host: dbUrl.hostname,
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.substring(1),
    port: dbUrl.port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool;

async function setupDatabase() {
    try {
        pool = mysql.createPool(dbConfig);
        await pool.query('SELECT 1');
        console.log("Connected to Railway MySQL!");

        // NEW: users table for authentication
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('government', 'producer', 'auditor') NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS vendors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                wallet_address VARCHAR(42) NOT NULL UNIQUE,
                milestone_goal INT NOT NULL,
                reward_amount DECIMAL(10, 2) NOT NULL,
                is_paid BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS progress_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                vendor_id INT NOT NULL,
                progress INT NOT NULL,
                timestamp DATETIME NOT NULL,
                FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
            );
        `);

        console.log("Tables 'users', 'vendors', and 'progress_logs' are ready.");
    } catch (error) {
        console.error("Could not set up the database:", error.message);
        process.exit(1);
    }
}

// --- NEW AUTHENTICATION ROUTES ---

app.post('/signup', async (req, res) => {
    const { name, email, role, password } = req.body;
    if (!name || !email || !role || !password) {
        return res.status(400).json({ message: "All fields are required for signup." });
    }

    try {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const sql = "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)";
        await pool.query(sql, [name, email, passwordHash, role]);

        res.status(201).json({ message: "User created successfully!" });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: "An account with this email already exists." });
        }
        console.error("Error creating user:", err);
        res.status(500).json({ message: "Failed to create user." });
    }
});

// NOTE: You'll need to update your frontend login logic to call this endpoint
app.post('/login', async (req, res) => {
    const { email, password, role } = req.body; // Role is sent from frontend
    if (!email || !password || !role) {
        return res.status(400).json({ message: "Email, password, and role are required." });
    }

    try {
        const sql = "SELECT * FROM users WHERE email = ?";
        const [rows] = await pool.query(sql, [email]);

        if (rows.length === 0) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        const user = rows[0];

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ message: "Invalid email or password." });
        }
        
        // Verify role matches the one selected on the login screen
        if (user.role !== role) {
            return res.status(403).json({ message: `Access denied. Please log in through the '${user.role}' portal.` });
        }

        // Login successful, send back user info (without password)
        res.status(200).json({
            message: "Login successful!",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "An internal server error occurred." });
    }
});


// --- EXISTING VENDOR ROUTES ---

app.get('/vendors', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM vendors ORDER BY name");
        res.status(200).json(rows);
    } catch (err) {
        console.error("Error fetching vendors:", err);
        res.status(500).send({ message: "Failed to fetch vendors." });
    }
});

app.post('/add-vendor', async (req, res) => {
    const { name, walletAddress, milestoneGoal, rewardAmount } = req.body;
    if (!name || !walletAddress || !milestoneGoal || !rewardAmount) {
        return res.status(400).send({ message: "All vendor fields are required." });
    }
    try {
        const sql = "INSERT INTO vendors (name, wallet_address, milestone_goal, reward_amount) VALUES (?, ?, ?, ?)";
        const [result] = await pool.query(sql, [name, walletAddress, milestoneGoal, rewardAmount]);
        res.status(201).json({ message: "Vendor added successfully!", vendorId: result.insertId });
    } catch (err) {
        console.error("Error adding vendor:", err);
        res.status(500).send({ message: "Failed to add vendor." });
    }
});

app.get('/vendors/:vendorId/progress', async (req, res) => {
    const { vendorId } = req.params;
    try {
        const sql = "SELECT SUM(progress) as totalProgress FROM progress_logs WHERE vendor_id = ?";
        const [rows] = await pool.query(sql, [vendorId]);
        const totalProgress = rows[0].totalProgress || 0;
        res.status(200).json({ totalProgress });
    } catch (err) {
        console.error(`Error fetching progress for vendor ${vendorId}:`, err);
        res.status(500).send({ message: "Failed to fetch progress." });
    }
});

app.post('/vendors/:vendorId/progress', async (req, res) => {
    const { vendorId } = req.params;
    const { newProgress } = req.body;

    if (!newProgress || isNaN(newProgress) || newProgress <= 0) {
        return res.status(400).send({ message: "Invalid progress value." });
    }

    try {
        const sql = "INSERT INTO progress_logs (vendor_id, progress, timestamp) VALUES (?, ?, ?)";
        const timestamp = new Date();
        await pool.query(sql, [vendorId, newProgress, timestamp]);
        res.status(200).json({ message: "Progress updated successfully!" });
    } catch (err) {
        console.error(`Error updating progress for vendor ${vendorId}:`, err);
        res.status(500).send({ message: "Failed to update progress." });
    }
});

app.post('/vendors/:vendorId/payout', async (req, res) => {
    const { vendorId } = req.params;
    try {
        const sql = "UPDATE vendors SET is_paid = TRUE WHERE id = ?";
        await pool.query(sql, [vendorId]);
        res.status(200).json({ message: "Payout processed successfully!" });
    } catch (err) {
        console.error(`Error processing payout for vendor ${vendorId}:`, err);
        res.status(500).send({ message: "Failed to process payout." });
    }
});

app.post('/reset', async (req, res) => {
    try {
        await pool.query("SET FOREIGN_KEY_CHECKS = 0");
        await pool.query("TRUNCATE TABLE progress_logs");
        await pool.query("TRUNCATE TABLE vendors");
        await pool.query("TRUNCATE TABLE users"); // Also clear users on reset
        await pool.query("SET FOREIGN_KEY_CHECKS = 1");
        console.log("Simulation reset. All tables cleared.");
        res.status(200).send({ message: "Simulation reset successfully." });
    } catch (err) {
        console.error("Error resetting simulation:", err);
        res.status(500).send({ message: "Failed to reset." });
    }
});

setupDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is live and listening on http://localhost:${PORT}`);
    });
});