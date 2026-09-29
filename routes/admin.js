const express = require('express');
const { v4: uuid } = require('uuid');
const { verifyToken, requireRole } = require('../middleware/auth');
const { load, save } = require('../db/database');

const router = express.Router();
router.use(verifyToken, requireRole('admin'));

// ---------- Users ----------
router.get('/users', (req, res) => {
  const db = load();
  res.json({ users: db.users.map(u => ({ id: u.id, username: u.username, role: u.role, tracks: u.tracks, createdAt: u.createdAt })) });
});

router.patch('/users/:id/tracks', (req, res) => {
  const { tracks } = req.body || {};
  const db = load();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.tracks = Array.isArray(tracks) ? tracks : [];
  save(db);
  res.json({ user: { id: user.id, username: user.username, role: user.role, tracks: user.tracks } });
});

router.patch('/users/:id/role', (req, res) => {
  const { role } = req.body || {};
  if (!['admin', 'trainee'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const db = load();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.id === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: "You can't remove your own admin access" });
  }
  user.role = role;
  save(db);
  res.json({ user: { id: user.id, username: user.username, role: user.role, tracks: user.tracks } });
});

router.delete('/users/:id', (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't delete your own account" });
  const db = load();
  db.users = db.users.filter(u => u.id !== req.params.id);
  db.attempts = db.attempts.filter(a => a.userId !== req.params.id);
  save(db);
  res.json({ ok: true });
});

// ---------- SOPs (full data, including the answer key) ----------
router.get('/sops', (req, res) => {
  const db = load();
  res.json({ sops: db.sops });
});

function sanitizeSteps(steps) {
  return steps.map(s => ({
    id: s.id || uuid(),
    instruction: String(s.instruction || '').trim(),
    expectedPattern: String(s.expectedPattern || '').trim(),
    hintCommand: String(s.hintCommand || '').trim(),
    points: Number.isFinite(Number(s.points)) ? Number(s.points) : 20,
    distractors: Array.isArray(s.distractors)
      ? s.distractors
          .filter(d => d && d.pattern)
          .map(d => ({ pattern: String(d.pattern).trim(), explanation: String(d.explanation || '').trim() }))
      : []
  }));
}

router.post('/sops', (req, res) => {
  const { title, track, tag, why, timeEstimate, steps } = req.body || {};
  if (!title || !track || !Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ error: 'Title, track and at least one step are required' });
  }
  for (const s of steps) {
    if (!s.instruction || !s.expectedPattern) {
      return res.status(400).json({ error: 'Every step needs an instruction and an expected command pattern' });
    }
    try { new RegExp(s.expectedPattern); } catch (e) {
      return res.status(400).json({ error: `Step "${s.instruction}" has an invalid regular expression` });
    }
  }
  const db = load();
  const sop = {
    id: uuid(), title, track, tag: tag || 'General', why: why || '', timeEstimate: timeEstimate || '5 min',
    createdBy: req.user.id, createdAt: new Date().toISOString(),
    steps: sanitizeSteps(steps)
  };
  db.sops.push(sop);
  save(db);
  res.status(201).json({ sop });
});

router.put('/sops/:id', (req, res) => {
  const db = load();
  const idx = db.sops.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'SOP not found' });
  const { title, track, tag, why, timeEstimate, steps } = req.body || {};
  if (steps) {
    for (const s of steps) {
      if (!s.instruction || !s.expectedPattern) {
        return res.status(400).json({ error: 'Every step needs an instruction and an expected command pattern' });
      }
      try { new RegExp(s.expectedPattern); } catch (e) {
        return res.status(400).json({ error: `Step "${s.instruction}" has an invalid regular expression` });
      }
    }
  }
  const existing = db.sops[idx];
  db.sops[idx] = {
    ...existing,
    title: title ?? existing.title,
    track: track ?? existing.track,
    tag: tag ?? existing.tag,
    why: why ?? existing.why,
    timeEstimate: timeEstimate ?? existing.timeEstimate,
    steps: Array.isArray(steps) ? sanitizeSteps(steps) : existing.steps
  };
  save(db);
  res.json({ sop: db.sops[idx] });
});

router.delete('/sops/:id', (req, res) => {
  const db = load();
  db.sops = db.sops.filter(s => s.id !== req.params.id);
  save(db);
  res.json({ ok: true });
});

// Distinct list of tracks currently in use, to drive the "assign role" UI.
router.get('/tracks', (req, res) => {
  const db = load();
  res.json({ tracks: [...new Set(db.sops.map(s => s.track))].sort() });
});

// ---------- Reports overview (all trainees at a glance) ----------
router.get('/reports', (req, res) => {
  const db = load();
  const rows = db.users.filter(u => u.role === 'trainee').map(u => {
    const attempts = db.attempts.filter(a => a.userId === u.id);
    const completed = attempts.filter(a => a.status === 'completed');
    return {
      userId: u.id, username: u.username, tracks: u.tracks,
      assignedSops: db.sops.filter(s => u.tracks.includes(s.track)).length,
      completedSops: completed.length,
      totalScore: completed.reduce((s, a) => s + a.score, 0),
      safetyViolations: attempts.reduce((s, a) => s + a.safetyViolations, 0)
    };
  });
  res.json({ users: rows });
});

module.exports = router;
