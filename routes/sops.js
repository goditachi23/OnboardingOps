const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { load } = require('../db/database');

const router = express.Router();
router.use(verifyToken);

// Trainee-facing view: instructions only, never the answer key (expectedPattern,
// hintCommand and distractors stay server-side and are only used inside
// /api/progress, so reading the network tab can't hand a trainee the answers).
function publicSop(sop) {
  return {
    id: sop.id, title: sop.title, track: sop.track, tag: sop.tag,
    why: sop.why, timeEstimate: sop.timeEstimate,
    steps: sop.steps.map((s, i) => ({ id: s.id, order: i, instruction: s.instruction, points: s.points }))
  };
}

router.get('/', (req, res) => {
  const db = load();
  const visible = req.user.role === 'admin'
    ? db.sops
    : db.sops.filter(s => req.user.tracks.includes(s.track));
  res.json({ sops: visible.map(publicSop) });
});

router.get('/:id', (req, res) => {
  const db = load();
  const sop = db.sops.find(s => s.id === req.params.id);
  if (!sop) return res.status(404).json({ error: 'SOP not found' });
  if (req.user.role !== 'admin' && !req.user.tracks.includes(sop.track)) {
    return res.status(403).json({ error: 'This SOP is not assigned to your role' });
  }
  res.json({ sop: publicSop(sop) });
});

module.exports = router;
