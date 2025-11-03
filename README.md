# Real-Time Chat Application (Socket.io) - Enhanced

This repository contains a student project implementing a real-time chat application using Socket.io, Node.js (Express), React (Vite), and MongoDB (Mongoose). Authentication uses JWT (JSON Web Tokens).

## Structure
- `server/` - Express + Socket.io server, MongoDB models, auth endpoints.
- `client/` - React + Vite front-end with JWT login/register and socket auth.
- `DEMO_VIDEO_SCRIPT.md` - Short script to make a demo video.
- `SAMPLE_COMMIT_HISTORY.md` - Suggested commit messages for GitHub Classroom.
- `package.json` - Root script to run both client and server concurrently.

## New features added
- JWT authentication (register/login endpoints) stored as token in client localStorage
- Socket.io authentication via token handshake
- MongoDB persistence for users and messages (mongoose)
- Read receipts persisted to DB
- Message pagination using DB skip/limit
- Root `npm run dev` to run client and server concurrently (requires `concurrently`)

## Setup (local)
1. Install Node.js v18+
2. Run a MongoDB instance locally or provide a connection string.

### Server
```bash
cd server
cp .env.example .env
# edit .env to set MONGO_URI and JWT_SECRET
npm install
npm run dev
```

### Client
```bash
cd client
npm install
npm run dev
```

### Or from repo root (runs both)
```bash
npm install
# installs dev deps like concurrently
npm run dev
```

Client expects `VITE_SERVER_URL` in `client/.env` (defaults to http://localhost:3000).

## Important notes
- This is still a demo/skeleton. For production: secure JWT storage, refresh tokens, SSL, rate limiting, validation, CSP, and use object storage for files.
- If you want me to create commits locally and prepare the repo for GitHub (but not push), I can produce a `.patch` of suggested commits or generate a sequence of `git` commands to run locally.

## Submission tips
- Add screenshots/GIFs into `/client/assets` and link them in README.
- Provide deployed URLs if you host - include them in README for grading.

## Application preview
![Chat App Screenshot] (./client/src/screenshot.png)

