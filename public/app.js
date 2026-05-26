const POLL_INTERVAL_MS = 5000;
const STALE_THRESHOLD_MS = 15000;

/* ===== Auth bootstrap ===== */
const token = localStorage.getItem('aegis_token');
const userJson = localStorage.getItem('aegis_user');

if (!token) {
  window.location.href = '/login.html';
}

const authHeaders = { Authorization: `Bearer ${token}` };

const els = {
  liveIndicator: document.getElementById('liveIndicator'),
  serverTime:    document.getElementById('serverTime'),
  lastUpdate:    document.getElementById('lastUpdate'),
  userEmail:     document.getElementById('userEmail'),
  logoutBtn:     document.getElementById('logoutBtn'),

  situationPanel:    document.getElementById('situationPanel'),
  situationLevel:    document.getElementById('situationLevel'),
  situationLevelVal: document.getElementById('situationLevelValue'),
  situationHeadline: document.getElementById('situationHeadline'),
  situationSummary:  document.getElementById('situationSummary'),
  situationRecs:     document.getElementById('situationRecs'),
  situationFoot:     document.getElementById('situationFoot'),

  statHealthy:        document.getElementById('statHealthy'),
  statHealthyFoot:    document.getElementById('statHealthyFoot'),
  statWarning:        document.getElementById('statWarning'),
  statCritical:       document.getElementById('statCritical'),
  statPending:        document.getElementById('statPending'),
  statPendingFoot:    document.getElementById('statPendingFoot'),
  statResolved:       document.getElementById('statResolved'),
  statResolvedFoot:   document.getElementById('statResolvedFoot'),
  statAvgCpu:         document.getElementById('statAvgCpu'),
  statAvgRam:         document.getElementById('statAvgRam'),

  nodesGrid:    document.getElementById('nodesGrid'),
  nodesSub:     document.getElementById('nodesSub'),
  logFeed:      document.getElementById('logFeed'),
  incidentsFeed: document.getElementById('incidentsFeed'),
  auditFeed:    document.getElementById('auditFeed'),
  siemFeed:     document.getElementById('siemFeed'),
  topologyGraph: document.getElementById('topologyGraph'),
  chaosResult:  document.getElementById('chaosResult'),

  autopilotMaster:     document.getElementById('autopilotMaster'),
  autopilotSub:        document.getElementById('autopilotSub'),
  autopilotStateValue: document.getElementById('autopilotStateValue'),
  autopilotCost:       document.getElementById('autopilotCost'),
  autopilotCta:        document.getElementById('autopilotCta'),
  autopilotToggle:     document.getElementById('autopilotToggle'),

  aiHeartbeat:  document.getElementById('aiHeartbeat'),
  hbStatus:     document.getElementById('hbStatus'),
  hbElapsed:    document.getElementById('hbElapsed'),
  hbLast:       document.getElementById('hbLast'),
  aiConsoleFeed: document.getElementById('aiConsoleFeed'),
  aiConsoleSub: document.getElementById('aiConsoleSub'),

  quotaRpmValue:  document.getElementById('quotaRpmValue'),
  quotaRpmBar:    document.getElementById('quotaRpmBar'),
  quotaRpmMeta:   document.getElementById('quotaRpmMeta'),
  quotaRpdValue:  document.getElementById('quotaRpdValue'),
  quotaRpdBar:    document.getElementById('quotaRpdBar'),
  quotaRpdMeta:   document.getElementById('quotaRpdMeta'),
  cost24hCalls:   document.getElementById('cost24hCalls'),
  cost24hMeta:    document.getElementById('cost24hMeta'),
  costLifeCalls:  document.getElementById('costLifeCalls'),
  costLifeMeta:   document.getElementById('costLifeMeta'),
  costSourceList: document.getElementById('costSourceList'),
  costModel:      document.getElementById('costModel'),
};

const fmtTokens = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M tok`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k tok`;
  return `${v} tok`;
};

const quotaClassForPercent = (p) => {
  if (p >= 90) return 'crit';
  if (p >= 70) return 'hot';
  if (p >= 40) return 'warn';
  return '';
};

/* ===== AI Heartbeat + Console ===== */
let lastTraceShown = null;
let lastHeartbeatTickMs = 0;
const expandedTraceIds = new Set();

const SOURCE_LABEL = {
  siem_correlator:    'SIEM Correlator',
  situation_reporter: 'Situation Reporter',
};

const fmtMs = (ms) => {
  const n = Number(ms) || 0;
  if (n < 1000) return `${n}ms`;
  return `${(n / 1000).toFixed(2)}s`;
};

