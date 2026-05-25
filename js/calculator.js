import { db } from './firebase-config.js';
import {
  collection, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { showToast, fmt, USER_ID } from './app.js';

// ── State ─────────────────────────────────────────────────────────────────────
export const calcState = {
  ticker: '',
  depot: 0,
  riskStufe: 0.5,
  entry: 0,
  limitPuffer: 0.1,
  lod: 0,
  stoppPuffer: 0.08,
  atr: 0,
  edgeCount: 0,
  edgeMulti: 1,
  // computed
  limit: 0,
  stopp: 0,
  riskPerShare: 0,
  shares: 0,
  posSize: 0,
  riskEur: 0,
  oneR: 0,
  fomo: false
};

export function initCalculator() {
  renderCalc();
  bindCalcEvents();
}

function renderCalc() {
  const panel = document.getElementById('tab-calc');
  panel.innerHTML = `
    <div class="calc-layout">
      <!-- Left: Inputs -->
      <div>
        <!-- Basis -->
        <div class="card calc-section">
          <div class="card-title">Basis</div>
          <div class="grid-3">
            <div class="field">
              <label>Ticker</label>
              <input type="text" id="c-ticker" placeholder="AAPL" style="text-transform:uppercase">
            </div>
            <div class="field">
              <label>Depot (€)</label>
              <input type="number" id="c-depot" placeholder="50000">
            </div>
            <div class="field">
              <label>Risk-Stufe</label>
              <select id="c-risk">
                <option value="0.25">0.25%</option>
                <option value="0.5" selected>0.50%</option>
                <option value="0.75">0.75%</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Entry & Limit -->
        <div class="card calc-section">
          <div class="card-title">Entry & Limit</div>
          <div class="grid-3">
            <div class="field">
              <label>Entry-Kurs (€)</label>
              <input type="number" id="c-entry" placeholder="100.00" step="0.01">
            </div>
            <div class="field">
              <label>Limit-Puffer (%)</label>
              <input type="number" id="c-limit-puffer" value="0.10" step="0.01">
            </div>
            <div class="field">
              <label>Limit (auto)</label>
              <input type="number" id="c-limit" readonly>
            </div>
          </div>
        </div>

        <!-- Stopp -->
        <div class="card calc-section">
          <div class="card-title">Stopp (Low of Day)</div>
          <div class="grid-3">
            <div class="field">
              <label>Low of Day (€)</label>
              <input type="number" id="c-lod" placeholder="97.50" step="0.01">
            </div>
            <div class="field">
              <label>Stopp-Puffer (%)</label>
              <input type="number" id="c-stopp-puffer" value="0.08" step="0.01">
            </div>
            <div class="field">
              <label>Stopp (auto)</label>
              <input type="number" id="c-stopp" readonly>
            </div>
          </div>
          <div class="grid-2 mt-12">
            <div class="field">
              <label>ATR% (optional)</label>
              <input type="number" id="c-atr" placeholder="2.5" step="0.1">
            </div>
          </div>
        </div>

        <!-- Edge Count -->
        <div class="card calc-section">
          <div class="card-title">Edge Count (8 Kriterien)</div>
          <div class="edge-grid" id="edge-grid"></div>
          <div class="flex items-center gap-8">
            <span class="text-muted">Edge Count: <strong id="edge-display">0</strong> / 8</span>
            <span class="text-muted" style="margin-left:16px">Multiplikator:</span>
            <select id="c-edge-multi" style="width:auto">
              <option value="0.5">50% (Probier)</option>
              <option value="1" selected>100% (Standard)</option>
              <option value="1.25">125% (High-Conv.)</option>
            </select>
          </div>
        </div>

        <!-- Setup Details -->
        <div class="card calc-section">
          <div class="card-title">Setup Details</div>
          <div class="grid-3">
            <div class="field">
              <label>Setup-Grad</label>
              <select id="c-setup">
                <option value="A">A — Top Setup</option>
                <option value="B" selected>B — Standard</option>
                <option value="C">C — Spekulativ</option>
              </select>
            </div>
            <div class="field">
              <label>Theme</label>
              <input type="text" id="c-theme" placeholder="z.B. AI, Energy...">
            </div>
            <div class="field">
              <label>FOMO?</label>
              <select id="c-fomo">
                <option value="false" selected>Nein</option>
                <option value="true">Ja</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Result -->
      <div class="result-panel" id="result-panel">
        <div class="card-title">Ergebnis</div>

        <div class="result-row">
          <span class="result-label">Limit-Kurs</span>
          <span class="result-value accent" id="r-limit">—</span>
        </div>
        <div class="result-row">
          <span class="result-label">Stopp-Kurs</span>
          <span class="result-value red" id="r-stopp">—</span>
        </div>
        <div class="result-row">
          <span class="result-label">Risk / Aktie</span>
          <span class="result-value" id="r-rps">—</span>
        </div>
        <div class="result-row">
          <span class="result-label">Anzahl Aktien</span>
          <span class="result-value big accent" id="r-shares">—</span>
        </div>
        <div class="result-row">
          <span class="result-label">Positionsgröße</span>
          <span class="result-value" id="r-possize">—</span>
        </div>
        <div class="result-row">
          <span class="result-label">Risk (€)</span>
          <span class="result-value amber" id="r-riskeur">—</span>
        </div>
        <div class="result-row">
          <span class="result-label">1R Ziel (+2R)</span>
          <span class="result-value green" id="r-1r">—</span>
        </div>
        <div class="result-row">
          <span class="result-label">2R Ziel</span>
          <span class="result-value green" id="r-2r">—</span>
        </div>
        <div class="result-row">
          <span class="result-label">3R Ziel</span>
          <span class="result-value green" id="r-3r">—</span>
        </div>

        <hr class="divider">

        <div class="card-title">Checks</div>
        <div class="checks-list" id="checks-list"></div>

        <div class="btn-row">
          <button class="btn btn-primary" id="btn-trade">Trade erfassen</button>
          <button class="btn btn-ghost" id="btn-pass">Passed Trade</button>
        </div>
      </div>
    </div>
  `;

  renderEdgeGrid();
}

const EDGE_CRITERIA = [
  'Relative Stärke zum Index',
  'Volumen > Ø (Breakout)',
  'Saubere Basis / Konsolidierung',
  'Sektor-Stärke',
  'Nearterm Catalyst',
  'Markt-Uptrend (IBD)',
  'Ordentlicher Chart (no gaps)',
  'Stage 2 Uptrend',
];

function renderEdgeGrid() {
  const grid = document.getElementById('edge-grid');
  grid.innerHTML = EDGE_CRITERIA.map((c, i) => `
    <label class="edge-check" data-idx="${i}">
      <input type="checkbox" data-idx="${i}">
      <div class="check-box">
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span>${c}</span>
    </label>
  `).join('');
}

function bindCalcEvents() {
  // Inputs that trigger recalc
  const ids = ['c-depot','c-risk','c-entry','c-limit-puffer','c-lod','c-stopp-puffer','c-atr','c-edge-multi'];
  ids.forEach(id => {
    document.getElementById(id)?.addEventListener('input', recalc);
  });

  document.getElementById('c-ticker').addEventListener('input', e => {
    calcState.ticker = e.target.value.toUpperCase();
    e.target.value = calcState.ticker;
  });

  // Edge checkboxes
  document.getElementById('edge-grid').addEventListener('change', e => {
    if (e.target.type === 'checkbox') {
      const label = e.target.closest('.edge-check');
      label.classList.toggle('checked', e.target.checked);
      const count = document.querySelectorAll('#edge-grid input:checked').length;
      document.getElementById('edge-display').textContent = count;
      calcState.edgeCount = count;
      recalc();
    }
  });

  // Buttons
  document.getElementById('btn-trade').addEventListener('click', saveTrade);
  document.getElementById('btn-pass').addEventListener('click', savePass);
}

function recalc() {
  const depot = parseFloat(document.getElementById('c-depot').value) || 0;
  const riskStufe = parseFloat(document.getElementById('c-risk').value) || 0.5;
  const entry = parseFloat(document.getElementById('c-entry').value) || 0;
  const limitPuffer = parseFloat(document.getElementById('c-limit-puffer').value) || 0.1;
  const lod = parseFloat(document.getElementById('c-lod').value) || 0;
  const stoppPuffer = parseFloat(document.getElementById('c-stopp-puffer').value) || 0.08;
  const atr = parseFloat(document.getElementById('c-atr').value) || 0;
  const edgeMulti = parseFloat(document.getElementById('c-edge-multi').value) || 1;
  const edgeCount = calcState.edgeCount;

  // Auto-calculations
  const limit = entry > 0 ? entry * (1 + limitPuffer / 100) : 0;
  const stopp = lod > 0 ? lod * (1 - stoppPuffer / 100) : 0;
  const riskEurBase = depot * (riskStufe / 100);
  const riskEur = riskEurBase * edgeMulti;
  const riskPerShare = limit > 0 && stopp > 0 ? limit - stopp : 0;
  const shares = riskPerShare > 0 ? Math.round(riskEur / riskPerShare) : 0;
  const posSize = shares * limit;
  const oneR = limit > 0 && riskPerShare > 0 ? limit + riskPerShare : 0;
  const twoR = limit > 0 && riskPerShare > 0 ? limit + 2 * riskPerShare : 0;
  const threeR = limit > 0 && riskPerShare > 0 ? limit + 3 * riskPerShare : 0;

  // Update auto-fill inputs
  if (entry > 0 && limitPuffer > 0)
    document.getElementById('c-limit').value = limit.toFixed(2);
  if (lod > 0 && stoppPuffer > 0)
    document.getElementById('c-stopp').value = stopp.toFixed(2);

  // Store state
  Object.assign(calcState, {
    depot, riskStufe, entry, limitPuffer, lod, stoppPuffer, atr, edgeMulti,
    limit, stopp, riskPerShare, shares, posSize, riskEur, oneR,
    ticker: document.getElementById('c-ticker').value.toUpperCase(),
    fomo: document.getElementById('c-fomo')?.value === 'true'
  });

  // Update result display
  document.getElementById('r-limit').textContent = limit > 0 ? fmt(limit) + ' €' : '—';
  document.getElementById('r-stopp').textContent = stopp > 0 ? fmt(stopp) + ' €' : '—';
  document.getElementById('r-rps').textContent = riskPerShare > 0 ? fmt(riskPerShare) + ' €' : '—';
  document.getElementById('r-shares').textContent = shares > 0 ? shares.toString() : '—';
  document.getElementById('r-possize').textContent = posSize > 0 ? fmt(posSize) + ' €' : '—';
  document.getElementById('r-riskeur').textContent = riskEur > 0 ? fmt(riskEur) + ' €' : '—';
  document.getElementById('r-1r').textContent = oneR > 0 ? fmt(oneR) + ' €' : '—';
  document.getElementById('r-2r').textContent = twoR > 0 ? fmt(twoR) + ' €' : '—';
  document.getElementById('r-3r').textContent = threeR > 0 ? fmt(threeR) + ' €' : '—';

  renderChecks({ depot, riskStufe, entry, lod, stopp, limit, shares, posSize, riskEur, edgeCount, atr, riskPerShare });
}

function renderChecks({ depot, riskStufe, entry, lod, stopp, limit, shares, posSize, riskEur, edgeCount, atr, riskPerShare }) {
  const checks = [];

  checks.push({
    pass: entry > 0,
    label: 'Entry-Kurs eingegeben'
  });
  checks.push({
    pass: lod > 0 && stopp > 0,
    label: 'Stopp definiert'
  });
  checks.push({
    pass: stopp > 0 && entry > 0 && stopp < entry,
    warn: stopp > 0 && entry > 0 && stopp >= entry,
    label: 'Stopp < Entry'
  });
  checks.push({
    pass: riskPerShare > 0 && entry > 0 && (riskPerShare / entry) < 0.08,
    warn: riskPerShare > 0 && entry > 0 && (riskPerShare / entry) >= 0.08,
    label: `Risk/Share < 8% des Entry ${riskPerShare > 0 && entry > 0 ? '(' + fmt(riskPerShare / entry * 100, 1) + '%)' : ''}`
  });
  checks.push({
    pass: depot > 0 && posSize > 0 && posSize / depot <= 0.25,
    warn: depot > 0 && posSize > 0 && posSize / depot > 0.25 && posSize / depot <= 0.35,
    label: `Position ≤ 25% des Depots ${posSize > 0 && depot > 0 ? '(' + fmt(posSize / depot * 100, 1) + '%)' : ''}`
  });
  checks.push({
    pass: edgeCount >= 5,
    warn: edgeCount >= 3 && edgeCount < 5,
    label: `Edge Count ≥ 5 (aktuell: ${edgeCount})`
  });
  if (atr > 0) {
    checks.push({
      pass: atr >= 2,
      warn: atr >= 1 && atr < 2,
      label: `ATR% ≥ 2% (aktuell: ${atr}%)`
    });
  }
  checks.push({
    pass: riskStufe <= 0.5,
    warn: riskStufe === 0.75,
    label: `Risk-Stufe angemessen (${riskStufe}%)`
  });

  const html = checks.map(c => {
    const dotClass = c.pass ? 'pass' : c.warn ? 'warn' : 'fail';
    return `
      <div class="check-item">
        <div class="check-dot ${dotClass}"></div>
        <span style="color:${c.pass ? 'var(--green)' : c.warn ? 'var(--amber)' : 'var(--red)'}">${c.label}</span>
      </div>
    `;
  }).join('');

  document.getElementById('checks-list').innerHTML = html;
}

async function saveTrade() {
  const { ticker, limit, stopp, shares, riskEur, riskStufe, oneR, edgeCount, edgeMulti } = calcState;

  if (!ticker) return showToast('Ticker fehlt', 'error');
  if (!(limit > 0)) return showToast('Entry/Limit fehlt', 'error');
  if (!(stopp > 0)) return showToast('Stopp fehlt', 'error');
  if (!(shares > 0)) return showToast('0 Aktien — Depot/Risk prüfen', 'error');

  const riskPerShare = limit - stopp;
  const stopp_066r = parseFloat((stopp + riskPerShare * 0.34).toFixed(4));
  const stopp_033r = parseFloat((stopp + riskPerShare * 0.67).toFixed(4));
  const stopp_breakeven = parseFloat((limit + limit * 0.0025).toFixed(4));

  const data = {
    userId: USER_ID,
    ticker,
    kaufdatum: serverTimestamp(),
    entry: limit,
    aktien: shares,
    stopp_hard: parseFloat(stopp.toFixed(4)),
    stopp_066r,
    stopp_033r,
    stopp_breakeven,
    stopp_aktuell: parseFloat(stopp.toFixed(4)),
    risk_pct: riskStufe,
    risk_eur: parseFloat(riskEur.toFixed(2)),
    edge_count: edgeCount,
    edge_multi: edgeMulti,
    setup_grad: document.getElementById('c-setup').value,
    theme: document.getElementById('c-theme').value,
    fomo: calcState.fomo,
    oneR: parseFloat(oneR.toFixed(4)),
    teilverkäufe: [],
    status: 'open'
  };

  try {
    await addDoc(collection(db, 'positions'), data);
    showToast(`${ticker} als offene Position gespeichert`, 'success');
  } catch (e) {
    showToast('Fehler: ' + e.message, 'error');
  }
}

async function savePass() {
  const ticker = document.getElementById('c-ticker').value.toUpperCase();
  if (!ticker) return showToast('Ticker fehlt', 'error');

  const data = {
    userId: USER_ID,
    ticker,
    datum: serverTimestamp(),
    geplanter_entry: calcState.limit || null,
    grund: '',
    fomo: calcState.fomo,
    notiz: '',
    followup_5t: '',
    followup_10t: '',
    entscheidung_richtig: null
  };

  try {
    await addDoc(collection(db, 'passes'), data);
    showToast(`${ticker} als Passed Trade gespeichert`, 'success');
  } catch (e) {
    showToast('Fehler: ' + e.message, 'error');
  }
}
