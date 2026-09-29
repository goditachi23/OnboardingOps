const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/config');

// Verifies the signed token and attaches its (server-issued) claims to
// req.user. Because the token is signed with JWT_SECRET, nothing the client
// stores in localStorage (username, role, tracks) can change what req.user
// actually contains -- editing localStorage cannot forge admin access.
function verifyToken(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired session, please log in again' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: `Forbidden: ${role} access required` });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