const fmtElapsedShort = (ms) => {
  const seconds = Math.floor((Number(ms) || 0) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
};

const renderHeartbeat = (activity) => {
  if (!activity) return;
  const inFlight = activity.in_flight || [];
  const recentDone = (activity.traces || []).find((t) => t.status !== 'in_flight');

  if (inFlight.length > 0) {
    const f = inFlight[0];
    els.aiHeartbeat.dataset.state = 'busy';
    els.hbStatus.textContent = `${SOURCE_LABEL[f.source] || f.source} → Gemini, analyzing…`;
    els.hbElapsed.textContent = `${fmtMs(f.elapsed_ms)} elapsed`;
    els.hbLast.textContent = recentDone
      ? `last: ${SOURCE_LABEL[recentDone.source] || recentDone.source} · ${fmtMs(recentDone.duration_ms)}`
      : '';
  } else if (recentDone) {
    const isFail = recentDone.status === 'failed';
    els.aiHeartbeat.dataset.state = isFail ? 'failed' : 'success';
    els.hbStatus.textContent = isFail
      ? `${SOURCE_LABEL[recentDone.source] || recentDone.source} failed`
      : `idle · last call ${isFail ? 'failed' : 'OK'}`;
    const tokens = (recentDone.input_tokens || 0) + (recentDone.output_tokens || 0);
    els.hbElapsed.textContent = recentDone.duration_ms ? `${fmtMs(recentDone.duration_ms)}` : '';
    els.hbLast.textContent = `${SOURCE_LABEL[recentDone.source] || recentDone.source} · ${tokens} tok · ${fmtElapsedShort(Date.now() - new Date(recentDone.finished_at || recentDone.started_at).getTime())}`;
  } else {
    els.aiHeartbeat.dataset.state = 'idle';
    els.hbStatus.textContent = 'idle · awaiting next cycle';
    els.hbElapsed.textContent = '';
    els.hbLast.textContent = '';
  }
};

const renderAiConsole = (activity) => {
  if (!activity) return;
  const traces = activity.traces || [];
  const inFlight = activity.in_flight || [];

  const inFlightRows = inFlight.map((f) => ({
    id: f.trace_id,
    source: f.source,
    status: 'in_flight',
    started_at: f.started_at,
    duration_ms: f.elapsed_ms,
    input_tokens: null,
    output_tokens: null,
    system_instruction_preview: null,
    prompt_preview: null,
    response_preview: null,
    error_message: null,
  }));

  const allRows = [
    ...inFlightRows,
    ...traces.filter((t) => !inFlight.find((f) => f.trace_id === t.id)),
  ];

  if (allRows.length === 0) {
    els.aiConsoleFeed.innerHTML = '<div class="empty-state">No Gemini calls yet — flip the autopilot switch ON.</div>';
    els.aiConsoleSub.textContent = 'click any row to inspect the actual prompt + response';
    return;
  }

  els.aiConsoleSub.textContent = `${traces.length} recent trace${traces.length === 1 ? '' : 's'} · ${inFlight.length} in flight`;

  /* Garbage-collect expanded set: drop IDs that no longer exist in the data */
  const currentIds = new Set(allRows.map((r) => r.id));
  for (const id of expandedTraceIds) {
    if (!currentIds.has(id)) expandedTraceIds.delete(id);
  }

  els.aiConsoleFeed.innerHTML = allRows.map((t) => {
    const sourceLabel = SOURCE_LABEL[t.source] || t.source;
    const sourceClass = t.source === 'situation_reporter' ? 'situation' : 'siem';
    const status = t.status;
    const tokens = (Number(t.input_tokens) || 0) + (Number(t.output_tokens) || 0);
    const tokensStr = tokens > 0 ? `${tokens} tok` : '—';
    const durStr = t.duration_ms != null ? fmtMs(t.duration_ms) : '—';
    const time = new Date(t.started_at).toLocaleTimeString('de-DE', { hour12: false });
    const isExpanded = expandedTraceIds.has(t.id);
    const expandedCls = isExpanded ? ' expanded' : '';

    return `
      <div class="trace-row${expandedCls}" data-trace-id="${escapeHtml(t.id)}">
        <div class="trace-summary${expandedCls}">
          <span class="trace-time">${time}</span>
          <span class="trace-source"><span class="trace-source-badge ${sourceClass}">${escapeHtml(sourceLabel)}</span></span>
          <span class="trace-status ${status}">${escapeHtml(status.replace('_', ' '))}</span>
          <span class="trace-meta">${durStr}</span>
          <span class="trace-meta">${tokensStr}</span>
          <span class="trace-chevron">▸</span>
        </div>
        <div class="trace-detail">
          ${t.system_instruction_preview ? `
            <div class="trace-section system">
              <div class="trace-section-head">System Instruction</div>
              <div class="trace-code">${escapeHtml(t.system_instruction_preview)}</div>
            </div>` : ''}
          ${t.prompt_preview ? `
            <div class="trace-section">
              <div class="trace-section-head">User Prompt</div>
              <div class="trace-code">${escapeHtml(t.prompt_preview)}</div>
            </div>` : ''}
          ${t.response_preview ? `
            <div class="trace-section response">
              <div class="trace-section-head">Gemini Response</div>
              <div class="trace-code">${escapeHtml(t.response_preview)}</div>
            </div>` : ''}
          ${t.error_message ? `
            <div class="trace-section error">
              <div class="trace-section-head">Error</div>
              <div class="trace-code">${escapeHtml(t.error_message)}</div>
            </div>` : ''}
          ${status === 'in_flight' ? `
            <div class="trace-section">
              <div class="trace-section-head">Awaiting response from Gemini…</div>
            </div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  els.aiConsoleFeed.querySelectorAll('.trace-summary').forEach((summary) => {
    summary.addEventListener('click', () => {
      const row = summary.closest('.trace-row');
      const traceId = row?.dataset?.traceId;
      if (!traceId) return;
      const nowExpanded = !expandedTraceIds.has(traceId);
      if (nowExpanded) expandedTraceIds.add(traceId);
      else expandedTraceIds.delete(traceId);
      summary.classList.toggle('expanded', nowExpanded);
      row.classList.toggle('expanded', nowExpanded);
    });
  });
};

let lastActivityFetch = 0;

const fetchAiActivity = async () => {
  try {
    const data = await fetchJson('/api/infrastructure/ai-activity?limit=20');
    renderHeartbeat(data);
    renderAiConsole(data);
    lastActivityFetch = Date.now();
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      console.warn('[ai-activity] fetch failed', err.message);
    }
  }
};

const tickHeartbeatLocal = () => {
  if (els.aiHeartbeat.dataset.state !== 'busy') return;
  const baseElapsedText = els.hbElapsed.textContent;
  const match = baseElapsedText && baseElapsedText.match(/([\d.]+)(ms|s)/);
  if (!match) return;
  const sinceFetch = Date.now() - lastActivityFetch;
  const baseMs = match[2] === 's' ? parseFloat(match[1]) * 1000 : parseFloat(match[1]);
  const live = baseMs + sinceFetch;
  els.hbElapsed.textContent = `${fmtMs(Math.round(live / 100) * 100)} elapsed`;
};

const renderCostStrip = (data) => {
  if (!data) return;
  const q = data.quota || {};

  /* RPM cell */
  if (q.rpm_limit) {
    els.quotaRpmValue.textContent = `${q.rpm_used} / ${q.rpm_limit}`;
    els.quotaRpmBar.style.width = Math.min(100, q.rpm_percent) + '%';
    els.quotaRpmBar.className = 'quota-bar-fill ' + quotaClassForPercent(q.rpm_percent);
    els.quotaRpmMeta.textContent = `last 60s · ${q.rpm_percent}% of free-tier RPM`;
  } else {
    els.quotaRpmValue.textContent = `${q.rpm_used} calls`;
    els.quotaRpmBar.style.width = '0%';
    els.quotaRpmMeta.textContent = 'last 60s (no model limit known)';
  }

  /* RPD cell */
  if (q.rpd_limit) {
    els.quotaRpdValue.textContent = `${q.rpd_used} / ${q.rpd_limit}`;
    els.quotaRpdBar.style.width = Math.min(100, q.rpd_percent) + '%';
    els.quotaRpdBar.className = 'quota-bar-fill ' + quotaClassForPercent(q.rpd_percent);
    const remaining = Math.max(0, q.rpd_limit - q.rpd_used);
    els.quotaRpdMeta.textContent = `${remaining} left · resets midnight UTC`;
  } else {
    els.quotaRpdValue.textContent = `${q.rpd_used} calls`;
    els.quotaRpdBar.style.width = '0%';
    els.quotaRpdMeta.textContent = 'today (no model limit known)';
  }

  /* 24h + lifetime keep counts + tokens */
  const fillCount = (b, callsEl, metaEl) => {
    callsEl.textContent = `${b.calls} call${b.calls === 1 ? '' : 's'}`;
    const failTag = b.failed_calls > 0 ? `  ·  ${b.failed_calls} fail` : '';
    metaEl.textContent = `${fmtTokens(b.tokens)}${failTag}`;
  };
  fillCount(data.last_24h, els.cost24hCalls, els.cost24hMeta);
  fillCount(data.lifetime, els.costLifeCalls, els.costLifeMeta);

  /* Source tags */
  if (!data.by_source_today || data.by_source_today.length === 0) {
    els.costSourceList.innerHTML = '<span class="cost-source-tag"><span class="tag-source">no calls today</span></span>';
  } else {
    els.costSourceList.innerHTML = data.by_source_today.map((s) => `
      <span class="cost-source-tag">
        <span class="tag-source">${escapeHtml(s.source.replace(/_/g, ' '))}</span>
        <span class="tag-value">${s.calls}</span>
      </span>
    `).join('');
  }

  els.costModel.textContent = data.active_model
    ? `model: ${data.active_model}`
    : 'model: idle';
};

/* ===== Master Autopilot Switch ===== */
let autopilotActive = false;
let autopilotBusy = false;

const renderAutopilotState = (active, meta) => {
  autopilotActive = active;
  els.autopilotMaster.classList.toggle('active', active);
  els.autopilotMaster.classList.toggle('idle', !active);

  els.autopilotStateValue.textContent = active ? 'ENGAGED' : 'OFFLINE';
  els.autopilotCta.textContent        = active ? 'DISENGAGE' : 'ACTIVATE';
  els.autopilotCost.textContent       = active
    ? 'Live defense · API calls active'
    : 'Idle · API cost $0/h';
  els.autopilotSub.textContent = active
    ? 'Simulator generating events · SIEM correlator hot · Gemini engaged'
    : 'Simulator paused · SIEM idle · zero Gemini calls until re-armed';

  if (meta && meta.updated_by) {
    els.autopilotSub.textContent += `  ·  last toggled by ${meta.updated_by}`;
  }
};

els.autopilotToggle.addEventListener('click', async () => {
  if (autopilotBusy) return;
  autopilotBusy = true;
  els.autopilotToggle.disabled = true;
  const previous = autopilotActive;
  const desired = !previous;

  renderAutopilotState(desired, null);

  try {
    const res = await fetch('/api/infrastructure/toggle-simulation', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: desired }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    renderAutopilotState(data.simulation_active, data);
    sync();
  } catch (err) {
    renderAutopilotState(previous, null);
    console.error('[autopilot-switch] toggle failed', err);
    els.autopilotSub.textContent = `Toggle failed: ${err.message}`;
  } finally {
    autopilotBusy = false;
    els.autopilotToggle.disabled = false;
  }
});

const loadAutopilotStatus = async () => {
  try {
    const data = await fetchJson('/api/infrastructure/system-status');
    renderAutopilotState(!!data.simulation_active, data);
    els.autopilotToggle.disabled = false;
  } catch (err) {
    console.error('[autopilot-switch] status load failed', err);
  }
};

/* ===== Topology graph (vis-network) — War Room edition ===== */
const STATUS_COLORS = {
  HEALTHY:         { border: '#00ffaa', background: 'rgba(0, 255, 170, 0.22)', highlight: '#00ffaa' },
  WARNING:         { border: '#ffb84d', background: 'rgba(255, 184, 77, 0.22)', highlight: '#ffb84d' },
  CRITICAL:        { border: '#ff4d6d', background: 'rgba(255, 77, 109, 0.28)', highlight: '#ff4d6d' },
  UNDER_ATTACK:    { border: '#ff4d6d', background: 'rgba(255, 77, 109, 0.30)', highlight: '#ff4d6d' },
  ISOLATED:        { border: '#b388ff', background: 'rgba(179, 136, 255, 0.22)', highlight: '#b388ff' },
  QUARANTINED:     { border: '#b388ff', background: 'rgba(179, 136, 255, 0.22)', highlight: '#b388ff' },
  DEEP_VAULT_MODE: { border: '#ffc857', background: 'rgba(255, 200, 87, 0.22)', highlight: '#ffc857' },
  DOWN:            { border: '#ff4d6d', background: 'rgba(255, 77, 109, 0.20)', highlight: '#ff4d6d' },
};

const ROLE_SHAPES = {
  GATEWAY:  { shape: 'hexagon', size: 28 },
  WEB:      { shape: 'dot', size: 22 },
  DATABASE: { shape: 'database', size: 26 },
  CACHE:    { shape: 'square', size: 22 },
  SERVICE:  { shape: 'dot', size: 20 },
};

const ATTACK_STATUSES   = new Set(['CRITICAL', 'UNDER_ATTACK', 'DOWN']);
const ISOLATED_STATUSES = new Set(['ISOLATED', 'QUARANTINED']);
const VAULT_STATUSES    = new Set(['DEEP_VAULT_MODE']);

const lockBarrierSvg = () => {
  const svg =
`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>
  <defs>
    <radialGradient id='g' cx='50%' cy='50%' r='50%'>
      <stop offset='0%' stop-color='#b388ff' stop-opacity='0.35'/>
      <stop offset='70%' stop-color='#b388ff' stop-opacity='0.10'/>
      <stop offset='100%' stop-color='#b388ff' stop-opacity='0'/>
    </radialGradient>
  </defs>
  <circle cx='60' cy='60' r='56' fill='url(#g)'/>
  <circle cx='60' cy='60' r='48' fill='none' stroke='#b388ff' stroke-width='2' stroke-dasharray='4 5'/>
  <circle cx='60' cy='60' r='36' fill='#141b30' stroke='#b388ff' stroke-width='2'/>
  <rect x='46' y='58' width='28' height='22' rx='3' fill='#b388ff'/>
  <path d='M 51 58 V 50 a 9 9 0 0 1 18 0 V 58' fill='none' stroke='#b388ff' stroke-width='3.2' stroke-linecap='round'/>
  <circle cx='60' cy='68' r='2.6' fill='#141b30'/>
  <rect x='59' y='69' width='2' height='5' fill='#141b30'/>
</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
};

const vaultBarrierSvg = () => {
  const svg =
`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>
  <defs>
    <radialGradient id='vg' cx='50%' cy='50%' r='50%'>
      <stop offset='0%' stop-color='#ffc857' stop-opacity='0.4'/>
      <stop offset='70%' stop-color='#ffc857' stop-opacity='0.12'/>
      <stop offset='100%' stop-color='#ffc857' stop-opacity='0'/>
    </radialGradient>
  </defs>
  <circle cx='60' cy='60' r='56' fill='url(#vg)'/>
  <circle cx='60' cy='60' r='50' fill='none' stroke='#ffc857' stroke-width='2.5'/>
  <circle cx='60' cy='60' r='44' fill='none' stroke='#ffc857' stroke-width='1.2' stroke-dasharray='2 3' opacity='0.7'/>
  <circle cx='60' cy='60' r='36' fill='#1a1500' stroke='#ffc857' stroke-width='2'/>
  <!-- vault wheel spokes -->
  <g stroke='#ffc857' stroke-width='2.2' stroke-linecap='round'>
    <line x1='60' y1='34' x2='60' y2='44'/>
    <line x1='60' y1='76' x2='60' y2='86'/>
    <line x1='34' y1='60' x2='44' y2='60'/>
    <line x1='76' y1='60' x2='86' y2='60'/>
    <line x1='42' y1='42' x2='49' y2='49'/>
    <line x1='71' y1='71' x2='78' y2='78'/>
    <line x1='78' y1='42' x2='71' y2='49'/>
    <line x1='49' y1='71' x2='42' y2='78'/>
  </g>
  <circle cx='60' cy='60' r='8' fill='#ffc857'/>
  <circle cx='60' cy='60' r='3' fill='#1a1500'/>
</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
};

const ISOLATED_ICON_URI = lockBarrierSvg();
const VAULT_ICON_URI    = vaultBarrierSvg();

let visNetwork = null;
const visNodesData = new vis.DataSet();
const visEdgesData = new vis.DataSet();

const attackingNodeIds = new Set();
const isolatedNodeIds  = new Set();
const vaultNodeIds     = new Set();

const initTopologyGraph = () => {
  if (visNetwork) return;
  visNetwork = new vis.Network(
    els.topologyGraph,
    { nodes: visNodesData, edges: visEdgesData },
    {
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -80,
          centralGravity: 0.015,
          springLength: 160,
          springConstant: 0.06,
          damping: 0.85,
          avoidOverlap: 0.6,
        },
        stabilization: { iterations: 250, fit: true, updateInterval: 25 },
        minVelocity: 0.5,
      },
      nodes: {
        font: { color: '#e7ecf5', face: 'Inter, system-ui', size: 13, strokeWidth: 0 },
        borderWidth: 2,
        shadow: { enabled: true, color: 'rgba(0,0,0,0.5)', size: 12, x: 0, y: 0 },
      },
      edges: {
        smooth: { enabled: true, type: 'continuous', roundness: 0.3 },
        arrows: { to: { enabled: true, scaleFactor: 0.5 } },
        shadow: false,
        width: 1.5,
      },
      interaction: { hover: true, dragNodes: true, zoomView: true },
    }
  );
};

