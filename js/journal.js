import { db } from './firebase-config.js';
import {
  collection, query, where, getDocs, doc, updateDoc, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { showToast, fmt, fmtDate, USER_ID } from './app.js';

export function initJournal() {
  renderJournalShell();
  loadTrades();
}

function renderJournalShell() {
  const panel = document.getElementById('tab-journal');
  panel.innerHTML = `
    <div class="section-header">
      <span class="section-title">Journal</span>
    </div>

    <div class="sub-tab-nav">
      <button class="sub-tab-btn active" data-sub="trades">Triggered Trades</button>
      <button class="sub-tab-btn" data-sub="passes">Pass-Einträge</button>
    </div>

    <div id="journal-sub-trades" class="journal-sub active"></div>
    <div id="journal-sub-passes" class="journal-sub" style="display:none"></div>
  `;

  document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sub = btn.dataset.sub;
      document.querySelectorAll('.journal-sub').forEach(s => s.style.display = 'none');
      document.getElementById(`journal-sub-${sub}`).style.display = 'block';
      if (sub === 'passes') loadPasses();
      else loadTrades();
    });
  });
}

async function loadTrades() {
  const container = document.getElementById('journal-sub-trades');
  container.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-size:13px">Lade...</div>';

  try {
    const q = query(
      collection(db, 'trades'),
      where('userId', '==', USER_ID),
      orderBy('closed_at', 'desc')
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = emptyState('Noch keine abgeschlossenen Trades');
      return;
    }

    const trades = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    container.innerHTML = `
      <div class="section-header mb-12">
        <span class="text-muted">${trades.length} Trades</span>
        <button class="btn btn-ghost btn-sm" id="btn-export-trades">CSV Export</button>
      </div>
      <div class="card journal-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Kauf</th>
              <th>Exit</th>
              <th>Haltedauer</th>
              <th>Entry</th>
              <th>Exit-Kurs</th>
              <th>Aktien</th>
              <th>P&L (€)</th>
              <th>P&L (R)</th>
              <th>Grund</th>
              <th>Setup</th>
              <th>Lernpunkt</th>
            </tr>
          </thead>
          <tbody>
            ${trades.map(t => tradeRow(t)).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('btn-export-trades').addEventListener('click', () => exportCSV(trades, 'trades'));
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>Fehler: ${e.message}</p></div>`;
  }
}

function tradeRow(t) {
  const pnlClass = (t.pnl_r || 0) >= 0 ? 'badge-green' : 'badge-red';
  const pnlSign = (t.pnl_r || 0) >= 0 ? '+' : '';

  return `
    <tr>
      <td><strong class="text-mono">${t.ticker}</strong></td>
      <td>${fmtDate(t.kaufdatum)}</td>
      <td>${t.exit_datum || '—'}</td>
      <td class="text-muted">${t.haltedauer != null ? t.haltedauer + 'd' : '—'}</td>
      <td class="mono">${fmt(t.entry)} €</td>
      <td class="mono">${fmt(t.exit_kurs)} €</td>
      <td class="mono">${t.aktien}</td>
      <td class="mono" style="color:${(t.pnl_abs||0)>=0?'var(--green)':'var(--red)'}">
        ${(t.pnl_abs||0)>=0?'+':''}${fmt(t.pnl_abs)} €
      </td>
      <td><span class="badge ${pnlClass}">${pnlSign}${fmt(t.pnl_r, 2)}R</span></td>
      <td><span class="badge badge-gray">${t.exit_grund || '—'}</span></td>
      <td><span class="badge badge-blue">${t.setup_grad || '—'}</span></td>
      <td style="color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
          title="${t.lernpunkt || ''}">${t.lernpunkt || '—'}</td>
    </tr>
  `;
}

