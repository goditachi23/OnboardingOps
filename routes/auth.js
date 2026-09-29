const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const { load, save } = require('../db/database');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/config');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// The JWT is the ONLY place role/tracks live once issued -- it is signed
// with JWT_SECRET, so the browser can read it but cannot forge or edit it.
function sign(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, tracks: user.tracks },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function publicUser(u) {
  return { id: u.id, username: u.username, role: u.role, tracks: u.tracks };
}

router.post('/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || password.length < 6) {
    return res.status(400).json({ error: 'Username and a password of at least 6 characters are required' });
  }
  const db = load();
  if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: 'That username is already taken' });
  }
  // Self-registration always starts as an unassigned trainee -- an admin
  // must assign a track before any SOP becomes visible to this account.
  const user = {
    id: uuid(), username, passwordHash: bcrypt.hashSync(password, 10),
    role: 'trainee', tracks: [], createdAt: new Date().toISOString()
  };
  db.users.push(user);
  save(db);
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const db = load();
  const user = db.users.find(u => u.username.toLowerCase() === (username || '').toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  res.json({ token: sign(user), user: publicUser(user) });
});

router.get('/me', verifyToken, (req, res) => {
  const db = load();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