const renderTopology = (data) => {
  if (!data) return;
  initTopologyGraph();

  const incomingIds = new Set();
  attackingNodeIds.clear();
  isolatedNodeIds.clear();
  vaultNodeIds.clear();

  for (const node of data.nodes) {
    incomingIds.add(node.id);

    const isAttack   = ATTACK_STATUSES.has(node.status);
    const isIsolated = ISOLATED_STATUSES.has(node.status);
    const isVault    = VAULT_STATUSES.has(node.status);
    const isTemp     = !!node.is_temporary;
    const palette    = STATUS_COLORS[node.status] || STATUS_COLORS.HEALTHY;
    const shape      = ROLE_SHAPES[node.role] || ROLE_SHAPES.SERVICE;

    const tempPrefix = isTemp ? '🟢 ' : '';
    const tempSuffix = isTemp ? ' · TEMP' : '';
    const tooltip =
      `${node.node_name}${isTemp ? ' (temporary scaled-out)' : ''}\n${node.ip_address}\n` +
      `status=${node.status}  role=${node.role}\n` +
      `cpu=${node.cpu_usage}%  ram=${node.ram_usage}%`;

    if (isVault) {
      vaultNodeIds.add(node.id);
      visNodesData.update({
        id: node.id,
        label: `🏦 ${node.node_name}\n${node.role} · VAULT`,
        title: tooltip,
        shape: 'image',
        image: VAULT_ICON_URI,
        size: 36,
        color: palette,
        shadow: {
          enabled: true,
          color: 'rgba(255, 200, 87, 0.75)',
          size: 32, x: 0, y: 0,
        },
        borderWidth: 0,
        font: { color: '#ffc857', face: 'Inter, system-ui', size: 13, strokeWidth: 0 },
      });
      continue;
    }

    if (isIsolated) {
      isolatedNodeIds.add(node.id);
      visNodesData.update({
        id: node.id,
        label: `🔒 ${node.node_name}\n${node.role}`,
        title: tooltip,
        shape: 'image',
        image: ISOLATED_ICON_URI,
        size: 32,
        color: palette,
        shadow: {
          enabled: true,
          color: 'rgba(179, 136, 255, 0.65)',
          size: 28, x: 0, y: 0,
        },
        borderWidth: 0,
        font: { color: '#e7ecf5', face: 'Inter, system-ui', size: 13, strokeWidth: 0 },
      });
      continue;
    }

    if (isAttack) {
      attackingNodeIds.add(node.id);
    }

    visNodesData.update({
      id: node.id,
      label: `${tempPrefix}${node.node_name}\n${node.role}${tempSuffix}`,
      title: tooltip,
      shape: shape.shape,
      size: isTemp ? Math.max(shape.size - 4, 16) : shape.size,
      color: isTemp
        ? { border: '#00ffaa', background: 'rgba(0, 255, 170, 0.10)', highlight: '#00ffaa' }
        : palette,
      borderWidth: isAttack ? 4 : node.has_active_incident ? 3 : isTemp ? 1.5 : 2,
      borderWidthSelected: isAttack ? 5 : 3,
      shapeProperties: isTemp ? { borderDashes: [4, 4] } : { borderDashes: false },
      shadow: {
        enabled: true,
        color: isTemp ? 'rgba(0, 255, 170, 0.45)' : palette.border,
        size: isAttack ? 32 : isTemp ? 12 : 18,
        x: 0, y: 0,
      },
      font: { color: '#e7ecf5', face: 'Inter, system-ui', size: 13, strokeWidth: 0 },
    });
  }
  visNodesData.getIds().forEach((id) => { if (!incomingIds.has(id)) visNodesData.remove(id); });

  const linkIds = new Set();
  const attackingEndpoints = new Set([...attackingNodeIds, ...isolatedNodeIds]);

  for (const link of data.links) {
    linkIds.add(link.id);
    const blocked = link.status === 'BLOCKED';
    const touchesAttack = !blocked && (attackingEndpoints.has(link.source) || attackingEndpoints.has(link.target));

    let edgeColor;
    if (blocked) {
      edgeColor = '#ff4d6d';
    } else if (touchesAttack) {
      edgeColor = 'rgba(255, 184, 77, 0.85)';
    } else {
      edgeColor = 'rgba(0, 255, 170, 0.45)';
    }

    visEdgesData.update({
      id: link.id,
      from: link.source,
      to: link.target,
      label: link.link_type.replace(/_/g, ' '),
      font: {
        size: 9,
        color: blocked ? '#ff4d6d' : touchesAttack ? '#ffb84d' : '#5a6580',
        strokeWidth: 0,
        align: 'middle',
      },
      color: { color: edgeColor, highlight: blocked ? '#ff4d6d' : '#00ffaa' },
      dashes: blocked ? [6, 6] : false,
      width: blocked ? 2.6 : touchesAttack ? 2.0 : 1.4,
      shadow: {
        enabled: !blocked,
        color: touchesAttack ? 'rgba(255, 184, 77, 0.5)' : 'rgba(0, 255, 170, 0.35)',
        size: touchesAttack ? 10 : 6,
        x: 0, y: 0,
      },
    });
  }
  visEdgesData.getIds().forEach((id) => { if (!linkIds.has(id)) visEdgesData.remove(id); });
};

