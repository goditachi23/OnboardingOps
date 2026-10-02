const express = require('express');
const { v4: uuid } = require('uuid');
const { verifyToken } = require('../middleware/auth');
const { load, save } = require('../db/database');
const { evaluateCommand, maxScore, SCORING } = require('../services/scoring');

const router = express.Router();
router.use(verifyToken);

// Shape returned to the browser for any attempt: score, step index, counters.
// This is the ONLY source the UI uses to show XP/progress -- it is rebuilt
// from db.json on every request, so refreshing the page cannot roll back or
// inflate it, and nothing the client sends is trusted for scoring itself.
function publicAttempt(attempt, sop) {
  return {
    id: attempt.id, sopId: attempt.sopId, status: attempt.status,
    currentStepIndex: attempt.currentStepIndex, totalSteps: sop.steps.length,
    score: attempt.score, maxScore: maxScore(sop),
    hintsUsedTotal: attempt.hintsUsedTotal, errorsCount: attempt.errorsCount,
    safetyViolations: attempt.safetyViolations,
    startedAt: attempt.startedAt, completedAt: attempt.completedAt
  };
}

router.post('/start', (req, res) => {
  const { sopId } = req.body || {};
  const db = load();
  const sop = db.sops.find(s => s.id === sopId);
  if (!sop) return res.status(404).json({ error: 'SOP not found' });
  if (req.user.role !== 'admin' && !req.user.tracks.includes(sop.track)) {
    return res.status(403).json({ error: 'This SOP is not assigned to your role' });
  }
  let attempt = db.attempts.find(a => a.userId === req.user.id && a.sopId === sopId && a.status === 'in_progress');
  if (!attempt) {
    attempt = {
      id: uuid(), userId: req.user.id, sopId, status: 'in_progress',
      currentStepIndex: 0, score: 0, hintsUsedTotal: 0, errorsCount: 0,
      safetyViolations: 0, stepHintsTaken: {}, log: [],
      startedAt: new Date().toISOString(), completedAt: null
    };
    db.attempts.push(attempt);
    save(db);
  }
  res.json({ attempt: publicAttempt(attempt, sop) });
});

router.get('/', (req, res) => {
  const db = load();
  const mine = db.attempts.filter(a => a.userId === req.user.id);
  res.json({ attempts: mine.map(a => publicAttempt(a, db.sops.find(s => s.id === a.sopId))) });
});

router.get('/:attemptId', (req, res) => {
  const db = load();
  const attempt = db.attempts.find(a => a.id === req.params.attemptId && a.userId === req.user.id);
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  res.json({ attempt: publicAttempt(attempt, db.sops.find(s => s.id === attempt.sopId)) });
});

// The one endpoint that actually moves score/progress. A command is judged
// fresh against the CURRENT step every time -- the client never tells the
// server "I got it right", it only ever reports what was typed.
router.post('/:attemptId/command', (req, res) => {
  const { command } = req.body || {};
  if (typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({ error: 'No command provided' });
  }
  const db = load();
  const attempt = db.attempts.find(a => a.id === req.params.attemptId && a.userId === req.user.id);
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  const sop = db.sops.find(s => s.id === attempt.sopId);

  if (attempt.status === 'completed') {
    return res.json({ result: { type: 'completed' }, attempt: publicAttempt(attempt, sop), completed: true });
  }

  const step = sop.steps[attempt.currentStepIndex];
  const evalResult = evaluateCommand({ command, step });
  let advanced = false;

  if (evalResult.type === 'dangerous') {
    attempt.safetyViolations += 1;
  } else if (evalResult.type === 'correct') {
    const stepPoints = Number(step.points || 0);
    const hintPenalty = attempt.stepHintsTaken[step.id]
      ? Math.min(SCORING.HINT_PENALTY, stepPoints / 2)
      : 0;
    attempt.score += stepPoints - hintPenalty;
    attempt.currentStepIndex += 1;
    advanced = true;
    if (attempt.currentStepIndex >= sop.steps.length) {
      attempt.status = 'completed';
      attempt.completedAt = new Date().toISOString();
    }
  } else if (evalResult.type === 'distractor') {
    // A plausible-but-wrong command for THIS step: a real teaching moment,
    // so it costs points and counts as an error in the report.
    attempt.score = Math.max(attempt.score - SCORING.DISTRACTOR_PENALTY, 0);
    attempt.errorsCount += 1;
  } else if (evalResult.type === 'unnecessary_sudo') {
    // Read-only command run with sudo for no reason: a habit worth
    // correcting, not a wrong SOP step, but still logged and lightly
    // penalized so it shows up in the report.
    attempt.score = Math.max(attempt.score - SCORING.PRIVILEGE_PENALTY, 0);
    attempt.errorsCount += 1;
  }
  // 'unrecognized' (typos, exploration like ls/pwd/cat elsewhere) is logged
  // but never penalized -- only commands the author specifically flagged as
  // a misconception are scored as errors.

  attempt.log.push({ command, type: evalResult.type, stepIndex: attempt.currentStepIndex, at: new Date().toISOString() });
  save(db);

  res.json({
    result: { type: evalResult.type, message: evalResult.message || null, advanced },
    attempt: publicAttempt(attempt, sop),
    completed: attempt.status === 'completed'
  });
});

router.post('/:attemptId/hint', (req, res) => {
  const db = load();
  const attempt = db.attempts.find(a => a.id === req.params.attemptId && a.userId === req.user.id);
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  const sop = db.sops.find(s => s.id === attempt.sopId);
  const step = sop.steps[attempt.currentStepIndex];
  if (!step) return res.status(400).json({ error: 'This SOP is already complete' });

  attempt.stepHintsTaken[step.id] = (attempt.stepHintsTaken[step.id] || 0) + 1;
  attempt.hintsUsedTotal += 1;
  attempt.log.push({ command: '(hint requested)', type: 'hint', stepIndex: attempt.currentStepIndex, at: new Date().toISOString() });
  save(db);

  res.json({ hintCommand: step.hintCommand, attempt: publicAttempt(attempt, sop) });
});

module.exports = router;
