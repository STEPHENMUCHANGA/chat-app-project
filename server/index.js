require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


const app = express();
app.use(cors());
app.use(express.json({limit: '10mb'}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB models
const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/realtime-chat';
mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> console.log('Connected to MongoDB'))
  .catch(err => console.warn('MongoDB connection problem', err));

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  passwordHash: String,
  createdAt: { type: Date, default: Date.now }
});
const MessageSchema = new mongoose.Schema({
  from: String,
  to: String,
  room: String,
  text: String,
  type: String,
  metadata: Object,
  ts: { type: Date, default: Date.now },
  reactions: Object,
  readBy: [String]
});
const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000
});

// Simple file upload endpoint (multer)
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

// AUTH endpoints
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({ error: 'username and password required' });
  const exists = await User.findOne({ username });
  if(exists) return res.status(409).json({ error: 'username taken' });
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);
  const u = new User({ username, passwordHash: hash });
  await u.save();
  const token = jwt.sign({ id: u._id, username: u.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: u.username });
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({ error: 'username and password required' });
  const u = await User.findOne({ username });
  if(!u) return res.status(401).json({ error: 'invalid credentials' });
  const ok = bcrypt.compareSync(password, u.passwordHash);
  if(!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ id: u._id, username: u.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: u.username });
});

// In-memory socket stores (still use DB for messages)
const users = {}; // socketId -> { username, userId, online }
const userSockets = {}; // username -> socketId

// Socket auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if(!token) return next(); // allow anonymous but won't have user identity
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = { id: payload.id, username: payload.username };
    return next();
  } catch(err) {
    console.warn('Socket auth failed', err.message);
    return next(new Error('Authentication error'));
  }
});

io.on('connection', socket => {
  console.log('Socket connected', socket.id, 'user=', socket.user && socket.user.username);

  // user joins with username (fallback to token username)
  socket.on('user:join', async ({ username }, cb) => {
    const uname = socket.user?.username || username;
    users[socket.id] = { username: uname, online: true };
    userSockets[uname] = socket.id;
    socket.join('global'); // default room
    // load recent messages from DB for global
    const recent = await Message.find({ room: 'global' }).sort({ ts: 1 }).limit(200).lean();
    // broadcast join
    socket.to('global').emit('notification', { type: 'join', username: uname });
    io.emit('presence:update', Object.values(users).map(u => u.username));
    cb && cb({ ok: true, room: 'global', recent });
  });

  socket.on('message:send', async (payload, ack) => {
    const room = payload.room || 'global';
    const msgDoc = new Message({
      from: payload.from,
      to: payload.to || null,
      room,
      text: payload.text || null,
      type: payload.type || 'text',
      metadata: payload.metadata || {},
      reactions: {},
      readBy: []
    });
    await msgDoc.save();
    const msg = msgDoc.toObject();
    io.to(room).emit('message:new', msg);
    if(msg.to && userSockets[msg.to]) {
      io.to(userSockets[msg.to]).emit('message:new', msg);
    }
    ack && ack({ delivered: true, id: msg._id });
  });

  socket.on('message:ack', async ({ messageId, username }) => {
    const m = await Message.findById(messageId);
    if(m && !m.readBy.includes(username)) {
      m.readBy.push(username);
      await m.save();
      io.to(m.room).emit('message:read', { messageId, username });
    }
  });

  socket.on('typing', ({ room, username }) => {
    socket.to(room).emit('typing', { username });
  });

  socket.on('reaction', async ({ messageId, emoji, username }) => {
    const m = await Message.findById(messageId);
    if(!m) return;
    m.reactions = m.reactions || {};
    m.reactions[emoji] = m.reactions[emoji] || [];
    if(!m.reactions[emoji].includes(username)) m.reactions[emoji].push(username);
    await m.save();
    io.to(m.room).emit('reaction:update', { messageId, emoji, users: m.reactions[emoji] });
  });

  socket.on('join:room', async ({ room }, cb) => {
    socket.join(room);
    io.to(room).emit('notification', { type: 'join-room', room, username: users[socket.id]?.username });
    cb && cb({ ok: true, room });
  });

  socket.on('leave:room', ({ room }, cb) => {
    socket.leave(room);
    io.to(room).emit('notification', { type: 'leave-room', room, username: users[socket.id]?.username });
    cb && cb({ ok: true });
  });

  socket.on('message:history', async ({ room, page=0, pageSize=20 }, cb) => {
    const skip = Math.max(0, (page) * pageSize);
    const list = await Message.find({ room }).sort({ ts: 1 }).skip(skip).limit(pageSize).lean();
    cb && cb({ messages: list, page, pageSize });
  });

  socket.on('disconnect', (reason) => {
    const u = users[socket.id];
    if(u) {
      delete userSockets[u.username];
      delete users[socket.id];
      io.emit('presence:update', Object.values(users).map(x => x.username));
      io.to('global').emit('notification', { type: 'leave', username: u.username });
    }
    console.log('Socket disconnected', socket.id, reason);
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server listening on', PORT));
