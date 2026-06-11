/* ============================================================
   Gota — Onboarding revamp prototype
   Máquina de estados simple. Sin frameworks, sin datos fake:
   todo lo que se muestra al final sale de lo que cargó el usuario.
   ============================================================ */

'use strict';

/* ---------- Estado ---------- */

const state = {
  currencyMode: null, // 'ARS' | 'USD' | 'BOTH'
  vizCurrency: null,  // 'ARS' | 'USD' — solo si BOTH
  accountName: '',
  accountType: 'bank',
  ars: 0,
  usd: 0,
  skippedSaldo: false,
  simulateError: false,
  errorFiredOnce: false,
};

const TYPE_LABELS = { bank: 'Banco', digital: 'Cuenta digital', cash: 'Efectivo' };

/* ---------- Helpers ---------- */

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const fmtARS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const fmtUSD = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatAmount(value, currency) {
  return currency === 'USD' ? `US$ ${fmtUSD.format(value)}` : `$ ${fmtARS.format(value)}`;
}

function digitsOnly(str) {
  return str.replace(/\D/g, '');
}

/* Moneda principal efectiva (la que define el hero) */
function principalCurrency() {
  if (state.currencyMode === 'BOTH') return state.vizCurrency || 'ARS';
  return state.currencyMode || 'ARS';
}

/* ---------- Navegación entre pantallas ---------- */

let current = 'welcome';

function go(name, { back = false } = {}) {
  const from = $(`.screen[data-screen="${current}"]`);
  const to   = $(`.screen[data-screen="${name}"]`);
  if (!to || from === to) return;

  // hooks de entrada
  if (name === 'saldo')   prepareSaldo();
  if (name === 'armando') runBuilding();
  if (name === 'listo')   renderSuccess();

  to.classList.remove('from-left');
  if (back) to.classList.add('from-left');
  // forzar reflow para que la transición parta de la posición correcta
  void to.offsetWidth;

  from.classList.remove('is-active');
  to.classList.add('is-active');
  to.classList.remove('from-left');
  to.scrollTop = 0;
  current = name;
  markDevbar(name);

  // foco inicial por pantalla (después de la transición)
  setTimeout(() => {
    if (name === 'cuenta') $('#accountName').focus();
    if (name === 'saldo') {
      const target = state.currencyMode === 'USD' ? $('#usdInput') : $('#arsInput');
      target && target.focus();
    }
  }, 280);
}

$$('[data-next]').forEach((btn) =>
  btn.addEventListener('click', () => go(btn.dataset.next))
);
$$('[data-back]').forEach((btn) =>
  btn.addEventListener('click', () => go(btn.dataset.back, { back: true }))
);

/* ---------- S2 — Moneda ---------- */

const monedaCta = $('#monedaCta');

function refreshMonedaCta() {
  const ok =
    state.currencyMode !== null &&
    (state.currencyMode !== 'BOTH' || state.vizCurrency !== null);
  monedaCta.disabled = !ok;
}

$$('#currencyOpts .opt-card').forEach((card) => {
  card.addEventListener('click', () => {
    state.currencyMode = card.dataset.currency;
    if (state.currencyMode !== 'BOTH') state.vizCurrency = null;

    $$('#currencyOpts .opt-card').forEach((c) =>
      c.classList.toggle('sel', c === card)
    );

    const isBoth = state.currencyMode === 'BOTH';
    $('#vizPanel').classList.toggle('open', isBoth);
    $('#fxNote').classList.toggle('show', isBoth);
    if (!isBoth) $$('#vizOpts .viz-opt').forEach((o) => o.classList.remove('sel'));

    refreshMonedaCta();
  });
});

$$('#vizOpts .viz-opt').forEach((opt) => {
  opt.addEventListener('click', () => {
    state.vizCurrency = opt.dataset.viz;
    $$('#vizOpts .viz-opt').forEach((o) => o.classList.toggle('sel', o === opt));
    refreshMonedaCta();
  });
});

/* ---------- S3 — Cuenta ---------- */

const accountInput = $('#accountName');
const cuentaCta = $('#cuentaCta');
const cuentaError = $('#cuentaError');

function refreshCuentaCta() {
  cuentaCta.disabled = accountInput.value.trim().length === 0;
}

