import { db } from './firebase-config.js';
import {
  collection, query, where, getDocs, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { fmt, USER_ID } from './app.js';

export function initStats() {
  renderStatsShell();
  loadStats();
}

function renderStatsShell() {
  const panel = document.getElementById('tab-stats');
  panel.innerHTML = `
    <div class="section-header">
      <span class="section-title">Performance Stats</span>
      <button class="btn btn-ghost btn-sm" id="btn-refresh-stats">Aktualisieren</button>
    </div>

    <div class="stats-grid" id="stats-kpis">
      ${['Win Rate','Ø R/R','Ø Haltedauer','Trades gesamt'].map(l => `
        <div class="stat-card">
          <div class="stat-label">${l}</div>
          <div class="stat-value" id="kpi-${l.replace(/[^a-z]/gi,'').toLowerCase()}">—</div>
        </div>
      `).join('')}
    </div>

    <div class="chart-card mb-12">
      <div class="card-title" style="margin-bottom:12px">Equity Curve (kumuliertes R)</div>
      <canvas id="chart-equity"></canvas>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">Risk-Empfehlung (letzte 5 Trades)</div>
        <div id="risk-recommendation" style="padding:8px 0"></div>
      </div>
      <div class="card">
        <div class="card-title">Setup-Analyse</div>
        <div id="setup-analysis" style="padding:8px 0"></div>
      </div>
    </div>
  `;

  document.getElementById('btn-refresh-stats').addEventListener('click', loadStats);
}

async function loadStats() {
  try {
    const q = query(
      collection(db, 'trades'),
      where('userId', '==', USER_ID),
      orderBy('closed_at', 'asc')
    );
    const snap = await getDocs(q);
    const trades = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    computeKPIs(trades);
    renderEquityCurve(trades);
    renderRiskRecommendation(trades);
    renderSetupAnalysis(trades);
  } catch (e) {
    console.error('Stats error:', e);
  }
}

function computeKPIs(trades) {
  const total = trades.length;

  document.getElementById('kpitradesgesamt').textContent = total;

  if (total === 0) return;

  const wins = trades.filter(t => (t.pnl_r || 0) > 0);
  const winRate = (wins.length / total * 100).toFixed(1);

  const avgRR = (trades.reduce((s, t) => s + (t.pnl_r || 0), 0) / total).toFixed(2);
  const avgHold = Math.round(trades.filter(t => t.haltedauer != null).reduce((s, t) => s + t.haltedauer, 0) / total);

  const kpiWinrate = document.getElementById('kpiwinrate');
  kpiWinrate.textContent = winRate + '%';
  kpiWinrate.className = 'stat-value ' + (parseFloat(winRate) >= 50 ? 'green' : 'red');

  const kpiRR = document.getElementById('kpirr');
  kpiRR.textContent = (parseFloat(avgRR) >= 0 ? '+' : '') + avgRR + 'R';
  kpiRR.className = 'stat-value ' + (parseFloat(avgRR) >= 0 ? 'green' : 'red');

  document.getElementById('kpihaltedauer').textContent = isNaN(avgHold) ? '—' : avgHold + 'd';
}

function renderEquityCurve(trades) {
  const canvas = document.getElementById('chart-equity');
  if (!canvas) return;

  if (typeof Chart === 'undefined') {
    canvas.parentElement.innerHTML += '<p class="text-muted" style="padding:8px 0;font-size:12px">Chart.js nicht geladen</p>';
    return;
  }

  // Destroy existing chart
  if (canvas._chartInstance) {
    canvas._chartInstance.destroy();
  }

  let cumR = 0;
  const labels = [];
  const data = [0];

  trades.forEach((t, i) => {
    cumR += (t.pnl_r || 0);
    labels.push(t.ticker || `#${i + 1}`);
    data.push(parseFloat(cumR.toFixed(3)));
  });

  labels.unshift('Start');

  const ctx = canvas.getContext('2d');
  const isPositive = cumR >= 0;

  canvas._chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: isPositive ? '#34D399' : '#F87171',
        backgroundColor: isPositive ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: isPositive ? '#34D399' : '#F87171',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.raw >= 0 ? '+' : ''}${ctx.raw}R`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748B', font: { family: 'DM Mono', size: 10 } },
          grid: { color: '#252A37' }
        },
        y: {
          ticks: {
            color: '#64748B',
            font: { family: 'DM Mono', size: 10 },
            callback: v => `${v >= 0 ? '+' : ''}${v}R`
          },
          grid: { color: '#252A37' }
        }
      }
    }
  });
}

function renderRiskRecommendation(trades) {
  const el = document.getElementById('risk-recommendation');
  const last5 = trades.slice(-5);

  if (last5.length < 3) {
    el.innerHTML = '<p class="text-muted" style="font-size:13px">Mindestens 3 Trades für Empfehlung nötig</p>';
    return;
  }

  const avgR = last5.reduce((s, t) => s + (t.pnl_r || 0), 0) / last5.length;
  const wins = last5.filter(t => (t.pnl_r || 0) > 0).length;
  const winRate = wins / last5.length;

  let rec, color, explanation;

  if (avgR >= 0.5 && winRate >= 0.6) {
    rec = '0.75%';
    color = 'var(--green)';
    explanation = 'Letzte 5 Trades stark — erhöhte Risk-Stufe vertretbar';
  } else if (avgR < -0.3 || winRate < 0.35) {
    rec = '0.25%';
    color = 'var(--red)';
    explanation = 'Schwache Serie — Risk reduzieren';
  } else {
    rec = '0.50%';
    color = 'var(--amber)';
    explanation = 'Neutrale Phase — Standard Risk beibehalten';
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
      <span style="font-family:'DM Mono',monospace;font-size:24px;font-weight:500;color:${color}">${rec}</span>
      <span style="font-size:12px;color:var(--text-muted)">${explanation}</span>
    </div>
    <div style="font-size:11px;color:var(--text-muted)">
      Letzte ${last5.length} Trades: Ø ${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R | ${(winRate*100).toFixed(0)}% Win
    </div>
  `;
}

function renderSetupAnalysis(trades) {
  const el = document.getElementById('setup-analysis');

  if (trades.length === 0) {
    el.innerHTML = '<p class="text-muted" style="font-size:13px">Noch keine Daten</p>';
    return;
  }

  const bySetup = { A: [], B: [], C: [] };
  trades.forEach(t => {
    const g = t.setup_grad;
    if (g && bySetup[g]) bySetup[g].push(t.pnl_r || 0);
  });

  const rows = Object.entries(bySetup).map(([grade, rs]) => {
    if (rs.length === 0) return null;
    const avg = rs.reduce((s, r) => s + r, 0) / rs.length;
    const wins = rs.filter(r => r > 0).length;
    const color = avg >= 0 ? 'var(--green)' : 'var(--red)';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;gap:10px;align-items:center">
          <span class="badge badge-blue">${grade}</span>
          <span style="font-size:12px;color:var(--text-muted)">${rs.length} Trades | ${(wins/rs.length*100).toFixed(0)}% Win</span>
        </div>
        <span style="font-family:'DM Mono',monospace;font-size:13px;color:${color}">
          ${avg >= 0 ? '+' : ''}${avg.toFixed(2)}R
        </span>
      </div>
    `;
  }).filter(Boolean);

  el.innerHTML = rows.length > 0 ? rows.join('') : '<p class="text-muted" style="font-size:13px">Noch keine Setup-Daten</p>';
}
