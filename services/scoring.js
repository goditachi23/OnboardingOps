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

// Read-only / informational commands that never need root. Prefixing any of
// these with sudo is a common bad habit that this project specifically
// wants to correct: running everyday commands as root is an unnecessary
// risk, since a compromised shell or shell history then has full admin
// rights instead of just read access.
const NEVER_NEEDS_SUDO = new Set([
  'ls', 'cat', 'pwd', 'whoami', 'id', 'ps', 'top', 'df', 'free', 'uptime',
  'find', 'grep', 'head', 'tail', 'wc', 'date', 'hostname', 'uname',
  'history', 'which', 'env', 'w', 'who', 'man', 'netstat', 'ss', 'ip',
  'ifconfig', 'ping', 'du', 'less', 'more', 'file'
]);

function checkUnnecessarySudo(command) {
  const m = command.trim().match(/^sudo\s+(\S+)/i);
  if (!m) return null;
  const base = m[1].toLowerCase();
  if (!NEVER_NEEDS_SUDO.has(base)) return null;
  return `sudo isn't needed for '${base}' -- it only reads information and changes nothing on the system. Running everyday commands as root is an unnecessary risk: if this shell or its command history were ever exposed, everything typed here would have run with full admin rights. Save sudo for commands that actually need to change something (restarting a service, editing a protected file, creating a user).`;
}

// Decides what a submitted command means for the *current* step of an SOP:
//   'dangerous'        -> matches the global destructive-command library
//   'correct'          -> matches this step's expected command
//   'unnecessary_sudo'  -> a read-only command run with sudo for no reason
//   'distractor'        -> matches a command the author flagged as a common
//                          wrong-but-plausible answer for this exact step
//   'unrecognized'      -> anything else (typos, exploration, unrelated)
function evaluateCommand({ command, step }) {
  const trimmed = command.trim();

  const dangerExplain = checkDangerous(trimmed);
  if (dangerExplain) return { type: 'dangerous', message: dangerExplain };

  if (step.expectedPattern && new RegExp(step.expectedPattern, 'i').test(trimmed)) {
    return { type: 'correct' };
  }

  const sudoExplain = checkUnnecessarySudo(trimmed);
  if (sudoExplain) return { type: 'unnecessary_sudo', message: sudoExplain };

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
  return sop.steps.reduce((sum, s) => sum + Number(s.points || 0), 0);
}

function grade(pct) {
  if (pct >= 85) return 'EXCELLENT';
  if (pct >= 70) return 'GOOD';
  if (pct >= 50) return 'FAIR';
  return 'POOR';
}

module.exports = { evaluateCommand, checkDangerous, maxScore, grade, SCORING };
