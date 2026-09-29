const adminUser = requireAuth('admin');
if (adminUser) {
  document.getElementById('whoami').textContent = adminUser.username;
  document.getElementById('logoutBtn').onclick = logout;
}

document.querySelectorAll('.tabs .tab').forEach(t => {
  t.onclick = () => {
    document.querySelectorAll('.tabs .tab').forEach(x => x.classList.remove('on'));
    t.classList.add('on');
    document.querySelectorAll('.tabpanel').forEach(p => p.hidden = true);
    document.getElementById('tab-' + t.dataset.tab).hidden = false;
    if (t.dataset.tab === 'users') loadUsers();
    if (t.dataset.tab === 'reports') loadReports();
  };
});

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function trackSummary(tracks) {
  if (!tracks.length) return 'No domains assigned \u25be';
  return tracks.join(', ') + ' \u25be';
}

/* ================= SOPs ================= */
let sops = [], editingId = null, draft = null, knownTracks = [];

async function loadSops() {
  const [{ sops: sopData }, { tracks }] = await Promise.all([api('/admin/sops'), api('/admin/tracks')]);
  sops = sopData;
  knownTracks = tracks;
  renderSopList();
}

function renderSopList() {
  document.getElementById('sopList').innerHTML = sops.map(s => `
    <button class="sop${editingId === s.id ? ' on' : ''}" data-edit="${s.id}">
      <b>${esc(s.title)}</b><small>${esc(s.track)} · ${s.steps.length} steps</small>
    </button>`).join('') || '<div class="empty">No SOPs yet.</div>';
}

function emptyStep() { return { instruction: '', expectedPattern: '', hintCommand: '', points: 20, distractors: [] }; }
function emptySop() { return { title: '', track: '', tag: 'General', why: '', timeEstimate: '5 min', steps: [emptyStep()] }; }

function openEditor(sop) {
  draft = sop ? JSON.parse(JSON.stringify(sop)) : emptySop();
  editingId = sop ? sop.id : null;
  renderSopList();
  renderEditor();
}

function stepRow(s, i) {
  return `<div class="stepcard" data-i="${i}">
    <div class="stepcard-head"><b>Step ${i + 1}</b><button class="link danger" data-rm-step="${i}" type="button">Remove</button></div>
    <label>Instruction shown to the trainee<input data-f="instruction" data-i="${i}" value="${esc(s.instruction)}"></label>
    <div class="row2">
      <label>Expected command (regex, matched case-insensitively)<input data-f="expectedPattern" data-i="${i}" value="${esc(s.expectedPattern)}" placeholder="^sudo systemctl restart nginx$"></label>
      <label>Points<input data-f="points" data-i="${i}" type="number" value="${s.points}"></label>
    </div>
    <label>Hint command (shown when the trainee asks for help — costs points)<input data-f="hintCommand" data-i="${i}" value="${esc(s.hintCommand)}"></label>
    <div class="distractors">
      <b>Teach on these wrong-but-plausible commands</b>
      ${(s.distractors || []).map((d, di) => `
        <div class="drow">
          <input data-df="pattern" data-i="${i}" data-di="${di}" value="${esc(d.pattern)}" placeholder="regex, e.g. ^sudo reboot">
          <input data-df="explanation" data-i="${i}" data-di="${di}" value="${esc(d.explanation)}" placeholder="why it's wrong for this step">
          <button class="link danger" data-rm-distractor="${i}:${di}" type="button">\u2715</button>
        </div>`).join('')}
      <button class="link" data-add-distractor="${i}" type="button">+ Add distractor</button>
    </div>
  </div>`;
}

