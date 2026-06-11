/* Gota — entry screen revamp · state machine del prototipo */
(function () {
  'use strict';

  // ── Config de variantes y estados ──────────────────────────────
  const VARIANTS = {
    a: {
      label: 'A · Conservative',
      note: '<b>Option A — Conservative.</b> Misma tesis que la pantalla actual (marca → preview → acceso), pero alineada 1:1 al sistema S5: card-s5, overlap −24, radios y sombras de tokens, preview etiquetado como ejemplo y ritmo vertical corregido.',
      states: [
        { id: 'inicial',  label: 'Inicial',   screen: 'a-splash', classes: [] },
        { id: 'cargando', label: 'Cargando',  screen: 'a-splash', classes: ['loading'] },
        { id: 'email',    label: 'Email',     screen: 'a-email',  classes: [] },
        { id: 'teclado',  label: 'Teclado',   screen: 'a-email',  classes: ['kb-open'] },
        { id: 'error',    label: 'Error',     screen: 'a-email',  classes: ['error'] },
        { id: 'codigo',   label: 'Código',    screen: 'a-otp',    classes: [] },
        { id: 'explorar', label: 'Explorar',  screen: 'a-explore', classes: [] },
      ],
    },
    b: {
      label: 'B · Strong-fit',
      note: '<b>Option B — Strong-fit (recomendada).</b> La entrada ES el producto: Saldo Vivo blanco-sobre-azul como en el Home real, card de Disponible real con overlap −24, una sola línea de framing y acceso con jerarquía clara. Email expande inline, sin pantalla intermedia.',
      states: [
        { id: 'inicial',  label: 'Inicial',        screen: 'b-main', classes: [] },
        { id: 'email',    label: 'Email inline',   screen: 'b-main', classes: ['email-open'] },
        { id: 'cargando', label: 'Cargando',       screen: 'b-main', classes: ['loading'] },
        { id: 'error',    label: 'Error',          screen: 'b-main', classes: ['email-open', 'error'] },
        { id: 'explorar', label: 'Explorar',       screen: 'b-main', classes: ['sheet-open'] },
        { id: 'teclado',  label: 'Teclado',        screen: 'b-main', classes: ['email-open', 'kb-open'] },
      ],
    },
    c: {
      label: 'C · Divergent',
      note: '<b>Option C — Divergent.</b> Explore-first: la pantalla demuestra el SmartInput con una demo viva (escribís como hablás → gasto parseado → saldo que baja) y el CTA primario es probar la app sin cuenta. Google y email pasan a segundo nivel.',
      states: [
        { id: 'demo',     label: 'Demo',        screen: 'c-main', classes: [] },
        { id: 'email',    label: 'Email',       screen: 'c-main', classes: ['email-open'] },
        { id: 'cargando', label: 'Cargando',    screen: 'c-main', classes: ['loading'] },
        { id: 'error',    label: 'Error',       screen: 'c-main', classes: ['error'] },
        { id: 'teclado',  label: 'Teclado',     screen: 'c-main', classes: ['email-open', 'kb-open'] },
      ],
    },
  };

  const params = new URLSearchParams(location.search);
  const SHOT = params.get('shot') === '1';
  if (SHOT) document.body.classList.add('shot');

  let currentVariant = ['a', 'b', 'c'].includes(params.get('variant')) ? params.get('variant') : 'b';
  let currentState = params.get('state') || VARIANTS[currentVariant].states[0].id;

  const tabsEl = document.getElementById('variantTabs');
  const stateBar = document.getElementById('stateBar');
  const noteEl = document.getElementById('variantNote');

  // ── Render toolbar ─────────────────────────────────────────────
  function renderToolbar() {
    tabsEl.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.variant === currentVariant);
    });
    stateBar.innerHTML = '';
    VARIANTS[currentVariant].states.forEach((s) => {
      const btn = document.createElement('button');
      btn.textContent = s.label;
      btn.classList.toggle('active', s.id === currentState);
      btn.addEventListener('click', () => setState(s.id));
      stateBar.appendChild(btn);
    });
    noteEl.innerHTML = VARIANTS[currentVariant].note;
  }

  // ── Apply state ────────────────────────────────────────────────
  function setVariant(v) {
    currentVariant = v;
    currentState = VARIANTS[v].states[0].id;
    applyState();
  }

  function setState(id) {
    currentState = id;
    applyState();
  }

  function applyState() {
    const conf = VARIANTS[currentVariant];
    const state = conf.states.find((s) => s.id === currentState) || conf.states[0];

    document.querySelectorAll('.variant').forEach((sec) => {
      sec.classList.toggle('active', sec.dataset.variant === currentVariant);
    });

    const variantEl = document.querySelector('.variant[data-variant="' + currentVariant + '"]');
    variantEl.querySelectorAll('.screen').forEach((scr) => {
      const isTarget = scr.dataset.screen === state.screen;
      scr.className = 'screen' + (isTarget ? ' active' : '');
      if (isTarget) state.classes.forEach((c) => scr.classList.add(c));
    });

    renderToolbar();

    // efectos de entrada
    const activeScreen = variantEl.querySelector('.screen.active');
    animateCounters(activeScreen);
    if (currentVariant === 'c' && state.screen === 'c-main' && !state.classes.includes('email-open')) {
      runSmartInputDemo();
    }
    if (currentVariant === 'c' && state.classes.includes('email-open')) {
      finishSmartInputDemo();
    }
  }

  // ── Animated counter (hero numbers) ────────────────────────────
  function formatAR(n) {
    return '$ ' + Math.round(n).toLocaleString('es-AR');
  }

  function animateCounters(scope) {
    if (!scope) return;
    scope.querySelectorAll('.js-count').forEach((el) => {
      const target = parseInt(el.dataset.target, 10);
      if (el.dataset.masked && el.classList.contains('masked')) return;
      if (SHOT) { el.textContent = formatAR(target); return; }
      const t0 = performance.now();
      const DUR = 900;
      function tick(t) {
        const p = Math.min(1, (t - t0) / DUR);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = formatAR(target * eased);
        if (p < 1 && !el.classList.contains('masked')) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  // ── Variant B: eye toggle (mask amounts) ───────────────────────
  let masked = false;
  document.querySelectorAll('.js-eye').forEach((btn) => {
    btn.addEventListener('click', () => {
      masked = !masked;
      document.querySelectorAll('.variant[data-variant="b"] .js-mask').forEach((el) => {
        if (masked) {
          el.dataset.original = el.dataset.original || el.textContent;
          el.textContent = el.dataset.masked;
          el.classList.add('masked');
        } else {
          el.classList.remove('masked');
          if (el.classList.contains('js-count')) {
            el.textContent = formatAR(parseInt(el.dataset.target, 10));
          } else if (el.dataset.original) {
            el.textContent = el.dataset.original;
          }
        }
      });
    });
  });

  // ── Variant C: SmartInput typing demo ──────────────────────────
  const DEMO_TEXT = 'café 2500 con amigos';
  let demoTimer = null;

  function clearDemoTimers() {
    if (demoTimer) { clearTimeout(demoTimer); demoTimer = null; }
  }

  function demoEls() {
    const root = document.querySelector('.variant[data-variant="c"]');
    return {
      type: root.querySelector('.js-type'),
      parsed: root.querySelector('.js-parsed'),
      saldoLine: root.querySelector('.js-saldoline'),
      saldo: root.querySelector('.js-saldo'),
      replay: root.querySelector('.js-replay'),
    };
  }

  function finishSmartInputDemo() {
    clearDemoTimers();
    const e = demoEls();
    e.type.textContent = DEMO_TEXT;
    e.parsed.classList.add('show');
    e.saldoLine.classList.add('show');
    e.saldo.textContent = '$ 1.248.500';
    e.replay.classList.add('show');
  }

  function runSmartInputDemo() {
    clearDemoTimers();
    if (SHOT) { finishSmartInputDemo(); return; }
    const e = demoEls();
    e.type.textContent = '';
    e.parsed.classList.remove('show');
    e.saldoLine.classList.remove('show');
    e.replay.classList.remove('show');
    e.saldo.textContent = '$ 1.251.000';

    let i = 0;
    function typeNext() {
      if (i <= DEMO_TEXT.length) {
        e.type.textContent = DEMO_TEXT.slice(0, i);
        i += 1;
        demoTimer = setTimeout(typeNext, 55 + Math.random() * 60);
      } else {
        demoTimer = setTimeout(() => {
          e.parsed.classList.add('show');
          demoTimer = setTimeout(() => {
            e.saldoLine.classList.add('show');
            tickSaldo(e.saldo, 1251000, 1248500, 600);
            demoTimer = setTimeout(() => e.replay.classList.add('show'), 700);
          }, 450);
        }, 420);
      }
    }
    typeNext();
  }

  function tickSaldo(el, from, to, dur) {
    const t0 = performance.now();
    function tick(t) {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 2);
      el.textContent = formatAR(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ── Wire prototype-internal navigation ─────────────────────────
  function on(selector, fn) {
    document.querySelectorAll(selector).forEach((el) => el.addEventListener('click', fn));
  }

  // Variant tabs
  tabsEl.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => setVariant(b.dataset.variant));
  });

  // A — splash
  on('.variant[data-variant="a"] .js-google', () => { setState('cargando'); autoRevert('inicial'); });
  on('.variant[data-variant="a"] .js-to-email', () => setState('email'));
  on('.variant[data-variant="a"] .js-to-explore', () => setState('explorar'));
  on('.variant[data-variant="a"] .js-back-splash', () => setState('inicial'));
  on('.variant[data-variant="a"] .js-back-email', () => setState('email'));
  on('.variant[data-variant="a"] .js-send-code', () => {
    const input = document.querySelector('.variant[data-variant="a"] .js-email-input');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) { setState('error'); return; }
    setState('codigo');
  });
  on('.variant[data-variant="a"] .js-enter-anon', (ev) => {
    ev.currentTarget.closest('.screen').classList.add('loading');
  });

  // A — focus de input abre teclado simulado
  document.querySelectorAll('.variant[data-variant="a"] .js-email-input').forEach((inp) => {
    inp.addEventListener('focus', () => {
      const scr = inp.closest('.screen');
      if (scr) scr.classList.add('kb-open');
    });
    inp.addEventListener('blur', () => {
      const scr = inp.closest('.screen');
      if (scr) scr.classList.remove('kb-open');
    });
  });

  // A — OTP boxes
  const otp = document.querySelectorAll('.js-otp input');
  otp.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '').slice(0, 1);
      box.classList.toggle('filled', !!box.value);
      if (box.value && i < otp.length - 1) otp[i + 1].focus();
      const full = Array.from(otp).every((b) => b.value);
      const verify = document.querySelector('.variant[data-variant="a"] .js-verify');
      verify.classList.toggle('btn-disabled', !full);
      verify.classList.toggle('btn-blue', full);
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) otp[i - 1].focus();
    });
  });

  // B
  on('.variant[data-variant="b"] .js-google-b', () => { setState('cargando'); autoRevert('inicial'); });
  on('.variant[data-variant="b"] .js-email-toggle', () => {
    setState(currentState === 'email' ? 'inicial' : 'email');
  });
  on('.variant[data-variant="b"] .js-explore-b', () => setState('explorar'));
  on('.variant[data-variant="b"] .js-sheet-close', () => setState('inicial'));
  on('.variant[data-variant="b"] .js-send-code-b', () => {
    const scr = document.querySelector('.variant[data-variant="b"] .screen');
    const input = scr.querySelector('.js-email-input');
    scr.classList.remove('error');
    scr.querySelector('.js-sent').style.display = 'none';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) { scr.classList.add('error'); return; }
    scr.querySelector('.js-sent').style.display = 'flex';
  });
  on('.variant[data-variant="b"] .js-enter-anon-b', (ev) => {
    ev.currentTarget.querySelector('.spinner').style.display = 'block';
  });
  document.querySelectorAll('.variant[data-variant="b"] .js-email-input').forEach((inp) => {
    inp.addEventListener('focus', () => setState('teclado'));
    inp.addEventListener('blur', () => { if (currentState === 'teclado') setState('email'); });
  });

  // C
  on('.variant[data-variant="c"] .js-try-c', () => { setState('cargando'); autoRevert('demo'); });
  on('.variant[data-variant="c"] .js-email-toggle', () => {
    setState(currentState === 'email' ? 'demo' : 'email');
  });
  on('.variant[data-variant="c"] .js-replay', () => runSmartInputDemo());
  on('.variant[data-variant="c"] .js-send-code-c', () => {
    const scr = document.querySelector('.variant[data-variant="c"] .screen');
    const input = scr.querySelector('.js-email-input');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
      scr.classList.add('error');
      scr.querySelector('.email-panel .inline-error').style.display = 'block';
    }
  });
  document.querySelectorAll('.variant[data-variant="c"] .js-email-input').forEach((inp) => {
    inp.addEventListener('focus', () => setState('teclado'));
    inp.addEventListener('blur', () => { if (currentState === 'teclado') setState('email'); });
  });

  let revertTimer = null;
  function autoRevert(stateId) {
    if (SHOT) return;
    if (revertTimer) clearTimeout(revertTimer);
    revertTimer = setTimeout(() => {
      if (currentState === 'cargando') setState(stateId);
    }, 2400);
  }

  // ── Init ───────────────────────────────────────────────────────
  applyState();
})();