accountInput.addEventListener('input', () => {
  state.accountName = accountInput.value;
  $$('#accountChips .chip').forEach((c) => c.classList.remove('sel'));
  cuentaError.classList.remove('show');
  refreshCuentaCta();
});

$$('#accountChips .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    accountInput.value = chip.dataset.name;
    state.accountName = chip.dataset.name;
    setAccountType(chip.dataset.type);
    $$('#accountChips .chip').forEach((c) => c.classList.toggle('sel', c === chip));
    cuentaError.classList.remove('show');
    refreshCuentaCta();
  });
});

function setAccountType(type) {
  state.accountType = type;
  $$('#typeSegs .seg').forEach((s) =>
    s.classList.toggle('sel', s.dataset.type === type)
  );
}

$$('#typeSegs .seg').forEach((seg) =>
  seg.addEventListener('click', () => setAccountType(seg.dataset.type))
);

/* POST /api/accounts simulado, con estado de error demostrable */
cuentaCta.addEventListener('click', () => {
  if (cuentaCta.disabled) return;
  state.accountName = accountInput.value.trim();

  cuentaCta.disabled = true;
  cuentaCta.textContent = 'Creando…';

  setTimeout(() => {
    cuentaCta.textContent = 'Crear cuenta';
    cuentaCta.disabled = false;

    if (state.simulateError && !state.errorFiredOnce) {
      state.errorFiredOnce = true; // el retry funciona
      cuentaError.classList.add('show');
      cuentaCta.textContent = 'Reintentar';
      return;
    }
    cuentaError.classList.remove('show');
    go('saldo');
  }, 650);
});

/* ---------- S4 — Saldo inicial ---------- */

const arsInput = $('#arsInput');
const usdInput = $('#usdInput');

function prepareSaldo() {
  $('#saldoAccountName').textContent = state.accountName || 'Tu cuenta';
  const mode = state.currencyMode || 'ARS';
  $('#arsField').style.display = mode === 'USD' ? 'none' : '';
  $('#usdField').style.display = mode === 'ARS' ? 'none' : '';
  refreshLivePreview();
}

function bindAmountInput(input, key) {
  input.addEventListener('input', () => {
    const digits = digitsOnly(input.value);
    state[key] = digits ? parseInt(digits, 10) : 0;
    input.value = digits ? fmtARS.format(state[key]) : '';
    refreshLivePreview();
  });
}

bindAmountInput(arsInput, 'ars');
bindAmountInput(usdInput, 'usd');

function refreshLivePreview() {
  const hasAny = state.ars > 0 || state.usd > 0;
  const lp = $('#livePreview');
  lp.classList.toggle('active', hasAny);

  const main = principalCurrency();
  const mainValue = main === 'USD' ? state.usd : state.ars;
  $('#lpAmount').textContent = formatAmount(mainValue, main);

  const secondary = $('#lpSecondary');
  if (state.currencyMode === 'BOTH') {
    const other = main === 'USD' ? 'ARS' : 'USD';
    const otherValue = other === 'USD' ? state.usd : state.ars;
    secondary.hidden = otherValue <= 0;
    secondary.textContent = `+ ${formatAmount(otherValue, other)} · el total combinado usa el oficial del día`;
  } else {
    secondary.hidden = true;
  }
}

$('#skipSaldo').addEventListener('click', () => {
  state.ars = 0;
  state.usd = 0;
  state.skippedSaldo = true;
  go('armando');
});

$('.screen[data-screen="saldo"] [data-next="armando"]').addEventListener('click', () => {
  state.skippedSaldo = !(state.ars > 0 || state.usd > 0);
});

/* ---------- S5 — Armando ---------- */

const CHECK_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 13 10 18 19 7"/></svg>';

let buildTimer = null;

