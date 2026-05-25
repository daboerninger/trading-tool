import { initCalculator } from './calculator.js';
import { initPositions } from './positions.js';
import { initJournal } from './journal.js';
import { initStats } from './stats.js';
import { initIBKR } from './ibkr.js';

// ── Feste User-ID (kein Login nötig) ─────────────────────────────────────────
// Einmalig gesetzt — alle Firestore-Dokumente werden dieser ID zugeordnet.
export const USER_ID = 'dgaubinger';

// ── Tab Routing ───────────────────────────────────────────────────────────────
let initialized = {};

// App sofort starten
document.getElementById('app').classList.add('visible');
bootstrap();

function bootstrap() {
  setupTabs();
  activateTab('calc');
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });
}

function activateTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tabId)
  );
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('active', p.id === `tab-${tabId}`)
  );

  if (!initialized[tabId]) {
    initialized[tabId] = true;
    switch (tabId) {
      case 'calc':      initCalculator(); break;
      case 'positions': initPositions(); break;
      case 'journal':   initJournal(); break;
      case 'stats':     initStats(); break;
      case 'ibkr':      initIBKR(); break;
    }
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
export function openModal(overlayId) {
  document.getElementById(overlayId).classList.add('open');
}

export function closeModal(overlayId) {
  document.getElementById(overlayId).classList.remove('open');
}

// ── Format helpers ────────────────────────────────────────────────────────────
export function fmt(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
