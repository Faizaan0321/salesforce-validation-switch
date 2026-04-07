Salesforce Validation Rule Manager

Overview
This project allows users to manage Salesforce Validation Rules directly from a web interface.

Features
- OAuth 2.0 Login with Salesforce
- Fetch Validation Rules using Tooling API
- Enable / Disable rules dynamically
- Deploy changes back to Salesforce
- Supports Production and Sandbox environments

Tech Stack
- React.js (Frontend)
- Node.js + Express (Proxy Server)
- Salesforce Tooling API

How It Works
1. User logs in via Salesforce OAuth
2. Access token is captured in frontend
3. Requests are sent via proxy server to avoid CORS
4. Validation rules are fetched and displayed
5. User can toggle rules and deploy changes

Setup Instructions
1. Install dependencies:
   npm install

2. Start proxy server:
   node src/proxy.js

3. Start frontend:
   npm start

Author
Faizaan Khan
