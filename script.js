/* ============================================================
   TestCase Studio — script.js
   ============================================================ */
'use strict';

/* ============================================================
   CONSTANTS
   ============================================================ */
const STORAGE_KEYS = { PROJECTS: 'tcs_projects', TEST_CASES: 'tcs_testcases', META: 'tcs_meta' };

const PRIORITY_ORDER = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const STATUS_COLORS  = { Passed: '#22c55e', Failed: '#ef4444', 'Not Run': '#5a6378', Blocked: '#f59e0b' };

/* ============================================================
   STORAGE MODULE
   ============================================================ */
const Storage = (() => {
  function _load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed !== null ? parsed : fallback;
    } catch { return fallback; }
  }

  function _save(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); return true; }
    catch { return false; }
  }

  function getProjects()   { return _load(STORAGE_KEYS.PROJECTS, []); }
  function getTestCases()  { return _load(STORAGE_KEYS.TEST_CASES, []); }
  function saveProjects(p) { _save(STORAGE_KEYS.PROJECTS, p); }
  function saveTestCases(t){ _save(STORAGE_KEYS.TEST_CASES, t); }

  function validate(projects, testCases) {
    const pIds = new Set(projects.map(p => p.id));
    return {
      projects: Array.isArray(projects)  ? projects.filter(p => p && p.id && p.name)  : [],
      testCases: Array.isArray(testCases) ? testCases.filter(tc =>
        tc && tc.id && tc.title && tc.projectId && pIds.has(tc.projectId)
      ) : []
    };
  }

  function clearAll() {
    localStorage.removeItem(STORAGE_KEYS.PROJECTS);
    localStorage.removeItem(STORAGE_KEYS.TEST_CASES);
    localStorage.removeItem(STORAGE_KEYS.META);
  }

  return { getProjects, getTestCases, saveProjects, saveTestCases, validate, clearAll };
})();

/* ============================================================
   ID GENERATOR
   ============================================================ */
const IDGen = (() => {
  function newProjectId() { return 'PRJ-' + Date.now().toString(36).toUpperCase(); }

  function newTestCaseId(existingIds) {
    let num = 1;
    const existing = new Set(existingIds);
    let id;
    do { id = 'TC-' + String(num).padStart(4, '0'); num++; } while (existing.has(id));
    return id;
  }
  return { newProjectId, newTestCaseId };
})();

/* ============================================================
   APP STATE
   ============================================================ */
let state = {
  projects: [],
  testCases: [],
  currentSection: 'dashboard',
  tcFilters: { search: '', project: '', priority: '', type: '', status: '', sort: 'createdAt-desc' },
  execFilters: { search: '', project: '', status: '' },
  generatedCase: null,
  confirmCallback: null,
  tcDetailId: null,
  lastExportFiltered: false,
};

/* ============================================================
   TOAST
   ============================================================ */
const Toast = (() => {
  const container = () => document.getElementById('toastContainer');

  function show(msg, type = 'info', duration = 3200) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container().appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 300ms'; setTimeout(() => el.remove(), 320); }, duration);
  }

  return { success: m => show(m, 'success'), error: m => show(m, 'error'), info: m => show(m, 'info') };
})();

/* ============================================================
   CONFIRM DIALOG
   ============================================================ */
const Confirm = (() => {
  const modal   = () => document.getElementById('confirmModal');
  const msgEl   = () => document.getElementById('confirmMessage');
  const titleEl = () => document.getElementById('confirmTitle');
  const okBtn   = () => document.getElementById('confirmOk');
  const cancelBtn = () => document.getElementById('confirmCancel');

  function show(title, message, onConfirm, danger = true) {
    titleEl().textContent = title;
    msgEl().textContent   = message;
    okBtn().className     = danger ? 'btn btn-danger' : 'btn btn-primary';
    modal().classList.remove('hidden');
    state.confirmCallback = onConfirm;
  }

  function close() { modal().classList.add('hidden'); state.confirmCallback = null; }

  function init() {
    okBtn().addEventListener('click', () => { if (state.confirmCallback) state.confirmCallback(); close(); });
    cancelBtn().addEventListener('click', close);
  }

  return { show, close, init };
})();

/* ============================================================
   DASHBOARD
   ============================================================ */
const Dashboard = (() => {
  function computeStats() {
    const tcs = state.testCases;
    return {
      total:    tcs.length,
      passed:   tcs.filter(t => t.status === 'Passed').length,
      failed:   tcs.filter(t => t.status === 'Failed').length,
      notrun:   tcs.filter(t => t.status === 'Not Run').length,
      blocked:  tcs.filter(t => t.status === 'Blocked').length,
      projects: state.projects.length,
    };
  }

  function render() {
    const stats = computeStats();
    document.getElementById('statTotal').textContent    = stats.total;
    document.getElementById('statPassed').textContent   = stats.passed;
    document.getElementById('statFailed').textContent   = stats.failed;
    document.getElementById('statNotRun').textContent   = stats.notrun;
    document.getElementById('statBlocked').textContent  = stats.blocked;
    document.getElementById('statProjects').textContent = stats.projects;

    renderChart(stats);
    renderRecent();
  }

  function renderChart(stats) {
    const chartEl  = document.getElementById('statusChart');
    const legendEl = document.getElementById('chartLegend');
    const total    = stats.total || 1;

    const rows = [
      { label: 'Passed',  count: stats.passed,  color: STATUS_COLORS.Passed  },
      { label: 'Failed',  count: stats.failed,  color: STATUS_COLORS.Failed  },
      { label: 'Not Run', count: stats.notrun,  color: STATUS_COLORS['Not Run'] },
      { label: 'Blocked', count: stats.blocked, color: STATUS_COLORS.Blocked },
    ];

    chartEl.innerHTML = rows.map(r => `
      <div class="chart-bar-row">
        <span class="chart-bar-label">${r.label}</span>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" style="width:${(r.count / total * 100).toFixed(1)}%;background:${r.color}"></div>
        </div>
        <span class="chart-bar-count">${r.count}</span>
      </div>`).join('');

    legendEl.innerHTML = rows.map(r =>
      `<span><span class="legend-dot" style="background:${r.color}"></span> ${r.label} (${r.count})</span>`).join('');
  }

  function renderRecent() {
    const recent = [...state.testCases]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 6);

    const el = document.getElementById('recentTestCases');
    if (!recent.length) { el.innerHTML = '<p class="text-muted" style="font-size:13px">No test cases yet.</p>'; return; }

    el.innerHTML = `<div class="recent-list">${recent.map(tc => `
      <div class="recent-item">
        <div>
          <div class="recent-item-title">${esc(tc.title)}</div>
          <div class="recent-item-meta">${esc(tc.id)} &middot; ${esc(tc.type)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${statusBadge(tc.status)}
          ${priorityBadge(tc.priority)}
        </div>
      </div>`).join('')}</div>`;
  }

  return { render };
})();

