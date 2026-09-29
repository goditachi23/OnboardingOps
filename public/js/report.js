const reportUser = requireAuth();
const params = new URLSearchParams(location.search);
const targetUserId = params.get('user');

if (reportUser) {
  if (reportUser.role === 'admin') document.getElementById('backLink').href = 'admin.html';
  if (targetUserId && reportUser.role !== 'admin') location.href = 'report.html';
}

function gradeClass(g) {
  return { EXCELLENT: 'g-excellent', GOOD: 'g-good', FAIR: 'g-fair', POOR: 'g-poor' }[g] || '';
}

function render(d) {
  const el = document.getElementById('content');
  if (d.assignedCount === 0) {
    el.innerHTML = '<div class="empty">No SOPs are assigned yet.</div>';
    return;
  }
  el.innerHTML = `
    <div class="report-header">
      <div>
        <h2 style="margin:0">${d.username}'s onboarding report</h2>
        <p class="sub">${d.completedCount}/${d.assignedCount} SOPs completed${d.allCompleted ? ' — all done \u2714' : ''}</p>
      </div>
      ${d.overallGrade ? `<div class="grade-badge ${gradeClass(d.overallGrade)}">${d.overallGrade}<small>${d.overallPercentage}%</small></div>` : ''}
    </div>
    <div class="kpis">
      <div class="kpi"><b>${d.totalHints}</b><span>Hints used</span></div>
      <div class="kpi"><b>${d.totalSafetyViolations}</b><span>Dangerous commands blocked</span></div>
      <div class="kpi"><b>${d.completedCount}</b><span>SOPs finished</span></div>
    </div>
    <table class="tbl">
      <tr><th>SOP</th><th>Status</th><th>Score</th><th>Grade</th><th>Hints</th><th>Errors</th><th>Safety</th><th>Time</th></tr>
      ${d.reports.map(r => `<tr>
        <td>${r.sopTitle}</td>
        <td>${r.status === 'completed' ? '\u2714 Completed' : 'In progress'}</td>
        <td>${r.score}/${r.maxScore}</td>
        <td>${r.grade ? `<span class="badge ${gradeClass(r.grade)}">${r.grade}</span>` : '—'}</td>
        <td>${r.hintsUsed}</td><td>${r.errors}</td>
        <td>${r.safetyViolations > 0 ? `<span class="badge warn">${r.safetyViolations}</span>` : '0'}</td>
        <td>${r.durationSeconds ? Math.round(r.durationSeconds / 60) + ' min' : '—'}</td>
      </tr>`).join('')}
    </table>
    <p class="foot">Generated ${new Date().toLocaleString()} — every score here is computed and stored on the server; nothing in the browser can change it.</p>`;
}

async function load() {
  try {
    const data = targetUserId ? await api(`/reports/admin/user/${targetUserId}`) : await api('/reports/overview');
    render(data);
  } catch (e) {
    document.getElementById('content').innerHTML = `<div class="empty">${e.message}</div>`;
  }
}

load();
