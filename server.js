const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');
const ethers = require('ethers');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

let dbConfig;
try {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL environment variable is not set.");
    }
    const dbUrl = new URL(process.env.DATABASE_URL);
    dbConfig = {
        host: dbUrl.hostname,
        user: dbUrl.username,
        password: dbUrl.password,
        database: dbUrl.pathname.substring(1),
        port: dbUrl.port,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };
} catch (error) {
    console.error("Error configuring database:", error.message);
    process.exit(1);
}

let pool;
let contract;

const contractABI = [
	{"inputs": [], "stateMutability": "nonpayable", "type": "constructor"},
	{"inputs": [{"internalType": "address", "name": "_producerAddress", "type": "address"}, {"internalType": "uint256", "name": "_milestoneGoal", "type": "uint256"}, {"internalType": "uint256", "name": "_rewardAmount", "type": "uint256"}], "name": "addVendor", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
	{"inputs": [], "name": "depositSubsidy", "outputs": [], "stateMutability": "payable", "type": "function"},
	{"inputs": [], "name": "government", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "stateMutability": "view", "type": "function"},
	{"inputs": [{"internalType": "address", "name": "_vendorAddress", "type": "address"}, {"internalType": "uint256", "name": "_newProgress", "type": "uint256"}], "name": "updateProgress", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
	{"inputs": [{"internalType": "address", "name": "", "type": "address"}], "name": "vendors", "outputs": [{"internalType": "address", "name": "producerAddress", "type": "address"}, {"internalType": "uint256", "name": "milestoneGoal", "type": "uint256"}, {"internalType": "uint256", "name": "currentProgress", "type": "uint256"}, {"internalType": "uint256", "name": "rewardAmount", "type": "uint256"}, {"internalType": "bool", "name": "isPaid", "type": "bool"}, {"internalType": "bool", "name": "isActive", "type": "bool"}], "stateMutability": "view", "type": "function"},
	{"inputs": [], "name": "withdrawSubsidy", "outputs": [], "stateMutability": "nonpayable", "type": "function"}
];

async function setup() {
    try {
        pool = mysql.createPool(dbConfig);
        await pool.query('SELECT 1');
        console.log("Connected to MySQL Database!");

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

        console.log("Database tables are ready.");

        if (process.env.RPC_URL && process.env.PRIVATE_KEY && process.env.CONTRACT_ADDRESS) {
            const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
            const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, wallet);
            console.log("Connected to smart contract at address:", await contract.getAddress());
        } else {
            console.warn("Blockchain environment variables not set. Running in offline mode.");
        }

    } catch (error) {
        console.error("Could not set up the application:", error.message);
        process.exit(1);
    }
}

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

app.post('/login', async (req, res) => {
    const { email, password, role } = req.body;
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
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ message: "Invalid email or password." });
        }
        if (user.role !== role) {
            return res.status(403).json({ message: `Access denied. Please log in through the '${user.role}' portal.` });
        }
        res.status(200).json({
            message: "Login successful!",
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "An internal server error occurred." });
    }
});

app.post('/change-password', async (req, res) => {
    const { email, currentPassword, newPassword } = req.body;
    if (!email || !currentPassword || !newPassword) {
        return res.status(400).json({ message: "All fields are required." });
    }

    try {
        const findUserSql = "SELECT * FROM users WHERE email = ?";
        const [rows] = await pool.query(findUserSql, [email]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }
        const user = rows[0];
        const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ message: "Incorrect current password." });
        }
        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
        const updateSql = "UPDATE users SET password_hash = ? WHERE email = ?";
        await pool.query(updateSql, [newPasswordHash, email]);
        res.status(200).json({ message: "Password updated successfully!" });
    } catch (err) {
        console.error("Error changing password:", err);
        res.status(500).json({ message: "An internal server error occurred." });
    }
});

app.get('/vendors', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM vendors ORDER BY created_at DESC");
        res.status(200).json(rows);
    } catch (err) {
        console.error("Error fetching vendors:", err);
        res.status(500).json({ message: "Failed to fetch vendors." });
    }
});

app.post('/add-vendor', async (req, res) => {
    const { name, vendorEmail, walletAddress, milestoneGoal, rewardAmount } = req.body;
    if (!name || !vendorEmail || !walletAddress || !milestoneGoal || !rewardAmount) {
        return res.status(400).json({ message: "All vendor fields are required." });
    }
    
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const vendorSql = "INSERT INTO vendors (name, wallet_address, milestone_goal, reward_amount) VALUES (?, ?, ?, ?)";
        const [vendorResult] = await connection.query(vendorSql, [name, walletAddress, milestoneGoal, rewardAmount]);
        
        const defaultPassword = '123';
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);
        const userSql = "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)";
        await connection.query(userSql, [name, vendorEmail, passwordHash, 'producer']);

        if (contract) {
            const rewardInWei = ethers.parseEther(rewardAmount.toString());
            const tx = await contract.addVendor(walletAddress, milestoneGoal, rewardInWei);
            await tx.wait();
        }

        await connection.commit();
        res.status(201).json({ message: "Vendor and user account created successfully!", vendorId: vendorResult.insertId });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Error adding vendor:", err);
        if (err.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ message: "A user with this email or a vendor with this wallet already exists." });
        }
        res.status(500).json({ message: "Failed to add vendor due to a server or blockchain error." });
    } finally {
        if (connection) connection.release();
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
        res.status(500).json({ message: "Failed to fetch progress." });
    }
});

app.post('/reset', async (req, res) => {
    try {
        await pool.query("SET FOREIGN_KEY_CHECKS = 0");
        await pool.query("TRUNCATE TABLE progress_logs");
        await pool.query("TRUNCATE TABLE vendors");
        await pool.query("TRUNCATE TABLE users");
        await pool.query("SET FOREIGN_KEY_CHECKS = 1");
        console.log("Simulation reset. All tables cleared.");
        res.status(200).json({ message: "Simulation reset successfully." });
    } catch (err) {
        console.error("Error resetting simulation:", err);
        res.status(500).json({ message: "Failed to reset." });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

setup().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is live and listening on http://localhost:${PORT}`);
    });
});

