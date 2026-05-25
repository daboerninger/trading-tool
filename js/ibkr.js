import { calcState } from './calculator.js';
import { showToast } from './app.js';

export function initIBKR() {
  renderIBKR();
  bindIBKREvents();
}

function renderIBKR() {
  const panel = document.getElementById('tab-ibkr');
  panel.innerHTML = `
    <div class="section-header">
      <span class="section-title">IBKR Deep Link Generator</span>
      <button class="btn btn-ghost btn-sm" id="btn-load-calc">Rechner-Werte laden</button>
    </div>

    <div class="ibkr-layout">
      <!-- Kauf-Order -->
      <div class="card">
        <div class="card-title">Kauf-Order (Limit)</div>
        <div class="field mb-12">
          <label>Ticker / Symbol</label>
          <input type="text" id="ibkr-ticker" placeholder="AAPL" style="text-transform:uppercase">
        </div>
        <div class="grid-2 mb-12">
          <div class="field">
            <label>Anzahl Aktien</label>
            <input type="number" id="ibkr-shares" placeholder="100">
          </div>
          <div class="field">
            <label>Limit-Kurs (€/USD)</label>
            <input type="number" id="ibkr-limit" placeholder="100.00" step="0.01">
          </div>
        </div>
        <div class="grid-2 mb-12">
          <div class="field">
            <label>Währung</label>
            <select id="ibkr-currency">
              <option value="USD" selected>USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div class="field">
            <label>Börse</label>
            <select id="ibkr-exchange">
              <option value="SMART" selected>SMART</option>
              <option value="NASDAQ">NASDAQ</option>
              <option value="NYSE">NYSE</option>
              <option value="XETRA">XETRA</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary w-full" id="btn-gen-buy">Deep Link generieren</button>
        <div class="deep-link-box" id="dl-buy">—</div>
        <button class="btn btn-ghost btn-sm" id="btn-copy-buy" style="margin-top:4px">Kopieren</button>
      </div>

      <!-- Stopp-Order -->
      <div class="card">
        <div class="card-title">Stopp-Order (Stop Loss)</div>
        <div class="field mb-12">
          <label>Ticker / Symbol</label>
          <input type="text" id="ibkr-ticker-s" placeholder="AAPL" style="text-transform:uppercase">
        </div>
        <div class="grid-2 mb-12">
          <div class="field">
            <label>Anzahl Aktien</label>
            <input type="number" id="ibkr-shares-s" placeholder="100">
          </div>
          <div class="field">
            <label>Stopp-Kurs (€/USD)</label>
            <input type="number" id="ibkr-stopp" placeholder="95.00" step="0.01">
          </div>
        </div>
        <div class="grid-2 mb-12">
          <div class="field">
            <label>Währung</label>
            <select id="ibkr-currency-s">
              <option value="USD" selected>USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div class="field">
            <label>Börse</label>
            <select id="ibkr-exchange-s">
              <option value="SMART" selected>SMART</option>
              <option value="NASDAQ">NASDAQ</option>
              <option value="NYSE">NYSE</option>
              <option value="XETRA">XETRA</option>
            </select>
          </div>
        </div>
        <button class="btn btn-danger w-full" id="btn-gen-stopp">Deep Link generieren</button>
        <div class="deep-link-box" id="dl-stopp">—</div>
        <button class="btn btn-ghost btn-sm" id="btn-copy-stopp" style="margin-top:4px">Kopieren</button>
      </div>
    </div>

    <div class="card mt-16">
      <div class="card-title">Anleitung IBKR Deep Links</div>
      <div style="font-size:13px;color:var(--text-muted);line-height:1.8">
        <p>IBKR Deep Links öffnen die IBKR Mobile App direkt im Order-Dialog mit vorausgefüllten Werten.</p>
        <p style="margin-top:8px"><strong style="color:var(--text)">Format:</strong> <code style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent)">ibkr://trade?...</code></p>
        <p style="margin-top:8px">Tippe den Link auf dem Smartphone an, oder öffne ihn über "Link öffnen" im Browser.</p>
        <p style="margin-top:4px;font-size:11px;color:var(--text-muted)">Hinweis: Die genaue URL-Struktur kann je nach IBKR App Version variieren. Teste Links vor dem Echtbetrieb.</p>
      </div>
    </div>
  `;
}