/* ===== Pulse animator for under-attack nodes ===== */
let pulsePhase = false;
let pulseStarted = false;

const startAttackPulse = () => {
  if (pulseStarted) return;
  pulseStarted = true;
  setInterval(() => {
    if (attackingNodeIds.size === 0) return;
    pulsePhase = !pulsePhase;

    for (const nodeId of attackingNodeIds) {
      const hot     = pulsePhase;
      const border  = hot ? '#ff4d6d' : '#ff8a3d';
      const fill    = hot ? 'rgba(255, 77, 109, 0.42)' : 'rgba(255, 138, 61, 0.20)';
      const glowCol = hot ? 'rgba(255, 77, 109, 0.85)' : 'rgba(255, 138, 61, 0.45)';
      const glowSize = hot ? 38 : 18;
      const borderW  = hot ? 5 : 3;

      visNodesData.update({
        id: nodeId,
        color: { border, background: fill, highlight: border },
        borderWidth: borderW,
        shadow: { enabled: true, color: glowCol, size: glowSize, x: 0, y: 0 },
      });
    }
  }, 580);
};

const renderSiemAlerts = (alerts) => {
  if (!alerts || alerts.length === 0) {
    els.siemFeed.innerHTML = '<div class="empty-state">No coordinated campaigns detected.</div>';
    return;
  }
  els.siemFeed.innerHTML = alerts.map((a) => {
    const severity = (a.severity || 'medium').toLowerCase();
    let nodesArr = [];
    if (Array.isArray(a.affected_nodes)) nodesArr = a.affected_nodes;
    else if (typeof a.affected_nodes === 'string') {
      try { nodesArr = JSON.parse(a.affected_nodes); } catch {}
    }
    const nodeTags = nodesArr.map((n) => `<span>${escapeHtml(n)}</span>`).join('');
    return `
      <div class="siem-card severity-${severity}">
        <div class="siem-head">
          <span class="siem-type">${escapeHtml(a.campaign_type)}</span>
          <span class="siem-severity-badge ${severity}">${escapeHtml(a.severity)}</span>
        </div>
        <div class="siem-summary">${escapeHtml(a.summary)}</div>
        <div class="siem-meta">
          <span><span class="siem-meta-key">Detected</span><span class="siem-meta-val">${fmtRelative(a.detected_at)}</span></span>
          <span><span class="siem-meta-key">Incidents</span><span class="siem-meta-val">${a.incident_count}</span></span>
          <span><span class="siem-meta-key">Action</span><span class="siem-action">${escapeHtml(a.recommended_action)}${a.action_parameter ? ` → ${escapeHtml(a.action_parameter)}` : ''}</span></span>
          ${nodeTags ? `<span class="siem-nodes-tag">${nodeTags}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
};

if (userJson) {
  try { els.userEmail.textContent = JSON.parse(userJson).email; } catch {}
}

els.logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('aegis_token');
  localStorage.removeItem('aegis_user');
  window.location.href = '/login.html';
});