/* ============================================================
   BADGE HELPERS
   ============================================================ */
function statusBadge(status) {
  const cls = { Passed: 'badge-passed', Failed: 'badge-failed', 'Not Run': 'badge-notrun', Blocked: 'badge-blocked' };
  return `<span class="badge ${cls[status] || 'badge-notrun'}">${esc(status)}</span>`;
}

function priorityBadge(p) {
  const cls = { Low: 'badge-low', Medium: 'badge-medium', High: 'badge-high', Critical: 'badge-critical' };
  return `<span class="badge ${cls[p] || ''}">${esc(p)}</span>`;
}

function typeBadge(t) {
  const cls = { Functional: 'badge-functional', UI: 'badge-ui', Integration: 'badge-integration', Regression: 'badge-regression', Performance: 'badge-performance', Security: 'badge-security' };
  return `<span class="badge ${cls[t] || ''}">${esc(t)}</span>`;
}

/* ============================================================
   ESCAPE HTML
   ============================================================ */
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ============================================================
   PROJECT SELECT SYNC
   ============================================================ */
function populateProjectSelects() {
  const selects = ['tcFilterProject','tcProject','genProject','execFilterProject'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const val = sel.value;
    const placeholder = id.includes('Filter')
      ? 'All Projects'
      : id === 'tcProject' ? 'Select project' : '— None —';
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    state.projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
    sel.value = val;
  });
}

/* ============================================================
   TEST CASES — CRUD
   ============================================================ */