function renderEditor() {
  const el = document.getElementById('sopEditor');
  // A track picked from existing options can never typo into a near-duplicate
  // (the bug that made a new SOP invisible to trainees). "+ Add new domain"
  // is the one place a brand-new track name gets typed, so every future
  // domain (networking, database, cloud...) still just types itself in here.
  const isCustomTrack = !!draft.track && !knownTracks.includes(draft.track);
  el.innerHTML = `
    <h2 style="margin-bottom:14px">${editingId ? 'Edit SOP' : 'New SOP'}</h2>
    <label>Title<input id="f_title" value="${esc(draft.title)}"></label>
    <div class="row2">
      <label>Track / domain
        <select id="f_track_select">
          <option value="" ${!draft.track ? 'selected' : ''} disabled>Select a domain…</option>
          ${knownTracks.map(t => `<option value="${esc(t)}" ${draft.track === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
          <option value="__new__" ${isCustomTrack ? 'selected' : ''}>+ Add new domain…</option>
        </select>
      </label>
      <label>Tag<input id="f_tag" value="${esc(draft.tag)}" placeholder="Incident, Access, Basics..."></label>
    </div>
    <label id="f_track_new_wrap" ${isCustomTrack ? '' : 'hidden'}>New domain name (e.g. networking, database, cloud)
      <input id="f_track_new" value="${isCustomTrack ? esc(draft.track) : ''}" placeholder="networking">
    </label>
    <div class="row2">
      <label>Why it matters<input id="f_why" value="${esc(draft.why)}"></label>
      <label>Time estimate<input id="f_time" value="${esc(draft.timeEstimate)}"></label>
    </div>
    <h3 style="font-size:14px;color:var(--mut);margin-top:14px">Steps</h3>
    <div id="stepsBox">${draft.steps.map((s, i) => stepRow(s, i)).join('')}</div>
    <button class="btn g small" id="addStepBtn" type="button">+ Add step</button>
    <div class="editor-actions">
      <button class="btn" id="saveSopBtn" type="button">${editingId ? 'Save changes' : 'Create SOP'}</button>
      ${editingId ? '<button class="btn danger" id="delSopBtn" type="button">Delete SOP</button>' : ''}
    </div>`;

  document.getElementById('f_title').oninput = e => draft.title = e.target.value;
  const trackSelect = document.getElementById('f_track_select');
  const trackNewWrap = document.getElementById('f_track_new_wrap');
  const trackNewInput = document.getElementById('f_track_new');
  trackSelect.onchange = () => {
    if (trackSelect.value === '__new__') {
      trackNewWrap.hidden = false;
      draft.track = trackNewInput.value.trim();
      trackNewInput.focus();
    } else {
      trackNewWrap.hidden = true;
      draft.track = trackSelect.value;
    }
  };
  trackNewInput.oninput = e => { draft.track = e.target.value.trim(); };
  document.getElementById('f_tag').oninput = e => draft.tag = e.target.value;
  document.getElementById('f_why').oninput = e => draft.why = e.target.value;
  document.getElementById('f_time').oninput = e => draft.timeEstimate = e.target.value;
  document.getElementById('addStepBtn').onclick = () => { draft.steps.push(emptyStep()); renderEditor(); };
  document.getElementById('saveSopBtn').onclick = saveSop;
  if (editingId) document.getElementById('delSopBtn').onclick = deleteSop;
  wireStepEvents();
}

function wireStepEvents() {
  document.querySelectorAll('[data-f]').forEach(inp => {
    inp.oninput = e => {
      const i = +e.target.dataset.i, f = e.target.dataset.f;
      draft.steps[i][f] = f === 'points' ? Number(e.target.value) : e.target.value;
    };
  });
  document.querySelectorAll('[data-df]').forEach(inp => {
    inp.oninput = e => {
      const i = +e.target.dataset.i, di = +e.target.dataset.di, f = e.target.dataset.df;
      draft.steps[i].distractors[di][f] = e.target.value;
    };
  });
  document.querySelectorAll('[data-rm-step]').forEach(b => {
    b.onclick = () => { draft.steps.splice(+b.dataset.rmStep, 1); renderEditor(); };
  });
  document.querySelectorAll('[data-add-distractor]').forEach(b => {
    b.onclick = () => { draft.steps[+b.dataset.addDistractor].distractors.push({ pattern: '', explanation: '' }); renderEditor(); };
  });
  document.querySelectorAll('[data-rm-distractor]').forEach(b => {
    b.onclick = () => {
      const [i, di] = b.dataset.rmDistractor.split(':').map(Number);
      draft.steps[i].distractors.splice(di, 1);
      renderEditor();
    };
  });
}

async function saveSop() {
  try {
    if (!draft.title || !draft.track || draft.steps.length === 0) {
      alert('Title, track and at least one step are required.');
      return;
    }
    for (const s of draft.steps) {
      if (!s.instruction || !s.expectedPattern) {
        alert('Every step needs an instruction and an expected command pattern.');
        return;
      }
    }
    const body = JSON.stringify(draft);
    if (editingId) await api(`/admin/sops/${editingId}`, { method: 'PUT', body });
    else await api('/admin/sops', { method: 'POST', body });
    editingId = null; draft = null;
    document.getElementById('sopEditor').innerHTML = '<div class="empty">Saved. Select an SOP to edit, or create a new one.</div>';
    loadSops();
  } catch (e) { alert(e.message); }
}

async function deleteSop() {
  if (!confirm('Delete this SOP? This cannot be undone.')) return;
  try {
    await api(`/admin/sops/${editingId}`, { method: 'DELETE' });
    editingId = null; draft = null;
    document.getElementById('sopEditor').innerHTML = '<div class="empty">Select an SOP to edit, or create a new one.</div>';
    loadSops();
  } catch (e) { alert(e.message); }
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-edit]');
  if (b) openEditor(sops.find(s => s.id === b.dataset.edit));
  if (e.target.id === 'newSopBtn') openEditor(null);
});

/* ================= Users & roles ================= */
async function loadUsers() {
  const [{ users }, { tracks }] = await Promise.all([api('/admin/users'), api('/admin/tracks')]);
  const tbl = document.getElementById('userTable');
  document.getElementById('trackHint').textContent = tracks.length
    ? ` — available tracks: ${tracks.join(', ')}`
    : ' — no SOP tracks exist yet, create an SOP first';

  tbl.innerHTML = `<tr><th>Username</th><th>Role</th><th>Assigned tracks</th><th></th></tr>` +
    users.map(u => `<tr>
      <td>${esc(u.username)}</td>
      <td>
        <select data-role="${u.id}">
          <option value="trainee" ${u.role === 'trainee' ? 'selected' : ''}>Trainee</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </td>
      <td>${tracks.length ? `
        <details class="trackpicker">
          <summary data-summary-for="${u.id}">${esc(trackSummary(u.tracks))}</summary>
          <div class="trackpicker-panel">
            ${tracks.map(t => `<label class="chip"><input type="checkbox" data-track="${u.id}" value="${esc(t)}" ${u.tracks.includes(t) ? 'checked' : ''}> ${esc(t)}</label>`).join('')}
          </div>
        </details>` : '—'}</td>
      <td><button class="link danger" data-del-user="${u.id}" type="button">Delete</button></td>
    </tr>`).join('');

  tbl.querySelectorAll('[data-role]').forEach(sel => {
    sel.onchange = async (e) => {
      try { await api(`/admin/users/${e.target.dataset.role}/role`, { method: 'PATCH', body: JSON.stringify({ role: e.target.value }) }); loadUsers(); }
      catch (ex) { alert(ex.message); loadUsers(); }
    };
  });
  tbl.querySelectorAll('[data-track]').forEach(cb => {
    cb.onchange = async (e) => {
      const uid = e.target.dataset.track;
      const checked = [...tbl.querySelectorAll(`[data-track="${uid}"]:checked`)].map(x => x.value);
      const summary = tbl.querySelector(`[data-summary-for="${uid}"]`);
      if (summary) summary.textContent = trackSummary(checked);
      await api(`/admin/users/${uid}/tracks`, { method: 'PATCH', body: JSON.stringify({ tracks: checked }) });
    };
  });
  tbl.querySelectorAll('[data-del-user]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Delete this user? Their progress will be removed too.')) return;
      try { await api(`/admin/users/${b.dataset.delUser}`, { method: 'DELETE' }); loadUsers(); }
      catch (ex) { alert(ex.message); }
    };
  });
}

/* ================= Reports ================= */
async function loadReports() {
  const { users } = await api('/admin/reports');
  const tbl = document.getElementById('repTable');
  tbl.innerHTML = `<tr><th>Username</th><th>Tracks</th><th>Completed</th><th>Score</th><th>Safety violations</th><th></th></tr>` +
    (users.map(u => `<tr>
      <td>${esc(u.username)}</td><td>${esc(u.tracks.join(', ')) || '—'}</td>
      <td>${u.completedSops}/${u.assignedSops}</td><td>${u.totalScore}</td>
      <td>${u.safetyViolations > 0 ? `<span class="badge warn">${u.safetyViolations}</span>` : '0'}</td>
      <td><a class="link" href="report.html?user=${u.userId}">View report</a></td>
    </tr>`).join('') || '<tr><td class="empty" colspan="6">No trainees yet.</td></tr>');
}

loadSops();