function runBuilding() {
  clearTimeout(buildTimer);

  const main = principalCurrency();
  const monedaLabel =
    state.currencyMode === 'BOTH'
      ? `ARS + USD · total en ${main === 'USD' ? 'dólares' : 'pesos'}`
      : main === 'USD' ? 'Dólares' : 'Pesos';

  let saldoLabel = 'Pendiente';
  if (!state.skippedSaldo) {
    const parts = [];
    if (state.ars > 0) parts.push(formatAmount(state.ars, 'ARS'));
    if (state.usd > 0) parts.push(formatAmount(state.usd, 'USD'));
    saldoLabel = parts.join(' · ') || 'Pendiente';
  }

  const rows = [
    { key: 'Moneda', val: monedaLabel },
    { key: 'Cuenta', val: `${state.accountName || '—'} · ${TYPE_LABELS[state.accountType]}` },
    { key: 'Saldo inicial', val: saldoLabel },
  ];

  const wrap = $('#buildRows');
  wrap.innerHTML = rows
    .map(
      (r) => `
      <div class="build-row">
        <span class="build-check">${CHECK_SVG}</span>
        <span class="br-key">${r.key}</span>
        <span class="br-val">${r.val}</span>
      </div>`
    )
    .join('');

  $$('#buildRows .build-row').forEach((row, i) =>
    setTimeout(() => row.classList.add('in'), 360 + i * 420)
  );

  buildTimer = setTimeout(() => go('listo'), 360 + rows.length * 420 + 800);
}

/* ---------- S6 — Listo ---------- */

function renderSuccess() {
  const main = principalCurrency();
  const mainValue = main === 'USD' ? state.usd : state.ars;

  $('#finalAmount').textContent = formatAmount(mainValue, main);

  const breakdown = $('#finalBreakdown');
  if (state.currencyMode === 'BOTH' && !state.skippedSaldo) {
    breakdown.style.display = '';
    breakdown.innerHTML =
      `<span><b>ARS</b> ${fmtARS.format(state.ars)}</span>` +
      `<span class="sep">|</span>` +
      `<span><b>USD</b> ${fmtUSD.format(state.usd)}</span>`;
  } else {
    breakdown.style.display = 'none';
  }

  $('#finalAccountName').textContent =
    `${state.accountName || 'Tu cuenta'} · ${TYPE_LABELS[state.accountType]}`;

  $('#pendingNote').hidden = !state.skippedSaldo;

  // El placeholder del SmartInput respeta la moneda del usuario
  $('#siText').textContent =
    main === 'USD' ? 'café 4 con amigos' : 'café 2500 con amigos';
}

$('#enterApp').addEventListener('click', () => {
  // En la app real: router.push('/') — el home abre con el mismo
  // blue-zone hero que el usuario está viendo en esta pantalla.
  alert('En la app real: router.push("/") → home con el mismo hero azul.');
});

/* ---------- Dev bar ---------- */

const devbar = $('#devbar');

function markDevbar(name) {
  if (!devbar) return;
  $$('#devbar [data-jump]').forEach((b) =>
    b.classList.toggle('dv-active', b.dataset.jump === name)
  );
}

function seedDemoState() {
  // Solo para saltos directos desde la dev bar: estado de muestra
  if (!state.currencyMode) {
    state.currencyMode = 'BOTH';
    state.vizCurrency = 'ARS';
  }
  if (!state.accountName) {
    state.accountName = 'Mercado Pago';
    state.accountType = 'digital';
  }
  if (state.ars === 0 && state.usd === 0 && !state.skippedSaldo) {
    state.ars = 342300;
    state.usd = 120;
  }
}

$$('#devbar [data-jump]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.jump;
    if (target === 'listo-skip') {
      seedDemoState();
      state.ars = 0;
      state.usd = 0;
      state.skippedSaldo = true;
      go('listo');
      return;
    }
    if (target !== 'welcome' && target !== 'moneda') seedDemoState();
    if (target === 'listo' || target === 'armando') state.skippedSaldo = false;
    go(target);
  });
});

const errToggle = $('#errToggle');
if (errToggle) {
  errToggle.addEventListener('change', () => {
    state.simulateError = errToggle.checked;
    state.errorFiredOnce = false;
  });
}

const resetBtn = $('#resetBtn');
if (resetBtn) resetBtn.addEventListener('click', () => location.reload());

/* ---------- Modo limpio para screenshots: ?clean ---------- */

if (new URLSearchParams(location.search).has('clean')) {
  document.body.classList.add('clean');
}

/* Hook para capturas automatizadas */
window.__goto = (name) => {
  if (name !== 'welcome') seedDemoState();
  go(name);
};
window.__state = state;

markDevbar('welcome');