const TestCases = (() => {
  /* ---------- helpers ---------- */
  function getProject(id) { return state.projects.find(p => p.id === id); }

  function applyFilters(tcs) {
    const f = state.tcFilters;
    let list = tcs;
    if (f.search)   list = list.filter(t => t.id.toLowerCase().includes(f.search.toLowerCase()) || t.title.toLowerCase().includes(f.search.toLowerCase()));
    if (f.project)  list = list.filter(t => t.projectId === f.project);
    if (f.priority) list = list.filter(t => t.priority === f.priority);
    if (f.type)     list = list.filter(t => t.type === f.type);
    if (f.status)   list = list.filter(t => t.status === f.status);
    return sort(list, f.sort);
  }

  function sort(list, key) {
    const copy = [...list];
    switch (key) {
      case 'createdAt-desc': return copy.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      case 'createdAt-asc':  return copy.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
      case 'title-asc':      return copy.sort((a,b) => a.title.localeCompare(b.title));
      case 'title-desc':     return copy.sort((a,b) => b.title.localeCompare(a.title));
      case 'priority-desc':  return copy.sort((a,b) => (PRIORITY_ORDER[b.priority]||0) - (PRIORITY_ORDER[a.priority]||0));
      case 'status-asc':     return copy.sort((a,b) => a.status.localeCompare(b.status));
      default: return copy;
    }
  }

  /* ---------- render table ---------- */
  function renderTable() {
    const tbody  = document.getElementById('tcTableBody');
    const empty  = document.getElementById('tcEmpty');
    const list   = applyFilters(state.testCases);

    if (!list.length) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      document.getElementById('tcTableWrapper').classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');
    document.getElementById('tcTableWrapper').classList.remove('hidden');

    tbody.innerHTML = list.map(tc => {
      const proj = getProject(tc.projectId);
      return `<tr>
        <td class="tc-id">${esc(tc.id)}</td>
        <td class="tc-title"><a href="#" data-view="${esc(tc.id)}">${esc(tc.title)}</a></td>
        <td>${esc(proj ? proj.name : '—')}</td>
        <td>${priorityBadge(tc.priority)}</td>
        <td>${typeBadge(tc.type)}</td>
        <td>${statusBadge(tc.status)}</td>
        <td style="font-size:12px;color:var(--text-muted)">${fmtDate(tc.updatedAt)}</td>
        <td class="actions-cell">
          <button class="btn btn-ghost btn-sm" data-edit="${esc(tc.id)}">Edit</button>
          <button class="btn btn-danger btn-sm" data-delete="${esc(tc.id)}">Delete</button>
        </td>
      </tr>`;
    }).join('');
  }

  /* ---------- open form ---------- */
  function openForm(tc = null) {
    const modal = document.getElementById('tcModal');
    const form  = document.getElementById('tcForm');
    form.reset();
    clearSteps();

    document.getElementById('tcModalTitle').textContent = tc ? 'Edit Test Case' : 'New Test Case';
    document.getElementById('tcFormId').value   = tc ? tc.id : '';
    document.getElementById('tcTitle').value    = tc ? tc.title : '';
    document.getElementById('tcScenario').value = tc ? tc.scenario : '';
    document.getElementById('tcPreconditions').value = tc ? tc.preconditions : '';
    document.getElementById('tcExpected').value = tc ? tc.expectedResult : '';
    document.getElementById('tcActual').value   = tc ? tc.actualResult : '';
    document.getElementById('tcNotes').value    = tc ? tc.notes : '';
    document.getElementById('tcPriority').value = tc ? tc.priority : '';
    document.getElementById('tcType').value     = tc ? tc.type : '';
    document.getElementById('tcStatus').value   = tc ? tc.status : 'Not Run';
    document.getElementById('tcProject').value  = tc ? tc.projectId : '';

    const steps = tc && tc.steps.length ? tc.steps : [{ id: uid(), description: '', order: 1 }];
    steps.forEach(s => addStepRow(s));

    modal.classList.remove('hidden');
  }

  function closeForm() { document.getElementById('tcModal').classList.add('hidden'); }

  /* ---------- save ---------- */
  function saveForm() {
    const form = document.getElementById('tcForm');
    if (!validateTcForm()) return;

    const id    = document.getElementById('tcFormId').value;
    const isNew = !id;
    const now   = new Date().toISOString();

    const steps = collectSteps();
    if (!steps.length) { Toast.error('Add at least one test step.'); return; }

    const tc = {
      id:             isNew ? IDGen.newTestCaseId(state.testCases.map(t => t.id)) : id,
      title:          document.getElementById('tcTitle').value.trim(),
      projectId:      document.getElementById('tcProject').value,
      scenario:       document.getElementById('tcScenario').value.trim(),
      preconditions:  document.getElementById('tcPreconditions').value.trim(),
      steps,
      expectedResult: document.getElementById('tcExpected').value.trim(),
      actualResult:   document.getElementById('tcActual').value.trim(),
      priority:       document.getElementById('tcPriority').value,
      type:           document.getElementById('tcType').value,
      status:         document.getElementById('tcStatus').value,
      notes:          document.getElementById('tcNotes').value.trim(),
      createdAt:      isNew ? now : (state.testCases.find(t => t.id === id)?.createdAt || now),
      updatedAt:      now,
    };

    if (isNew) {
      state.testCases.push(tc);
    } else {
      const idx = state.testCases.findIndex(t => t.id === id);
      if (idx !== -1) state.testCases[idx] = tc;
    }

    Storage.saveTestCases(state.testCases);
    closeForm();
    renderTable();
    Dashboard.render();
    Execution.renderTable();
    Toast.success(isNew ? `Test case ${tc.id} created.` : `Test case ${tc.id} updated.`);
  }

  /* ---------- delete ---------- */
  function deleteTc(id) {
    Confirm.show('Delete Test Case', `Delete "${state.testCases.find(t=>t.id===id)?.title}"? This cannot be undone.`, () => {
      state.testCases = state.testCases.filter(t => t.id !== id);
      Storage.saveTestCases(state.testCases);
      renderTable();
      Dashboard.render();
      Execution.renderTable();
      Toast.success('Test case deleted.');
    });
  }

  /* ---------- detail view ---------- */
  function openDetail(id) {
    const tc   = state.testCases.find(t => t.id === id);
    if (!tc) return;
    state.tcDetailId = id;
    const proj = state.projects.find(p => p.id === tc.projectId);
    const body = document.getElementById('tcDetailBody');

    body.innerHTML = `
      <div class="detail-grid">
        <div><div class="detail-label">ID</div><div class="detail-value tc-id">${esc(tc.id)}</div></div>
        <div><div class="detail-label">Status</div><div class="detail-value">${statusBadge(tc.status)}</div></div>
        <div class="detail-full"><div class="detail-label">Title</div><div class="detail-value">${esc(tc.title)}</div></div>
        <div><div class="detail-label">Project</div><div class="detail-value">${esc(proj?.name || '—')}</div></div>
        <div><div class="detail-label">Type</div><div class="detail-value">${typeBadge(tc.type)}</div></div>
        <div><div class="detail-label">Priority</div><div class="detail-value">${priorityBadge(tc.priority)}</div></div>
        <div class="detail-full"><div class="detail-label">Scenario / Objective</div><div class="detail-value">${esc(tc.scenario)}</div></div>
        <div class="detail-full"><div class="detail-label">Preconditions</div><div class="detail-value">${esc(tc.preconditions || '—')}</div></div>
        <div class="detail-full">
          <div class="detail-label">Test Steps</div>
          <ol class="detail-steps">${tc.steps.map(s => `<li class="detail-step"><span class="detail-step-num">${s.order}.</span><span>${esc(s.description)}</span></li>`).join('')}</ol>
        </div>
        <div class="detail-full"><div class="detail-label">Expected Result</div><div class="detail-value">${esc(tc.expectedResult)}</div></div>
        <div class="detail-full"><div class="detail-label">Actual Result</div><div class="detail-value">${esc(tc.actualResult || '—')}</div></div>
        <div class="detail-full"><div class="detail-label">Notes</div><div class="detail-value">${esc(tc.notes || '—')}</div></div>
        <div><div class="detail-label">Created</div><div class="detail-value">${fmtDate(tc.createdAt)}</div></div>
        <div><div class="detail-label">Last Updated</div><div class="detail-value">${fmtDate(tc.updatedAt)}</div></div>
      </div>`;

    document.getElementById('tcDetailTitle').textContent = tc.id + ' — ' + tc.title;
    document.getElementById('tcDetailModal').classList.remove('hidden');
  }

  /* ---------- steps management ---------- */
  function addStepRow(step) {
    const container = document.getElementById('stepsContainer');
    const row = document.createElement('div');
    row.className = 'step-row';
    row.dataset.stepId = step.id;
    row.innerHTML = `
      <span class="step-number">#</span>
      <textarea class="input textarea step-input" rows="2" placeholder="Describe this step…">${esc(step.description)}</textarea>
      <div class="step-actions">
        <button type="button" class="btn-icon" title="Move up" data-moveup>&#8593;</button>
        <button type="button" class="btn-icon" title="Move down" data-movedown>&#8595;</button>
        <button type="button" class="btn-icon danger" title="Remove step" data-removestep>&#x2715;</button>
      </div>`;
    row.querySelector('[data-moveup]').addEventListener('click', () => { const prev = row.previousElementSibling; if (prev) container.insertBefore(row, prev); renumberSteps(); });
    row.querySelector('[data-movedown]').addEventListener('click', () => { const next = row.nextElementSibling; if (next) container.insertBefore(next, row); renumberSteps(); });
    row.querySelector('[data-removestep]').addEventListener('click', () => { row.remove(); renumberSteps(); });
    container.appendChild(row);
    renumberSteps();
  }

  function renumberSteps() {
    document.querySelectorAll('.step-row').forEach((r, i) => {
      r.querySelector('.step-number').textContent = i + 1;
    });
  }

  function clearSteps() {
    document.getElementById('stepsContainer').innerHTML = '';
  }

  function collectSteps() {
    return Array.from(document.querySelectorAll('.step-row')).map((row, i) => ({
      id: row.dataset.stepId || uid(),
      description: row.querySelector('.step-input').value.trim(),
      order: i + 1,
    })).filter(s => s.description);
  }

  /* ---------- validation ---------- */
  function validateTcForm() {
    const required = [
      { id: 'tcTitle',    label: 'Title' },
      { id: 'tcProject',  label: 'Project' },
      { id: 'tcScenario', label: 'Scenario' },
      { id: 'tcPriority', label: 'Priority' },
      { id: 'tcType',     label: 'Test Type' },
      { id: 'tcExpected', label: 'Expected Result' },
    ];
    let valid = true;
    required.forEach(({ id, label }) => {
      const el = document.getElementById(id);
      const v  = el.value.trim();
      if (!v) { el.classList.add('error'); Toast.error(`${label} is required.`); valid = false; }
      else el.classList.remove('error');
    });
    return valid;
  }

  /* ---------- filter event wiring ---------- */
  function initFilters() {
    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => { state.tcFilters[key] = el.value; renderTable(); });
    };
    bind('tcSearch','search'); bind('tcFilterProject','project'); bind('tcFilterPriority','priority');
    bind('tcFilterType','type'); bind('tcFilterStatus','status'); bind('tcSort','sort');
  }

  /* ---------- event listeners ---------- */
  function init() {
    document.getElementById('newTestCaseBtn').addEventListener('click', () => openForm());
    document.getElementById('tcEmptyNewBtn').addEventListener('click', () => openForm());
    document.getElementById('tcModalClose').addEventListener('click', closeForm);
    document.getElementById('tcFormCancel').addEventListener('click', closeForm);
    document.getElementById('tcFormSave').addEventListener('click', saveForm);
    document.getElementById('addStepBtn').addEventListener('click', () => addStepRow({ id: uid(), description: '', order: 0 }));

    document.getElementById('tcDetailClose').addEventListener('click', () => document.getElementById('tcDetailModal').classList.add('hidden'));
    document.getElementById('tcDetailClose2').addEventListener('click', () => document.getElementById('tcDetailModal').classList.add('hidden'));
    document.getElementById('tcDetailEdit').addEventListener('click', () => {
      document.getElementById('tcDetailModal').classList.add('hidden');
      const tc = state.testCases.find(t => t.id === state.tcDetailId);
      if (tc) openForm(tc);
    });

    document.getElementById('tcTableBody').addEventListener('click', e => {
      const editId   = e.target.dataset.edit;
      const delId    = e.target.dataset.delete;
      const viewId   = e.target.closest('a[data-view]')?.dataset.view;
      if (editId)  openForm(state.testCases.find(t => t.id === editId));
      if (delId)   deleteTc(delId);
      if (viewId)  { e.preventDefault(); openDetail(viewId); }
    });

    initFilters();
  }

  function getFiltered() { return applyFilters(state.testCases); }

  return { init, renderTable, openForm, getFiltered };
})();

