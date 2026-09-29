const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { load } = require('../db/database');
const { maxScore, grade } = require('../services/scoring');

const router = express.Router();
router.use(verifyToken);

function attemptReport(attempt, sop) {
  const max = maxScore(sop);
  const pct = max ? Math.round((attempt.score / max) * 100) : 0;
  const durationMs = attempt.completedAt ? (new Date(attempt.completedAt) - new Date(attempt.startedAt)) : null;
  return {
    attemptId: attempt.id, sopId: sop.id, sopTitle: sop.title, track: sop.track,
    status: attempt.status, score: attempt.score, maxScore: max, percentage: pct,
    grade: attempt.status === 'completed' ? grade(pct) : null,
    hintsUsed: attempt.hintsUsedTotal, errors: attempt.errorsCount,
    safetyViolations: attempt.safetyViolations,
    durationSeconds: durationMs ? Math.round(durationMs / 1000) : null,
    startedAt: attempt.startedAt, completedAt: attempt.completedAt
  };
}

function buildOverview(userId, res) {
  const db = load();
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const attempts = db.attempts.filter(a => a.userId === userId);
  const assigned = db.sops.filter(s => user.tracks.includes(s.track));
  const reports = attempts.map(a => attemptReport(a, db.sops.find(s => s.id === a.sopId))).filter(Boolean);
  const completed = reports.filter(r => r.status === 'completed');
  const allCompleted = assigned.length > 0 && assigned.every(s => completed.some(r => r.sopId === s.id));
  const totalScore = completed.reduce((s, r) => s + r.score, 0);
  const totalMax = completed.reduce((s, r) => s + r.maxScore, 0);
  const overallPct = totalMax ? Math.round((totalScore / totalMax) * 100) : 0;

  res.json({
    username: user.username, tracks: user.tracks,
    assignedCount: assigned.length, completedCount: completed.length, allCompleted,
    overallPercentage: overallPct, overallGrade: completed.length ? grade(overallPct) : null,
    totalHints: reports.reduce((s, r) => s + r.hintsUsed, 0),
    totalSafetyViolations: reports.reduce((s, r) => s + r.safetyViolations, 0),
    reports
  });
}

router.get('/attempt/:attemptId', (req, res) => {
  const db = load();
  const attempt = db.attempts.find(a => a.id === req.params.attemptId &&
    (a.userId === req.user.id || req.user.role === 'admin'));
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  res.json({ report: attemptReport(attempt, db.sops.find(s => s.id === attempt.sopId)) });
});

router.get('/overview', (req, res) => buildOverview(req.user.id, res));

router.get('/admin/user/:userId', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  buildOverview(req.params.userId, res);
});

module.exports = router;
