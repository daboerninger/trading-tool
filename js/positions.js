import { db } from './firebase-config.js';
import {
  collection, query, where, onSnapshot, doc,
  updateDoc, addDoc, deleteDoc, serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { showToast, fmt, fmtDate, USER_ID } from './app.js';

let unsubscribe = null;

export function initPositions() {
  renderPositionsShell();
  loadPositions();
}

function renderPositionsShell() {
  const panel = document.getElementById('tab-positions');
  panel.innerHTML = `
    <div class="section-header">
      <span class="section-title">Offene Positionen</span>
      <button class="btn btn-ghost btn-sm" id="btn-refresh-pos">Aktualisieren</button>
    </div>
    <div id="positions-list"></div>

    <!-- Modal: Teilverkauf -->
    <div class="modal-overlay" id="modal-teilverkauf">
      <div class="modal">
        <div class="modal-title">Teilverkauf erfassen</div>
        <div class="field mb-12">
          <label>Anzahl Aktien</label>
          <input type="number" id="tv-shares" placeholder="z.B. 25">
        </div>
        <div class="field mb-12">
          <label>Verkaufskurs (€)</label>
          <input type="number" id="tv-kurs" step="0.01">
        </div>
        <div class="field mb-12">
          <label>Datum</label>
          <input type="date" id="tv-datum">
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="closeTVModal()">Abbrechen</button>
          <button class="btn btn-success" id="btn-tv-save">Speichern</button>
        </div>
      </div>
    </div>

    <!-- Modal: Position schließen -->
    <div class="modal-overlay" id="modal-close-pos">
      <div class="modal">
        <div class="modal-title">Position schließen</div>
        <div class="field mb-12">
          <label>Exit-Kurs (€)</label>
          <input type="number" id="cp-kurs" step="0.01">
        </div>
        <div class="field mb-12">
          <label>Exit-Datum</label>
          <input type="date" id="cp-datum">
        </div>
        <div class="field mb-12">
          <label>Exit-Grund</label>
          <select id="cp-grund">
            <option value="Stopp">Stopp ausgelöst</option>
            <option value="Ziel">Kursziel erreicht</option>
            <option value="Manuell">Manuell geschlossen</option>
            <option value="Trailing">Trailing Stopp</option>
          </select>
        </div>
        <div class="field mb-12">
          <label>Lernpunkt</label>
          <textarea id="cp-lernpunkt" rows="2" placeholder="Was habe ich gelernt?"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="closeCPModal()">Abbrechen</button>
          <button class="btn btn-danger" id="btn-cp-save">Position schließen</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-refresh-pos').addEventListener('click', loadPositions);

  // Close modal on overlay click
  document.getElementById('modal-teilverkauf').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('modal-teilverkauf');
  });
  document.getElementById('modal-close-pos').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('modal-close-pos');
  });

  // Make modal closers globally accessible for inline onclick
  window.closeTVModal = () => closeModal('modal-teilverkauf');
  window.closeCPModal = () => closeModal('modal-close-pos');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function loadPositions() {
  if (unsubscribe) unsubscribe();

  const q = query(
    collection(db, 'positions'),
    where('userId', '==', USER_ID),
    where('status', '==', 'open')
  );

  const list = document.getElementById('positions-list');
  list.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-size:13px">Lade...</div>';

  unsubscribe = onSnapshot(q, snap => {
    if (snap.empty) {
      list.innerHTML = `
        <div class="empty-state">
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          <p>Keine offenen Positionen</p>
        </div>
      `;
      return;
    }

    const positions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.innerHTML = positions.map(p => renderPositionCard(p)).join('');
    bindPositionEvents(positions);
  }, err => {
    list.innerHTML = `<div class="empty-state"><p>Fehler: ${err.message}</p></div>`;
  });
}

function renderPositionCard(p) {
  const entry = p.entry || 0;
  const stopp = p.stopp_aktuell || p.stopp_hard || 0;
  const riskPerShare = entry - (p.stopp_hard || 0);

  function stoppPill(val, label, cssClass) {
    const isCurrent = Math.abs(val - (p.stopp_aktuell || 0)) < 0.0001;
    const cls = isCurrent ? 'current' : (cssClass || '');
    return `<div class="stopp-pill ${cls}">${label}: ${fmt(val)} €</div>`;
  }

  const teilverkäufe = p.teilverkäufe || [];
  const tvHtml = teilverkäufe.length > 0
    ? `<div class="text-muted mt-8">Teilverkäufe: ${teilverkäufe.map(tv =>
        `${tv.shares} × ${fmt(tv.kurs)} € (${tv.datum || ''})`).join(', ')}</div>`
    : '';

  return `
    <div class="position-card" data-id="${p.id}">
      <div class="position-header">
        <div>
          <div class="position-ticker">${p.ticker}</div>
          <div class="position-meta">
            <span>Kauf: ${fmtDate(p.kaufdatum)}</span>
            <span>Entry: ${fmt(entry)} €</span>
            <span>${p.aktien} Aktien</span>
            <span>Risk: ${p.risk_pct}%</span>
            ${p.setup_grad ? `<span class="badge badge-blue">${p.setup_grad}</span>` : ''}
            ${p.theme ? `<span class="badge badge-gray">${p.theme}</span>` : ''}
            ${p.fomo ? `<span class="badge badge-amber">FOMO</span>` : ''}
          </div>
        </div>
        <div class="text-mono" style="font-size:12px;color:var(--text-muted)">
          1R: ${fmt(p.oneR)} €
        </div>
      </div>

      <div class="stopp-row">
        ${stoppPill(p.stopp_hard, 'Hard −1R', 'hard')}
        ${stoppPill(p.stopp_066r, '−0.66R', '')}
        ${stoppPill(p.stopp_033r, '−0.33R', '')}
        ${stoppPill(p.stopp_breakeven, 'BE +0.25R', 'breakeven')}
      </div>

      ${tvHtml}

      <!-- Aktueller Stopp -->
      <div class="stopp-aktuell-row">
        <span class="stopp-aktuell-label">Aktueller Stopp:</span>
        <span class="stopp-aktuell-val">${fmt(p.stopp_aktuell || p.stopp_hard)} €</span>
      </div>

      <!-- Stopp nachziehen -->
      <div class="trailing-section">
        <input type="number" class="trailing-input" placeholder="Aktueller Kurs..." step="0.01"
          style="width:180px" data-id="${p.id}">
        <button class="btn btn-ghost btn-sm btn-calc-trailing" data-id="${p.id}">Nachziehen</button>
      </div>
      <div class="trailing-result" id="trailing-${p.id}"></div>

      <div class="position-actions">
        <button class="btn btn-ghost btn-sm btn-teilverkauf" data-id="${p.id}">Teilverkauf</button>
        <button class="btn btn-danger btn-sm btn-close-pos" data-id="${p.id}" data-entry="${entry}" data-shares="${p.aktien}" data-one-r="${p.oneR}" data-stopp="${p.stopp_hard}">Schließen</button>
      </div>
    </div>
  `;
}

function bindPositionEvents(positions) {
  // Stopp nachziehen
  document.querySelectorAll('.btn-calc-trailing').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const input = document.querySelector(`.trailing-input[data-id="${id}"]`);
      const kurs = parseFloat(input.value);
      if (!kurs) return showToast('Aktuellen Kurs eingeben', 'error');

      const newStopp = parseFloat((kurs * 0.9975).toFixed(4));
      const container = document.getElementById(`trailing-${id}`);

      container.innerHTML = `
        <div class="trailing-opt" data-id="${id}" data-val="${newStopp}">
          Neuer Stopp (−0.25%): ${fmt(newStopp)} €
        </div>
      `;

      container.querySelector('.trailing-opt').addEventListener('click', async () => {
        try {
          await updateDoc(doc(db, 'positions', id), { stopp_aktuell: newStopp });
          showToast('Stopp aktualisiert: ' + fmt(newStopp) + ' €', 'success');
          container.innerHTML = '';
          input.value = '';
        } catch (e) {
          showToast('Fehler: ' + e.message, 'error');
        }
      });
    });
  });

  // Teilverkauf Modal
  document.querySelectorAll('.btn-teilverkauf').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const modal = document.getElementById('modal-teilverkauf');
      modal.classList.add('open');
      document.getElementById('tv-datum').value = new Date().toISOString().split('T')[0];

      document.getElementById('btn-tv-save').onclick = async () => {
        const shares = parseInt(document.getElementById('tv-shares').value);
        const kurs = parseFloat(document.getElementById('tv-kurs').value);
        const datum = document.getElementById('tv-datum').value;

        if (!shares || !kurs) return showToast('Shares und Kurs eingeben', 'error');

        const pos = positions.find(p => p.id === id);
        const tvArr = [...(pos?.teilverkäufe || []), { shares, kurs, datum }];
        const remaining = (pos?.aktien || 0) - tvArr.reduce((s, t) => s + t.shares, 0);

        try {
          await updateDoc(doc(db, 'positions', id), {
            teilverkäufe: tvArr,
            aktien: remaining > 0 ? remaining : 0
          });
          if (remaining <= 0) {
            await updateDoc(doc(db, 'positions', id), { status: 'closed_partial' });
          }
          showToast('Teilverkauf gespeichert', 'success');
          closeModal('modal-teilverkauf');
        } catch (e) {
          showToast('Fehler: ' + e.message, 'error');
        }
      };
    });
  });

  // Position schließen Modal
  document.querySelectorAll('.btn-close-pos').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const modal = document.getElementById('modal-close-pos');
      modal.classList.add('open');
      document.getElementById('cp-datum').value = new Date().toISOString().split('T')[0];

      document.getElementById('btn-cp-save').onclick = async () => {
        const exitKurs = parseFloat(document.getElementById('cp-kurs').value);
        const exitDatum = document.getElementById('cp-datum').value;
        const exitGrund = document.getElementById('cp-grund').value;
        const lernpunkt = document.getElementById('cp-lernpunkt').value;

        if (!exitKurs) return showToast('Exit-Kurs eingeben', 'error');

        const pos = positions.find(p => p.id === id);
        if (!pos) return;

        const entry = pos.entry || 0;
        const shares = pos.aktien || 0;
        const oneR = pos.oneR || 0;
        const stoppHard = pos.stopp_hard || 0;
        const riskEur = pos.risk_eur || 0;
        const pnlAbs = (exitKurs - entry) * shares;
        const riskPerShare = oneR > 0 ? oneR - entry : (entry - stoppHard);
        const pnlR = riskPerShare > 0 ? pnlAbs / (riskPerShare * shares) : 0;

        const kaufdatum = pos.kaufdatum?.toDate ? pos.kaufdatum.toDate() : new Date();
        const exitDate = new Date(exitDatum);
        const haltedauer = Math.round((exitDate - kaufdatum) / 86400000);

        const tradeData = {
          ...pos,
          exit_datum: exitDatum,
          exit_kurs: exitKurs,
          exit_grund: exitGrund,
          pnl_abs: parseFloat(pnlAbs.toFixed(2)),
          pnl_r: parseFloat(pnlR.toFixed(3)),
          haltedauer,
          lernpunkt,
          status: 'closed',
          closed_at: serverTimestamp()
        };
        delete tradeData.id;

        try {
          const batch = writeBatch(db);
          const tradeRef = doc(collection(db, 'trades'));
          batch.set(tradeRef, tradeData);
          batch.delete(doc(db, 'positions', id));
          await batch.commit();
          showToast(`${pos.ticker} geschlossen — ${pnlR >= 0 ? '+' : ''}${fmt(pnlR, 2)}R`, pnlR >= 0 ? 'success' : 'error');
          closeModal('modal-close-pos');
        } catch (e) {
          showToast('Fehler: ' + e.message, 'error');
        }
      };
    });
  });
}