/* ============================================================
   PROJECTS — CRUD
   ============================================================ */
const Projects = (() => {
  function renderGrid() {
    const grid  = document.getElementById('projectsGrid');
    const empty = document.getElementById('projectsEmpty');
    if (!state.projects.length) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    grid.innerHTML = state.projects.map(p => {
      const count = state.testCases.filter(t => t.projectId === p.id).length;
      return `
        <div class="project-card">
          <div class="project-card-header">
            <span class="project-card-title">${esc(p.name)}</span>
            <div class="project-card-actions">
              <button class="btn btn-ghost btn-sm" data-proj-edit="${esc(p.id)}">Edit</button>
              <button class="btn btn-danger btn-sm" data-proj-delete="${esc(p.id)}">Delete</button>
            </div>
          </div>
          <p class="project-card-desc">${esc(p.description || 'No description.')}</p>
          <div class="project-card-meta">
            <span>${count} test case${count !== 1 ? 's' : ''}</span>
            <span>Updated ${fmtDate(p.updatedAt)}</span>
          </div>
        </div>`;
    }).join('');
  }

  function openForm(proj = null) {
    document.getElementById('projectModalTitle').textContent = proj ? 'Edit Project' : 'New Project';
    document.getElementById('projectFormId').value   = proj ? proj.id : '';
    document.getElementById('projectName').value     = proj ? proj.name : '';
    document.getElementById('projectDesc').value     = proj ? proj.description : '';
    document.getElementById('projectName').classList.remove('error');
    document.getElementById('projectModal').classList.remove('hidden');
  }

  function closeForm() { document.getElementById('projectModal').classList.add('hidden'); }

  function saveForm() {
    const nameEl = document.getElementById('projectName');
    const name   = nameEl.value.trim();
    if (!name) { nameEl.classList.add('error'); Toast.error('Project name is required.'); return; }
    nameEl.classList.remove('error');

    const id    = document.getElementById('projectFormId').value;
    const isNew = !id;
    const now   = new Date().toISOString();

    if (isNew) {
      state.projects.push({ id: IDGen.newProjectId(), name, description: document.getElementById('projectDesc').value.trim(), createdAt: now, updatedAt: now });
    } else {
      const idx = state.projects.findIndex(p => p.id === id);
      if (idx !== -1) {
        state.projects[idx].name        = name;
        state.projects[idx].description = document.getElementById('projectDesc').value.trim();
        state.projects[idx].updatedAt   = now;
      }
    }

    Storage.saveProjects(state.projects);
    closeForm();
    renderGrid();
    populateProjectSelects();
    Dashboard.render();
    Toast.success(isNew ? 'Project created.' : 'Project updated.');
  }

  function deleteProject(id) {
    const proj  = state.projects.find(p => p.id === id);
    const count = state.testCases.filter(t => t.projectId === id).length;
    const msg   = count
      ? `"${proj.name}" has ${count} test case(s). Deleting this project will also delete those test cases. Continue?`
      : `Delete project "${proj.name}"?`;

    Confirm.show('Delete Project', msg, () => {
      state.testCases = state.testCases.filter(t => t.projectId !== id);
      state.projects  = state.projects.filter(p => p.id !== id);
      Storage.saveProjects(state.projects);
      Storage.saveTestCases(state.testCases);
      renderGrid();
      populateProjectSelects();
      TestCases.renderTable();
      Execution.renderTable();
      Dashboard.render();
      Toast.success('Project deleted.');
    });
  }

  function init() {
    document.getElementById('newProjectBtn').addEventListener('click', () => openForm());
    document.getElementById('projectsEmptyNewBtn').addEventListener('click', () => openForm());
    document.getElementById('projectModalClose').addEventListener('click', closeForm);
    document.getElementById('projectFormCancel').addEventListener('click', closeForm);
    document.getElementById('projectFormSave').addEventListener('click', saveForm);

    document.getElementById('projectsGrid').addEventListener('click', e => {
      const editId = e.target.dataset.projEdit;
      const delId  = e.target.dataset.projDelete;
      if (editId) openForm(state.projects.find(p => p.id === editId));
      if (delId)  deleteProject(delId);
    });
  }

  return { init, renderGrid };
})();

