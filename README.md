Green Hydrogen Subsidy Portal
A blockchain-powered platform designed to ensure a transparent, secure, and automated distribution of government subsidies for the green hydrogen sector. This project demonstrates a full-stack solution with distinct role-based access for government officials, producers, and auditors.

✨ Key Features
Role-Based Access Control: Separate, secure dashboards for Government, Producer (vendor), and Auditor roles.

Blockchain Integration: Utilizes a Solidity smart contract to manage vendor registration and subsidy parameters on an immutable ledger, ensuring transparency and trust.

Real-Time Progress Tracking: Government officials and producers can monitor project progress toward subsidy milestones in real-time.

Complete Audit Trail: An unchangeable, chronological log of all significant actions (like vendor registration and payments) is available to auditors.

Dynamic User Interface: A modern, responsive UI with light/dark modes and aesthetic background animations for an enhanced user experience.

Simulation Ready: Includes a "Reset" feature for judges to easily clear all data and re-run demonstrations.

🛠️ Technology Stack
Frontend: HTML5, Tailwind CSS, JavaScript (ES6+)

Backend: Node.js, Express.js, Cors.js, etc

API: Express-Validator.js, Express-Rate-Verifier.js, etc

Database: MySQL[Railway host]

Blockchain: Solidity, Ethers.js

🚀 Getting Started
Steps used in creation:

Prerequisites
Node.js and npm:

MySQL: A running MySQL server instance. Used a cloud service.

Ganache: For running a local Ethereum blockchain.

Install backend dependencies:

npm install

Set up the Database:

Ensure your MySQL server is running.

Create a new database (e.g., hydrogen_subsidy).

The server will automatically create the necessary tables on its first run.

Configure Environment Variables:

Create a file named .env in the root of the project.

This file contains all the sensitive information like the passwords and keys used in a programme.