let lastSuccessfulSync = 0;

const escapeHtml = (str) => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const fmtTime = (iso) => {
  if (!iso) return '--:--:--';
  return new Date(iso).toLocaleTimeString('de-DE', { hour12: false });
};

const fmtRelative = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const fetchJson = async (url) => {
  const res = await fetch(url, { cache: 'no-store', headers: authHeaders });
  if (res.status === 401) {
    localStorage.removeItem('aegis_token');
    window.location.href = '/login.html';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
};

const renderSituation = (data) => {
  if (!data || !data.situation) return;
  const s = data.situation;
  const level = (s.threat_level || 'GREEN').toLowerCase();
  els.situationLevel.className = `situation-level level-${level}`;
  els.situationLevelVal.textContent = s.threat_level;
  els.situationHeadline.textContent = s.headline;
  els.situationSummary.textContent = s.summary;
  els.situationRecs.innerHTML = (s.recommendations || [])
    .map((r) => `<li>${escapeHtml(r)}</li>`).join('');
  els.situationFoot.textContent = `Briefing generated ${fmtRelative(s.generated_at)} · auto-refresh every 90s`;
};

const renderStats = (data) => {
  const n = data.nodes || {};
  const i = data.incidents || {};
  els.statHealthy.textContent     = n.healthy ?? 0;
  els.statHealthyFoot.textContent = `of ${n.total ?? 0} total`;
  els.statWarning.textContent     = n.warning ?? 0;
  els.statCritical.textContent    = n.critical ?? 0;
  els.statPending.textContent     = i.pending ?? 0;
  els.statPendingFoot.textContent = `${i.in_progress ?? 0} in progress`;
  els.statResolved.textContent    = i.resolved ?? 0;
  els.statResolvedFoot.textContent = `${data.recent_resolved_5min ?? 0} in last 5 min`;
  els.statAvgCpu.textContent      = n.avg_cpu ?? 0;
  els.statAvgRam.textContent      = n.avg_ram ?? 0;

  if (data.server_time) {
    els.serverTime.textContent = fmtTime(data.server_time);
  }
};

const shieldSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><path d="M12 2 L21 6 V12 C21 17 17 21 12 22 C7 21 3 17 3 12 V6 Z"/></svg>`;

const renderNodes = (nodes) => {
  if (!nodes || nodes.length === 0) {
    els.nodesGrid.innerHTML = '<div class="empty-state">No nodes registered yet.</div>';
    els.nodesSub.textContent = 'monitoring 0 nodes';
    return;
  }
  els.nodesSub.textContent = `monitoring ${nodes.length} node${nodes.length === 1 ? '' : 's'}`;

  els.nodesGrid.innerHTML = nodes.map((node) => {
    const status = (node.status || 'unknown').toLowerCase();
    const cpu = Number(node.cpu_usage) || 0;
    const ram = Number(node.ram_usage) || 0;
    const cpuHigh = cpu > 75 ? 'high' : '';
    const ramHigh = ram > 75 ? 'high' : '';
    const defending = !!node.active_action;
    const isTemp = !!node.is_temporary;
    const shieldLabel = defending && node.active_action.recommended_action
      ? node.active_action.recommended_action
      : 'AEGIS ANALYZING';
    return `
      <div class="node-card status-${status}${defending ? ' defending' : ''}${isTemp ? ' is-temporary' : ''}">
        ${defending ? `<div class="shield-badge">${shieldSvg}<span>${escapeHtml(shieldLabel)}</span></div>` : ''}
        <div class="node-head">
          <div>
            <div class="node-name">${escapeHtml(node.node_name)}</div>
            <div class="node-ip">${escapeHtml(node.ip_address)}</div>
          </div>
          <span class="node-badge ${status}">${escapeHtml(node.status)}</span>
        </div>
        <div class="metric">
          <div class="metric-row"><span class="metric-name">CPU</span><span class="metric-val">${cpu}%</span></div>
          <div class="bar"><div class="bar-fill ${cpuHigh}" style="width:${cpu}%"></div></div>
        </div>
        <div class="metric">
          <div class="metric-row"><span class="metric-name">RAM</span><span class="metric-val">${ram}%</span></div>
          <div class="bar"><div class="bar-fill ${ramHigh}" style="width:${ram}%"></div></div>
        </div>
      </div>
    `;
  }).join('');
};

const renderLogs = (logs) => {
  if (!logs || logs.length === 0) {
    els.logFeed.innerHTML = '<div class="empty-state">No log events yet.</div>';
    return;
  }
  els.logFeed.innerHTML = logs.map((log) => {
    const sev = (log.severity || 'info').toLowerCase();
    return `
      <div class="log-row">
        <span class="log-time">${fmtTime(log.created_at)}</span>
        <span class="sev-badge sev-${sev}">${escapeHtml(log.severity)}</span>
        <span class="log-node">${escapeHtml(log.node_name || '—')}</span>
        <span class="log-msg">${escapeHtml(log.message)}</span>
      </div>
    `;
  }).join('');
};

const renderIncidents = (incidents) => {
  if (!incidents || incidents.length === 0) {
    els.incidentsFeed.innerHTML = '<div class="empty-state">No incidents yet — system is clean.</div>';
    return;
  }
  els.incidentsFeed.innerHTML = incidents.map((inc) => {
    const status = (inc.status || 'pending').toLowerCase();
    let aiBlock = '';
    if (inc.ai_analysis) {
      try {
        const a = typeof inc.ai_analysis === 'string'
          ? JSON.parse(inc.ai_analysis)
          : inc.ai_analysis;
        aiBlock = `
          <div class="incident-ai">
            <div class="incident-ai-row">
              <span class="incident-ai-key">Threat</span>
              <span class="incident-ai-val">${escapeHtml(a.attack_type)} · ${escapeHtml(String(a.confidence_score))}% conf</span>
            </div>
            <div class="incident-ai-row">
              <span class="incident-ai-key">Cause</span>
              <span class="incident-ai-val">${escapeHtml(a.root_cause)}</span>
            </div>
            <div class="incident-ai-row">
              <span class="incident-ai-key">Action</span>
              <span class="incident-ai-val">${escapeHtml(a.recommended_action)}${a.action_parameter ? ` → ${escapeHtml(a.action_parameter)}` : ''}</span>
            </div>
          </div>
        `;
      } catch {
        aiBlock = `<div class="incident-ai"><div class="incident-ai-val">${escapeHtml(String(inc.ai_analysis).slice(0, 200))}</div></div>`;
      }
    }
    const actionClass = status === 'failed' ? 'failed' : '';
    const actionLine = inc.action_taken
      ? `<div class="incident-action ${actionClass}">↳ ${escapeHtml(inc.action_taken)}</div>`
      : '';
    return `
      <div class="incident-card">
        <div class="incident-head">
          <div>
            <div class="incident-title">${escapeHtml(inc.log_message)}</div>
            <div class="incident-node">${escapeHtml(inc.node_name)} · ${escapeHtml(inc.ip_address)} · ${fmtRelative(inc.log_created_at)}</div>
          </div>
          <span class="incident-status ${status}">${escapeHtml(inc.status)}</span>
        </div>
        ${aiBlock}
        ${actionLine}
      </div>
    `;
  }).join('');
};

const renderAudit = (entries) => {
  if (!entries || entries.length === 0) {
    els.auditFeed.innerHTML = '<div class="empty-state">No audit entries yet.</div>';
    return;
  }
  els.auditFeed.innerHTML = entries.map((e) => {
    const outcome = (e.outcome || 'success').toLowerCase();
    let detailStr = '';
    if (e.details) {
      try {
        const d = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
        const parts = [];
        if (d.node_name) parts.push(`node=${d.node_name}`);
        if (d.attack_type) parts.push(`threat=${d.attack_type}`);
        if (d.action_parameter) parts.push(`param=${d.action_parameter}`);
        if (d.scenario) parts.push(`scenario=${d.scenario}`);
        if (d.reason) parts.push(`reason=${d.reason}`);
        detailStr = parts.join(' · ');
      } catch {}
    }
    return `
      <div class="audit-row">
        <span class="audit-time">${fmtTime(e.created_at)}</span>
        <span class="audit-actor">${escapeHtml(e.actor)}</span>
        <span class="audit-action">${escapeHtml(e.action_type)}</span>
        <span class="audit-outcome ${outcome}">${escapeHtml(e.outcome)}</span>
        <span class="audit-details">${escapeHtml(detailStr)}</span>
      </div>
    `;
  }).join('');
};

const updateLiveIndicator = () => {
  const age = Date.now() - lastSuccessfulSync;
  if (lastSuccessfulSync === 0) return;
  if (age > STALE_THRESHOLD_MS) {
    els.liveIndicator.classList.add('stale');
    els.liveIndicator.querySelector('.live-label').textContent = 'STALE';
  } else {
    els.liveIndicator.classList.remove('stale');
    els.liveIndicator.querySelector('.live-label').textContent = 'LIVE';
  }
};

/* ===== Chaos buttons ===== */
const chaosButtons = document.querySelectorAll('.chaos-btn');
chaosButtons.forEach((btn) => {
  btn.addEventListener('click', async () => {
    const scenario = btn.dataset.scenario;
    const endpoint = scenario === 'ransomware' ? '/api/chaos/ransomware' : '/api/chaos/integrity-loss';

    chaosButtons.forEach((b) => (b.disabled = true));
    els.chaosResult.hidden = true;
    els.chaosResult.classList.remove('error');

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chaos injection failed');

      els.chaosResult.textContent = `✓ ${data.result.scenario} injected on ${data.result.affected_node} (incident ${data.result.incident_id.slice(0, 8)}). AEGIS reacting…`;
      els.chaosResult.hidden = false;
      sync();
    } catch (err) {
      els.chaosResult.textContent = `✗ ${err.message}`;
      els.chaosResult.classList.add('error');
      els.chaosResult.hidden = false;
    } finally {
      setTimeout(() => chaosButtons.forEach((b) => (b.disabled = false)), 1500);
    }
  });
});

/* ===== Main sync loop ===== */
const sync = async () => {
  try {
    const [stats, nodesData, logsData, incidentsData, situationData, auditData, siemData, topologyData, usageData] = await Promise.all([
      fetchJson('/api/dashboard/stats'),
      fetchJson('/api/dashboard/nodes'),
      fetchJson('/api/dashboard/logs?limit=60'),
      fetchJson('/api/dashboard/incidents?limit=40'),
      fetchJson('/api/dashboard/situation'),
      fetchJson('/api/dashboard/audit?limit=30'),
      fetchJson('/api/dashboard/siem-alerts?limit=15'),
      fetchJson('/api/infrastructure/topology'),
      fetchJson('/api/infrastructure/usage'),
    ]);
    renderStats(stats);
    renderNodes(nodesData.nodes);
    renderLogs(logsData.logs);
    renderIncidents(incidentsData.incidents);
    renderSituation(situationData);
    renderAudit(auditData.audit);
    renderSiemAlerts(siemData.alerts);
    renderTopology(topologyData);
    renderCostStrip(usageData);

    lastSuccessfulSync = Date.now();
    els.lastUpdate.textContent = `last sync ${new Date().toLocaleTimeString('de-DE', { hour12: false })}`;
  } catch (error) {
    if (error.message !== 'Unauthorized') {
      console.error('[dashboard] sync failed', error);
      els.lastUpdate.textContent = `sync failed: ${error.message}`;
    }
  }
  updateLiveIndicator();
};

loadAutopilotStatus();
fetchAiActivity();
sync();
setInterval(sync, POLL_INTERVAL_MS);
setInterval(loadAutopilotStatus, 15000);
setInterval(fetchAiActivity, 2500);
setInterval(updateLiveIndicator, 2000);
setInterval(tickHeartbeatLocal, 200);
startAttackPulse();