/* ============================================================
   TEST CASE GENERATOR
   ============================================================ */
const Generator = (() => {
  /* ---------- rule-based generation ---------- */
  function generate(input) {
    const { feature, description, objective, preconditions, scenario, expected, type, priority, projectId } = input;

    // derive title
    const titleVerb = { Functional: 'Verify', UI: 'Validate UI for', Integration: 'Test integration of', Regression: 'Regression check:', Performance: 'Measure performance of', Security: 'Security audit of' };
    const title = `${titleVerb[type] || 'Test'} ${feature}`;

    // derive test objective
    const genObjective = `Verify that ${feature} ${objective.trim().endsWith('.') ? objective.trim().slice(0,-1) : objective.trim()}, as described: ${description.trim()}`;

    // derive preconditions
    const basePreconditions = preconditions.trim()
      ? preconditions.trim()
      : `The application is running and accessible. The ${feature} feature is available.`;

    // derive steps from scenario
    const rawSteps = buildSteps(feature, scenario, type);

    // derive expected result
    const genExpected = expected.trim().endsWith('.')
      ? expected.trim()
      : expected.trim() + '.';

    return {
      id: IDGen.newTestCaseId(state.testCases.map(t => t.id)),
      title,
      projectId: projectId || '',
      scenario: genObjective,
      preconditions: basePreconditions,
      steps: rawSteps,
      expectedResult: genExpected,
      actualResult: '',
      priority,
      type,
      status: 'Not Run',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  function buildSteps(feature, scenario, type) {
    const sentences = scenario.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 3);
    const steps = [];
    let order = 1;

    // always start with navigation/setup step
    steps.push({ id: uid(), description: `Navigate to the ${feature} section of the application.`, order: order++ });

    // type-specific setup
    if (type === 'UI') {
      steps.push({ id: uid(), description: `Inspect the visual layout and components of the ${feature} interface.`, order: order++ });
    } else if (type === 'Security') {
      steps.push({ id: uid(), description: `Ensure authentication credentials with minimum privileges are used.`, order: order++ });
    } else if (type === 'Performance') {
      steps.push({ id: uid(), description: `Start performance monitoring or timing tool before the action.`, order: order++ });
    } else if (type === 'Integration') {
      steps.push({ id: uid(), description: `Confirm that all dependent systems or services are available.`, order: order++ });
    }

    // scenario-derived steps
    if (sentences.length) {
      sentences.forEach(s => {
        steps.push({ id: uid(), description: capitalise(s) + '.', order: order++ });
      });
    } else {
      steps.push({ id: uid(), description: `Perform the primary action on the ${feature} feature.`, order: order++ });
    }

    // type-specific verification steps
    if (type === 'UI') {
      steps.push({ id: uid(), description: `Verify that the visual output matches the expected design (spacing, colors, fonts).`, order: order++ });
    } else if (type === 'Performance') {
      steps.push({ id: uid(), description: `Record the elapsed time and compare against the defined performance threshold.`, order: order++ });
    } else if (type === 'Security') {
      steps.push({ id: uid(), description: `Attempt to access restricted functionality without authorization and verify it is denied.`, order: order++ });
    } else if (type === 'Regression') {
      steps.push({ id: uid(), description: `Verify previously working functionality has not been broken by recent changes.`, order: order++ });
    }

    // always end with result verification
    steps.push({ id: uid(), description: `Observe the result and verify it matches the expected outcome.`, order: order++ });

    return steps;
  }

  function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- UI ---------- */
  function renderPreview(tc) {
    const proj = state.projects.find(p => p.id === tc.projectId);
    return `
      <div class="preview-section"><div class="preview-label">ID</div><div class="preview-value tc-id">${esc(tc.id)}</div></div>
      <div class="preview-section"><div class="preview-label">Title</div><div class="preview-value">${esc(tc.title)}</div></div>
      <div class="preview-section"><div class="preview-label">Project</div><div class="preview-value">${esc(proj?.name || '—')}</div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">${statusBadge(tc.status)} ${priorityBadge(tc.priority)} ${typeBadge(tc.type)}</div>
      <div class="preview-section"><div class="preview-label">Objective</div><div class="preview-value">${esc(tc.scenario)}</div></div>
      <div class="preview-section"><div class="preview-label">Preconditions</div><div class="preview-value">${esc(tc.preconditions)}</div></div>
      <div class="preview-section">
        <div class="preview-label">Test Steps</div>
        <ol class="preview-steps">${tc.steps.map(s => `<li class="preview-step"><span class="preview-step-num">${s.order}.</span><span>${esc(s.description)}</span></li>`).join('')}</ol>
      </div>
      <div class="preview-section"><div class="preview-label">Expected Result</div><div class="preview-value">${esc(tc.expectedResult)}</div></div>`;
  }

  function init() {
    const form = document.getElementById('generatorForm');

    form.addEventListener('submit', e => {
      e.preventDefault();
      const required = ['genFeature', 'genDescription', 'genObjective', 'genScenario', 'genExpected', 'genType', 'genPriority'];
      let valid = true;
      required.forEach(id => {
        const el = document.getElementById(id);
        if (!el.value.trim()) { el.classList.add('error'); valid = false; }
        else el.classList.remove('error');
      });
      if (!valid) { Toast.error('Please fill in all required fields.'); return; }

      const input = {
        feature:       document.getElementById('genFeature').value.trim(),
        description:   document.getElementById('genDescription').value.trim(),
        objective:     document.getElementById('genObjective').value.trim(),
        preconditions: document.getElementById('genPreconditions').value.trim(),
        scenario:      document.getElementById('genScenario').value.trim(),
        expected:      document.getElementById('genExpected').value.trim(),
        type:          document.getElementById('genType').value,
        priority:      document.getElementById('genPriority').value,
        projectId:     document.getElementById('genProject').value,
      };

      state.generatedCase = generate(input);
      document.getElementById('generatorPreviewContent').innerHTML = renderPreview(state.generatedCase);
      document.getElementById('generatorPreview').classList.remove('hidden');
    });

    document.getElementById('genClearBtn').addEventListener('click', () => {
      form.reset();
      form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
      document.getElementById('generatorPreview').classList.add('hidden');
      state.generatedCase = null;
    });

    document.getElementById('genSaveBtn').addEventListener('click', () => {
      if (!state.generatedCase) return;
      state.testCases.push(state.generatedCase);
      Storage.saveTestCases(state.testCases);
      TestCases.renderTable();
      Dashboard.render();
      Execution.renderTable();
      Toast.success(`Test case ${state.generatedCase.id} saved.`);
      document.getElementById('generatorPreview').classList.add('hidden');
      form.reset();
      state.generatedCase = null;
    });

    document.getElementById('genDiscardBtn').addEventListener('click', () => {
      document.getElementById('generatorPreview').classList.add('hidden');
      state.generatedCase = null;
    });
  }

  return { init };
})();

/* ============================================================
   EXECUTION
   ============================================================ */
const Execution = (() => {
  function applyFilters() {
    const f   = state.execFilters;
    let list  = [...state.testCases];
    if (f.search)  list = list.filter(t => t.id.toLowerCase().includes(f.search.toLowerCase()) || t.title.toLowerCase().includes(f.search.toLowerCase()));
    if (f.project) list = list.filter(t => t.projectId === f.project);
    if (f.status)  list = list.filter(t => t.status === f.status);
    return list.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  function renderTable() {
    const tbody = document.getElementById('execTableBody');
    const empty = document.getElementById('execEmpty');
    const list  = applyFilters();

    if (!list.length) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = list.map(tc => {
      const proj = state.projects.find(p => p.id === tc.projectId);
      return `<tr>
        <td class="tc-id">${esc(tc.id)}</td>
        <td class="tc-title">${esc(tc.title)}</td>
        <td>${esc(proj?.name || '—')}</td>
        <td>${priorityBadge(tc.priority)}</td>
        <td>${statusBadge(tc.status)}</td>
        <td style="font-size:12px;color:var(--text-muted)">${fmtDate(tc.updatedAt)}</td>
        <td class="actions-cell">
          <button class="btn btn-primary btn-sm" data-exec="${esc(tc.id)}">Record</button>
        </td>
      </tr>`;
    }).join('');
  }

  function openExecModal(id) {
    const tc = state.testCases.find(t => t.id === id);
    if (!tc) return;
    document.getElementById('execModalTitle').textContent = `Execution: ${tc.id}`;
    document.getElementById('execFormTcId').value = id;
    document.getElementById('execStatus').value   = tc.status;
    document.getElementById('execActual').value   = tc.actualResult || '';
    document.getElementById('execNotes').value    = tc.notes || '';
    document.getElementById('execModal').classList.remove('hidden');
  }

  function saveExec() {
    const id     = document.getElementById('execFormTcId').value;
    const status = document.getElementById('execStatus').value;
    const idx    = state.testCases.findIndex(t => t.id === id);
    if (idx === -1) return;
    state.testCases[idx].status       = status;
    state.testCases[idx].actualResult = document.getElementById('execActual').value.trim();
    state.testCases[idx].notes        = document.getElementById('execNotes').value.trim();
    state.testCases[idx].updatedAt    = new Date().toISOString();
    Storage.saveTestCases(state.testCases);
    document.getElementById('execModal').classList.add('hidden');
    renderTable();
    TestCases.renderTable();
    Dashboard.render();
    Toast.success(`Execution status updated to "${status}".`);
  }

  function init() {
    document.getElementById('execTableBody').addEventListener('click', e => {
      const id = e.target.dataset.exec;
      if (id) openExecModal(id);
    });
    document.getElementById('execModalClose').addEventListener('click', () => document.getElementById('execModal').classList.add('hidden'));
    document.getElementById('execFormCancel').addEventListener('click', () => document.getElementById('execModal').classList.add('hidden'));
    document.getElementById('execFormSave').addEventListener('click', saveExec);

    document.getElementById('execSearch').addEventListener('input', e => { state.execFilters.search = e.target.value; renderTable(); });
    document.getElementById('execFilterProject').addEventListener('change', e => { state.execFilters.project = e.target.value; renderTable(); });
    document.getElementById('execFilterStatus').addEventListener('change', e => { state.execFilters.status = e.target.value; renderTable(); });
  }

  return { init, renderTable };
})();

/* ============================================================
   IMPORT / EXPORT
   ============================================================ */
const ImportExport = (() => {
  /* ---------- CSV helpers ---------- */
  function escapeCsv(val) {
    const s = String(val ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  }

  function parseCsvLine(line) {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ',') { result.push(cur); cur = ''; }
        else cur += ch;
      }
    }
    result.push(cur);
    return result;
  }

  function stepsToString(steps) {
    return steps.map((s, i) => `${i+1}. ${s.description}`).join(' | ');
  }

  /* ---------- export ---------- */
  function exportCsv(all) {
    const list = all ? state.testCases : TestCases.getFiltered();
    if (!list.length) { Toast.info('No test cases to export.'); return; }

    const headers = ['id','title','projectId','projectName','scenario','preconditions','steps','expectedResult','actualResult','priority','type','status','notes','createdAt','updatedAt'];
    const rows = list.map(tc => {
      const proj = state.projects.find(p => p.id === tc.projectId);
      return [tc.id, tc.title, tc.projectId, proj?.name||'', tc.scenario, tc.preconditions, stepsToString(tc.steps), tc.expectedResult, tc.actualResult, tc.priority, tc.type, tc.status, tc.notes, tc.createdAt, tc.updatedAt].map(escapeCsv).join(',');
    });

    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `testcases_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success(`Exported ${list.length} test case(s).`);
  }

  /* ---------- import ---------- */
  const REQUIRED_COLS = ['title', 'projectId', 'scenario', 'preconditions', 'expectedResult', 'priority', 'type', 'status'];
  let importBuffer = [];

  function previewImport(file) {
    if (!file) { Toast.error('Please select a CSV file.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const text  = e.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { showImportModal([], ['File is empty or has no data rows.']); return; }

      const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
      const errors  = [];
      const missing = REQUIRED_COLS.filter(c => !headers.includes(c));
      if (missing.length) { errors.push(`Missing required columns: ${missing.join(', ')}`); showImportModal([], errors); return; }

      const parsed  = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < headers.length && cols.join('').trim() === '') continue;
        const row = {};
        headers.forEach((h, j) => row[h] = (cols[j] || '').trim());

        // validate mandatory fields
        REQUIRED_COLS.forEach(c => { if (!row[c]) errors.push(`Row ${i+1}: "${c}" is empty.`); });
        if (!['Low','Medium','High','Critical'].includes(row.priority)) errors.push(`Row ${i+1}: invalid priority "${row.priority}".`);
        if (!['Functional','UI','Integration','Regression','Performance','Security'].includes(row.type)) errors.push(`Row ${i+1}: invalid type "${row.type}".`);
        if (!['Not Run','Passed','Failed','Blocked'].includes(row.status)) errors.push(`Row ${i+1}: invalid status "${row.status}".`);

        parsed.push(row);
      }
      showImportModal(parsed, errors);
    };
    reader.readAsText(file);
  }

  function showImportModal(rows, errors) {
    const body = document.getElementById('importModalBody');
    let html = '';

    if (errors.length) {
      html += `<div class="import-errors"><p>⚠ ${errors.length} issue(s) found:</p><ul>${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
    }

    if (rows.length) {
      html += `<p class="import-success-msg">✓ ${rows.length} row(s) ready to import (rows with errors may be skipped).</p>`;
      html += `<div class="import-table-wrapper"><table class="data-table"><thead><tr><th>Title</th><th>ProjectId</th><th>Priority</th><th>Type</th><th>Status</th></tr></thead>
        <tbody>${rows.slice(0,15).map(r => `<tr><td>${esc(r.title)}</td><td class="tc-id">${esc(r.projectid||r.projectId||'')}</td><td>${priorityBadge(r.priority)}</td><td>${typeBadge(r.type)}</td><td>${statusBadge(r.status)}</td></tr>`).join('')}</tbody></table></div>`;
      if (rows.length > 15) html += `<p class="text-muted mt-2" style="font-size:12px">…and ${rows.length - 15} more rows</p>`;
    }

    if (!rows.length && !errors.length) html = '<p class="text-muted">No valid rows found.</p>';

    importBuffer = rows.filter(r => {
      return r.title && r.priority && r.type && r.status &&
        ['Low','Medium','High','Critical'].includes(r.priority) &&
        ['Functional','UI','Integration','Regression','Performance','Security'].includes(r.type) &&
        ['Not Run','Passed','Failed','Blocked'].includes(r.status);
    });

    document.getElementById('importModalConfirm').disabled = importBuffer.length === 0;
    body.innerHTML = html;
    document.getElementById('importModal').classList.remove('hidden');
  }

  function confirmImport() {
    const now       = new Date().toISOString();
    const existIds  = new Set(state.testCases.map(t => t.id));
    let   created   = 0, skipped = 0;

    importBuffer.forEach(row => {
      const stepsRaw = (row.steps || '').split('|').map((s, i) => {
        const desc = s.replace(/^\d+\.\s*/, '').trim();
        return desc ? { id: uid(), description: desc, order: i + 1 } : null;
      }).filter(Boolean);

      const proposedId = row.id && row.id.startsWith('TC-') ? row.id : null;
      const id = (proposedId && !existIds.has(proposedId))
        ? proposedId
        : IDGen.newTestCaseId([...existIds]);

      if (existIds.has(id)) { skipped++; return; }
      existIds.add(id);

      state.testCases.push({
        id,
        title:          row.title,
        projectId:      row.projectid || row.projectId || '',
        scenario:       row.scenario || '',
        preconditions:  row.preconditions || '',
        steps:          stepsRaw.length ? stepsRaw : [{ id: uid(), description: 'Perform the test action.', order: 1 }],
        expectedResult: row.expectedresult || row.expectedResult || '',
        actualResult:   row.actualresult   || row.actualResult   || '',
        priority:       row.priority,
        type:           row.type,
        status:         row.status,
        notes:          row.notes || '',
        createdAt:      row.createdat || row.createdAt || now,
        updatedAt:      now,
      });
      created++;
    });

    Storage.saveTestCases(state.testCases);
    document.getElementById('importModal').classList.add('hidden');
    document.getElementById('importFile').value = '';
    importBuffer = [];
    TestCases.renderTable();
    Execution.renderTable();
    Dashboard.render();
    Toast.success(`Imported ${created} test case(s).${skipped ? ` Skipped ${skipped} duplicate ID(s).` : ''}`);
  }

  function init() {
    document.getElementById('exportCsvBtn').addEventListener('click', () => {
      const scope = document.getElementById('exportFilter').value;
      exportCsv(scope === 'all');
    });

    document.getElementById('importPreviewBtn').addEventListener('click', () => {
      const file = document.getElementById('importFile').files[0];
      previewImport(file);
    });

    document.getElementById('importModalClose').addEventListener('click', () => document.getElementById('importModal').classList.add('hidden'));
    document.getElementById('importModalCancel').addEventListener('click', () => document.getElementById('importModal').classList.add('hidden'));
    document.getElementById('importModalConfirm').addEventListener('click', confirmImport);
  }

  return { init };
})();

