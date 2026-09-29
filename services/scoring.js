const fs = require('fs');
const path = require('path');
const { SCORING } = require('../config/config');

const dangerousList = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/dangerous-commands.json'), 'utf-8')
).map(d => ({ regex: new RegExp(d.pattern, 'i'), explanation: d.explanation }));

// Checked before anything else, on every submitted command, regardless of
// which SOP or step is active -- these commands are never appropriate.
function checkDangerous(command) {
  for (const d of dangerousList) {
    if (d.regex.test(command)) return d.explanation;
  }
  return null;
}

// Decides what a submitted command means for the *current* step of an SOP:
//   'dangerous'    -> matches the global destructive-command library
//   'correct'      -> matches this step's expected command
//   'distractor'   -> matches a command the author flagged as a common
//                     wrong-but-plausible answer for this exact step, with
//                     an explanation of why it's wrong here
//   'unrecognized' -> anything else (typos, exploration, unrelated commands)
function evaluateCommand({ command, step }) {
  const trimmed = command.trim();

  const dangerExplain = checkDangerous(trimmed);
  if (dangerExplain) return { type: 'dangerous', message: dangerExplain };

  if (step.expectedPattern && new RegExp(step.expectedPattern, 'i').test(trimmed)) {
    return { type: 'correct' };
  }

  if (Array.isArray(step.distractors)) {
    for (const d of step.distractors) {
      if (d.pattern && new RegExp(d.pattern, 'i').test(trimmed)) {
        return { type: 'distractor', message: d.explanation };
      }
    }
  }

  return { type: 'unrecognized' };
}

function maxScore(sop) {
  return sop.steps.reduce((sum, s) => sum + s.points, 0) + SCORING.COMPLETION_BONUS;
}

function grade(pct) {
  if (pct >= 85) return 'EXCELLENT';
  if (pct >= 70) return 'GOOD';
  if (pct >= 50) return 'FAIR';
  return 'POOR';
}

module.exports = { evaluateCommand, checkDangerous, maxScore, grade, SCORING };