async function loadPasses() {
  const container = document.getElementById('journal-sub-passes');
  container.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-size:13px">Lade...</div>';

  try {
    const q = query(
      collection(db, 'passes'),
      where('userId', '==', USER_ID),
      orderBy('datum', 'desc')
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = emptyState('Noch keine Pass-Einträge');
      return;
    }

    const passes = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    container.innerHTML = `
      <div class="section-header mb-12">
        <span class="text-muted">${passes.length} Einträge</span>
        <button class="btn btn-ghost btn-sm" id="btn-export-passes">CSV Export</button>
      </div>
      <div class="card journal-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Datum</th>
              <th>Geplanter Entry</th>
              <th>Grund</th>
              <th>FOMO</th>
              <th>Notiz</th>
              <th>+5T Follow-up</th>
              <th>+10T Follow-up</th>
              <th>Richtig?</th>
            </tr>
          </thead>
          <tbody>
            ${passes.map(p => passRow(p)).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.querySelectorAll('.pass-followup').forEach(input => {
      input.addEventListener('change', async e => {
        const id = e.target.dataset.id;
        const field = e.target.dataset.field;
        try {
          await updateDoc(doc(db, 'passes', id), { [field]: e.target.value });
          showToast('Gespeichert', 'success');
        } catch (err) {
          showToast('Fehler: ' + err.message, 'error');
        }
      });
    });

    document.querySelectorAll('.pass-decision').forEach(sel => {
      sel.addEventListener('change', async e => {
        const id = e.target.dataset.id;
        const val = e.target.value === 'true' ? true : e.target.value === 'false' ? false : null;
        try {
          await updateDoc(doc(db, 'passes', id), { entscheidung_richtig: val });
          showToast('Gespeichert', 'success');
        } catch (err) {
          showToast('Fehler: ' + err.message, 'error');
        }
      });
    });

    document.getElementById('btn-export-passes').addEventListener('click', () => exportCSV(passes, 'passes'));
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>Fehler: ${e.message}</p></div>`;
  }
}

function passRow(p) {
  const decisionVal = p.entscheidung_richtig === true ? 'true'
    : p.entscheidung_richtig === false ? 'false' : '';

  return `
    <tr>
      <td><strong class="text-mono">${p.ticker}</strong></td>
      <td>${fmtDate(p.datum)}</td>
      <td class="mono">${p.geplanter_entry ? fmt(p.geplanter_entry) + ' €' : '—'}</td>
      <td style="color:var(--text-muted)">${p.grund || '—'}</td>
      <td>${p.fomo ? '<span class="badge badge-amber">FOMO</span>' : '<span class="badge badge-gray">Nein</span>'}</td>
      <td style="color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.notiz || '—'}</td>
      <td>
        <input type="text" class="pass-followup" data-id="${p.id}" data-field="followup_5t"
          value="${p.followup_5t || ''}" placeholder="Was passierte..."
          style="font-size:11px;padding:4px 7px;min-width:120px">
      </td>
      <td>
        <input type="text" class="pass-followup" data-id="${p.id}" data-field="followup_10t"
          value="${p.followup_10t || ''}" placeholder="Was passierte..."
          style="font-size:11px;padding:4px 7px;min-width:120px">
      </td>
      <td>
        <select class="pass-decision" data-id="${p.id}" style="font-size:11px;padding:4px 7px">
          <option value="">—</option>
          <option value="true" ${decisionVal === 'true' ? 'selected' : ''}>Ja</option>
          <option value="false" ${decisionVal === 'false' ? 'selected' : ''}>Nein</option>
        </select>
      </td>
    </tr>
  `;
}

function emptyState(msg) {
  return `
    <div class="empty-state">
      <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
      </svg>
      <p>${msg}</p>
    </div>
  `;
}

function exportCSV(data, type) {
  let headers, rows;

  if (type === 'trades') {
    headers = ['Ticker','Kaufdatum','Exit-Datum','Haltedauer','Entry','Exit-Kurs','Aktien','P&L EUR','P&L R','Grund','Setup','Lernpunkt'];
    rows = data.map(t => [
      t.ticker,
      fmtDate(t.kaufdatum),
      t.exit_datum || '',
      t.haltedauer != null ? t.haltedauer : '',
      t.entry?.toFixed(2) || '',
      t.exit_kurs?.toFixed(2) || '',
      t.aktien || '',
      t.pnl_abs?.toFixed(2) || '',
      t.pnl_r?.toFixed(3) || '',
      t.exit_grund || '',
      t.setup_grad || '',
      (t.lernpunkt || '').replace(/"/g, '""')
    ]);
  } else {
    headers = ['Ticker','Datum','Geplanter Entry','Grund','FOMO','Notiz','+5T','+10T','Richtig'];
    rows = data.map(p => [
      p.ticker,
      fmtDate(p.datum),
      p.geplanter_entry?.toFixed(2) || '',
      p.grund || '',
      p.fomo ? 'Ja' : 'Nein',
      (p.notiz || '').replace(/"/g, '""'),
      (p.followup_5t || '').replace(/"/g, '""'),
      (p.followup_10t || '').replace(/"/g, '""'),
      p.entscheidung_richtig === true ? 'Ja' : p.entscheidung_richtig === false ? 'Nein' : ''
    ]);
  }

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${v}"`).join(';'))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