/* ============================================================
   NAVIGATION
   ============================================================ */
const Nav = (() => {
  function switchSection(name) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`section-${name}`).classList.remove('hidden');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.section === name));
    state.currentSection = name;
    closeSidebar();
  }

  function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('open');
  }
  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  }

  function init() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        switchSection(link.dataset.section);
      });
    });
    document.getElementById('hamburgerBtn').addEventListener('click', openSidebar);
    document.getElementById('sidebarCloseBtn').addEventListener('click', closeSidebar);
    document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
  }

  return { init, switchSection };
})();

/* ============================================================
   SAMPLE DATA
   ============================================================ */
function loadSampleData() {
  Confirm.show('Load Sample Data', 'This will replace all current data with sample data. Continue?', () => {
    const now = new Date().toISOString();

    const projects = [
      { id: 'PRJ-SAMPLE1', name: 'E-Commerce Platform', description: 'Online shopping platform testing', createdAt: now, updatedAt: now },
      { id: 'PRJ-SAMPLE2', name: 'Authentication Module', description: 'Login, logout, and SSO flows', createdAt: now, updatedAt: now },
      { id: 'PRJ-SAMPLE3', name: 'Mobile App v2.0', description: 'iOS/Android regression suite', createdAt: now, updatedAt: now },
    ];

    const testCases = [
      { id: 'TC-0001', title: 'Verify user login with valid credentials', projectId: 'PRJ-SAMPLE2', scenario: 'Verify that registered users can log in with correct username and password.', preconditions: 'User account exists. Application is running.', steps: [{id:uid(),description:'Open the application login page.',order:1},{id:uid(),description:'Enter a valid registered username.',order:2},{id:uid(),description:'Enter the correct password.',order:3},{id:uid(),description:'Click the Login button.',order:4},{id:uid(),description:'Observe the resulting page.',order:5}], expectedResult: 'User is redirected to the dashboard with a welcome message.', actualResult: 'User redirected successfully.', priority: 'Critical', type: 'Functional', status: 'Passed', notes: '', createdAt: now, updatedAt: now },
      { id: 'TC-0002', title: 'Verify login fails with invalid password', projectId: 'PRJ-SAMPLE2', scenario: 'Verify that login is rejected when an incorrect password is entered.', preconditions: 'User account exists.', steps: [{id:uid(),description:'Open the login page.',order:1},{id:uid(),description:'Enter a valid username.',order:2},{id:uid(),description:'Enter an incorrect password.',order:3},{id:uid(),description:'Click Login.',order:4}], expectedResult: 'An error message is displayed and the user is not logged in.', actualResult: '', priority: 'High', type: 'Security', status: 'Not Run', notes: '', createdAt: now, updatedAt: now },
      { id: 'TC-0003', title: 'Add product to shopping cart', projectId: 'PRJ-SAMPLE1', scenario: 'Verify that users can add products to the shopping cart.', preconditions: 'User is logged in. At least one product is listed.', steps: [{id:uid(),description:'Navigate to the product listing page.',order:1},{id:uid(),description:'Click on a product to view its detail page.',order:2},{id:uid(),description:'Click "Add to Cart".',order:3},{id:uid(),description:'Open the cart icon.',order:4}], expectedResult: 'The product appears in the cart with correct quantity and price.', actualResult: 'Cart total was incorrect.', priority: 'High', type: 'Functional', status: 'Failed', notes: 'Price calculation bug logged as DEF-042.', createdAt: now, updatedAt: now },
      { id: 'TC-0004', title: 'Validate checkout form required fields', projectId: 'PRJ-SAMPLE1', scenario: 'Verify that submitting an empty checkout form shows validation errors.', preconditions: 'User has items in cart.', steps: [{id:uid(),description:'Proceed to checkout.',order:1},{id:uid(),description:'Leave all fields blank.',order:2},{id:uid(),description:'Click Place Order.',order:3}], expectedResult: 'Each required field shows a validation error message.', actualResult: '', priority: 'Medium', type: 'UI', status: 'Not Run', notes: '', createdAt: now, updatedAt: now },
      { id: 'TC-0005', title: 'Performance test — product search response time', projectId: 'PRJ-SAMPLE1', scenario: 'Verify that product search returns results within 2 seconds.', preconditions: 'Database contains at least 1000 product records.', steps: [{id:uid(),description:'Start a response timer.',order:1},{id:uid(),description:'Enter a search keyword.',order:2},{id:uid(),description:'Submit the search.',order:3},{id:uid(),description:'Record the time when results are displayed.',order:4}], expectedResult: 'Search results are displayed within 2 seconds.', actualResult: '', priority: 'Medium', type: 'Performance', status: 'Blocked', notes: 'Test environment not ready.', createdAt: now, updatedAt: now },
      { id: 'TC-0006', title: 'Regression: user profile update', projectId: 'PRJ-SAMPLE3', scenario: 'Verify that users can update profile information without errors after the v2.0 release.', preconditions: 'User is logged in on mobile.', steps: [{id:uid(),description:'Navigate to Profile settings.',order:1},{id:uid(),description:'Update the display name.',order:2},{id:uid(),description:'Tap Save.',order:3},{id:uid(),description:'Return to profile page.',order:4}], expectedResult: 'Updated name is displayed on the profile page.', actualResult: 'Update saved correctly.', priority: 'High', type: 'Regression', status: 'Passed', notes: '', createdAt: now, updatedAt: now },
    ];

    state.projects  = projects;
    state.testCases = testCases;
    Storage.saveProjects(projects);
    Storage.saveTestCases(testCases);
    populateProjectSelects();
    TestCases.renderTable();
    Projects.renderGrid();
    Execution.renderTable();
    Dashboard.render();
    Toast.success('Sample data loaded.');
  }, false);
}

