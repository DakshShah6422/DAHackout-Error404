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

Backend: Node.js, Express.js

Database: MySQL

Blockchain: Solidity, Ethers.js

🚀 Getting Started
Follow these instructions to get the project up and running on your local machine for demonstration and testing purposes.

Prerequisites
Node.js and npm: Download Here

MySQL: A running MySQL server instance. You can use a local installation or a cloud service.

(Optional) Ganache: For running a local Ethereum blockchain. Download Here

Installation & Setup
Clone the repository:

git clone <your-repository-url>
cd <repository-folder>

Install backend dependencies:

npm install

Set up the Database:

Ensure your MySQL server is running.

Create a new database (e.g., hydrogen_subsidy).

The server will automatically create the necessary tables on its first run.

Configure Environment Variables:

Create a file named .env in the root of the project.

Copy the contents below into it and fill in your specific details.

.env Template:

# --- Database Configuration ---
# Example: mysql://user:password@host:port/database_name
DATABASE_URL="mysql://root:your_password@localhost:3306/hydrogen_subsidy"

# --- Blockchain Configuration (Optional) ---
# RPC URL from Ganache or your preferred testnet (e.g., Sepolia)
RPC_URL="[http://127.0.0.1:7545](http://127.0.0.1:7545)"

# The private key of the account you used to deploy the contract (from Ganache)
PRIVATE_KEY="your_ganache_account_private_key"

# The address of the deployed SubsidyAutomator.sol smart contract
CONTRACT_ADDRESS="your_deployed_contract_address"

Run the Server:

npm start
