const user = requireAuth();
if (user) {
  document.getElementById('whoami').textContent = ' — ' + user.username + (user.tracks.length ? ' (' + user.tracks.join(', ') + ')' : '');
  document.getElementById('logoutBtn').onclick = logout;
}

let sops = [], sop = null, attempt = null;
const sandbox = makeSandbox();
const out = document.getElementById('out');
const inp = document.getElementById('inp');

function pr(text, cls) {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  d.textContent = text;
  out.appendChild(d);
  out.scrollTop = out.scrollHeight;
}
function ps() {
  document.getElementById('ps').textContent = 'trainee@web-01:' + sandbox.cwd().replace('/home/trainee', '~') + '$';
}

async function loadSops() {
  const data = await api('/sops');
  sops = data.sops;
  renderList();
}

function renderList() {
  const el = document.getElementById('list');
  if (sops.length === 0) {
    el.innerHTML = '<div class="empty">No SOPs are assigned to your role yet. Ask an admin to assign you a track.</div>';
    return;
  }
  el.innerHTML = sops.map(s => `
    <button class="sop${sop && sop.id === s.id ? ' on' : ''}" data-id="${s.id}">
      <b>${s.title}</b><small>${s.tag} · ${s.timeEstimate}</small>
    </button>`).join('');
}

async function pick(id) {
  sop = sops.find(s => s.id === id);
  const startData = await api('/progress/start', { method: 'POST', body: JSON.stringify({ sopId: id }) });
  attempt = startData.attempt;
  sandbox.reset();
  out.innerHTML = '';
  pr('Test environment ready. Follow the steps on the left. Type help for a command list.', 'sys');
  ps();
  renderList();
  renderSteps();
}

function renderSteps() {
  const el = document.getElementById('steps');
  if (!sop) {
    el.innerHTML = '<div class="empty"><b>Pick an SOP to start.</b><br>Read the steps here, then practise them in the test terminal.</div>';
    updateXp();
    return;
  }
  const fin = attempt.status === 'completed';
  el.innerHTML = `<h3>${sop.title}</h3><p class="why">${sop.why}</p><ol>` +
    sop.steps.map((s, i) => `
      <li class="${i < attempt.currentStepIndex ? 'done' : i === attempt.currentStepIndex ? 'now' : ''}">
        <span class="n">${i < attempt.currentStepIndex ? '\u2713' : i + 1}</span>
        <div>${s.instruction}</div>
      </li>`).join('') +
    '</ol>' +
    (fin
      ? `<div class="done-box">\ud83c\udfc5 SOP complete — score ${attempt.score}/${attempt.maxScore}.</div><a class="btn" href="report.html">View my report</a>`
      : '<button class="btn g" id="hintBtn" type="button">\ud83d\udca1 Show the command (server-scored penalty)</button>');
  updateXp();
  if (!fin) document.getElementById('hintBtn').onclick = takeHint;
}

function updateXp() {
  document.getElementById('xp').textContent = attempt ? `${attempt.score} pts` : '0 pts';
  document.getElementById('pc').textContent = attempt ? `Step ${Math.min(attempt.currentStepIndex + 1, attempt.totalSteps)}/${attempt.totalSteps}` : '';
  document.getElementById('bar').style.width = attempt ? (Math.min(attempt.currentStepIndex, attempt.totalSteps) / attempt.totalSteps * 100) + '%' : '0%';
}

async function takeHint() {
  const data = await api(`/progress/${attempt.id}/hint`, { method: 'POST' });
  attempt = data.attempt;
  pr('\ud83d\udca1 Hint: ' + data.hintCommand, 'sys');
  renderSteps();
}

async function submitCommand(line) {
  const data = await api(`/progress/${attempt.id}/command`, { method: 'POST', body: JSON.stringify({ command: line }) });
  attempt = data.attempt;
  const r = data.result;
  if (r.type === 'dangerous') pr('\ud83d\udee1 BLOCKED — ' + r.message, 'danger');
  else if (r.type === 'unnecessary_sudo') pr('\ud83d\udd11 ' + r.message, 'privilege');
  else if (r.type === 'distractor') pr('\ud83d\udcd8 Not for this step — ' + r.message, 'teach');
  else if (r.type === 'correct') pr('\u2714 Step done', 'ok');
  renderSteps();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (b) pick(b.dataset.id);
});

document.getElementById('resetBtn').onclick = () => {
  sandbox.reset();
  out.innerHTML = '';
  ps();
  pr('Sandbox reset.', 'sys');
};

inp.onkeydown = async (e) => {
  if (e.key !== 'Enter') return;
  const line = inp.value;
  inp.value = '';
  if (!line.trim()) return;
  pr(document.getElementById('ps').textContent + ' ' + line, 'cmd');
  if (line.trim() === 'clear') {
    out.innerHTML = '';
  } else {
    const localOutput = sandbox.run(line);
    if (localOutput) pr(localOutput);
    if (sop && attempt && attempt.status !== 'completed' && line.trim() !== 'help') {
      try { await submitCommand(line); } catch (ex) { pr('(scoring server unreachable: ' + ex.message + ')', 'sys'); }
    }
  }
  ps();
};

ps();
loadSops();
renderSteps();