/* ============================================================
   UTILITIES
   ============================================================ */
function uid() { return Math.random().toString(36).slice(2, 10); }

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
}

/* ============================================================
   APP INITIALISATION
   ============================================================ */
function init() {
  /* load & validate state */
  const raw = { projects: Storage.getProjects(), testCases: Storage.getTestCases() };
  const validated = Storage.validate(raw.projects, raw.testCases);
  state.projects  = validated.projects;
  state.testCases = validated.testCases;

  /* init modules */
  Nav.init();
  Confirm.init();
  TestCases.init();
  Projects.init();
  Generator.init();
  Execution.init();
  ImportExport.init();

  /* initial render */
  populateProjectSelects();
  Dashboard.render();
  TestCases.renderTable();
  Projects.renderGrid();
  Execution.renderTable();

  /* sidebar utility buttons */
  document.getElementById('loadSampleBtn').addEventListener('click', loadSampleData);
  document.getElementById('clearDataBtn').addEventListener('click', () => {
    Confirm.show('Clear All Data', 'This will permanently delete all test cases and projects. This cannot be undone.', () => {
      Storage.clearAll();
      state.projects  = [];
      state.testCases = [];
      populateProjectSelects();
      Dashboard.render();
      TestCases.renderTable();
      Projects.renderGrid();
      Execution.renderTable();
      Toast.info('All data cleared.');
    });
  });

  /* close modals on backdrop click */
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop && backdrop.id !== 'confirmModal') {
        backdrop.classList.add('hidden');
      }
    });
  });

  /* keyboard: Escape closes topmost open modal */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const open = [...document.querySelectorAll('.modal-backdrop:not(.hidden)')].pop();
      if (open && open.id !== 'confirmModal') open.classList.add('hidden');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