function bindIBKREvents() {
  document.getElementById('btn-load-calc').addEventListener('click', () => {
    const { ticker, shares, limit, stopp } = calcState;
    if (!ticker && !shares) {
      showToast('Rechner zuerst ausfüllen', 'error');
      return;
    }
    if (ticker) {
      document.getElementById('ibkr-ticker').value = ticker;
      document.getElementById('ibkr-ticker-s').value = ticker;
    }
    if (shares) {
      document.getElementById('ibkr-shares').value = shares;
      document.getElementById('ibkr-shares-s').value = shares;
    }
    if (limit) {
      document.getElementById('ibkr-limit').value = limit.toFixed(2);
    }
    if (stopp) {
      document.getElementById('ibkr-stopp').value = stopp.toFixed(2);
    }
    showToast('Rechner-Werte geladen', 'success');
  });

  document.getElementById('btn-gen-buy').addEventListener('click', () => {
    const ticker = document.getElementById('ibkr-ticker').value.toUpperCase();
    const shares = document.getElementById('ibkr-shares').value;
    const limit = document.getElementById('ibkr-limit').value;
    const currency = document.getElementById('ibkr-currency').value;
    const exchange = document.getElementById('ibkr-exchange').value;

    if (!ticker || !shares || !limit) {
      showToast('Ticker, Anzahl und Limit erforderlich', 'error');
      return;
    }

    const url = buildDeepLink({
      action: 'BUY',
      orderType: 'LMT',
      ticker,
      shares,
      price: limit,
      currency,
      exchange
    });

    document.getElementById('dl-buy').textContent = url;
  });

  document.getElementById('btn-gen-stopp').addEventListener('click', () => {
    const ticker = document.getElementById('ibkr-ticker-s').value.toUpperCase();
    const shares = document.getElementById('ibkr-shares-s').value;
    const stopp = document.getElementById('ibkr-stopp').value;
    const currency = document.getElementById('ibkr-currency-s').value;
    const exchange = document.getElementById('ibkr-exchange-s').value;

    if (!ticker || !shares || !stopp) {
      showToast('Ticker, Anzahl und Stopp erforderlich', 'error');
      return;
    }

    const url = buildDeepLink({
      action: 'SELL',
      orderType: 'STP',
      ticker,
      shares,
      price: stopp,
      currency,
      exchange
    });

    document.getElementById('dl-stopp').textContent = url;
  });

  document.getElementById('btn-copy-buy').addEventListener('click', () => {
    const url = document.getElementById('dl-buy').textContent;
    if (url && url !== '—') {
      navigator.clipboard.writeText(url).then(() => showToast('Kopiert', 'success'));
    }
  });

  document.getElementById('btn-copy-stopp').addEventListener('click', () => {
    const url = document.getElementById('dl-stopp').textContent;
    if (url && url !== '—') {
      navigator.clipboard.writeText(url).then(() => showToast('Kopiert', 'success'));
    }
  });

  // Auto-uppercase ticker inputs
  ['ibkr-ticker', 'ibkr-ticker-s'].forEach(id => {
    document.getElementById(id).addEventListener('input', e => {
      e.target.value = e.target.value.toUpperCase();
    });
  });
}

function buildDeepLink({ action, orderType, ticker, shares, price, currency, exchange }) {
  const params = new URLSearchParams({
    action,
    orderType,
    symbol: ticker,
    quantity: shares,
    price,
    currency,
    exchange,
    tif: 'DAY'
  });

  return `ibkr://trade?${params.toString()}`;
}
