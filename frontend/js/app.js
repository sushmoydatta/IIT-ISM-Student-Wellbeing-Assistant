(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- storage (never required) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  // ---------- config ----------
  function resolveApi() {
    const q = new URLSearchParams(location.search).get("api");
    const url = (q || window.SUKOON_CONFIG?.API_URL || "").trim();
    return /^https?:\/\//.test(url) ? url : "";
  }
  const API_URL = resolveApi();
  const sessionId = store.get("sukoon.session") || `s-${crypto.getRandomValues(new Uint32Array(2)).join("")}`;
  store.set("sukoon.session", sessionId);

  const statusEl = $("#status");
  function setStatus(live, label) {
    statusEl.classList.toggle("live", live);
    $("#status-text").textContent = label;
  }
  setStatus(!!API_URL, API_URL ? "live · ai" : "on-device");
  $("#mode-note").textContent = API_URL
    ? "You’re in live mode: messages go to the backend API (logged as metadata only)."
    : "You’re in demo mode: everything (including the WebGL scenes) runs in your browser and nothing you type leaves this device.";

  // ---------- vibes ----------
  const VIBES = [
    { id: "aurora", name: "Liquid Aurora", desc: "Northern lights behind frosted glass. Calm and premium.",
      sw: "radial-gradient(ellipse at 30% 20%, #2a8f8a, transparent 60%), radial-gradient(ellipse at 80% 90%, #5a3fb0, transparent 60%), #070a18", orb: "radial-gradient(circle at 35% 30%, #fff, #7cf3e8 45%, #6a5cff)", glow: "#7cf3e8" },
    { id: "neural", name: "Neural Bloom", desc: "A particle sphere inside a sci-fi console. Most cyberpunk.",
      sw: "repeating-linear-gradient(0deg, rgba(124,243,232,.08) 0 1px, transparent 1px 8px), repeating-linear-gradient(90deg, rgba(124,243,232,.08) 0 1px, transparent 1px 8px), #020309", orb: "radial-gradient(circle, #ff5fd2 0 20%, #7cf3e8 45%, transparent 70%)", glow: "#ff5fd2" },
    { id: "dusk", name: "Dusk Bloom", desc: "Soap-bubble blobs over a twilight sky. Warm and gentle.",
      sw: "linear-gradient(to bottom, #120c1f, #3a2350 55%, #c0748a)", orb: "conic-gradient(from 40deg, #ffc6a8, #f6a6d8, #b9a8ff, #9fe9e0, #ffc6a8)", glow: "#f6a6d8" },
  ];
  const vibeRow = $(".vibe-row"), vibeGrid = $(".vibe-grid");
  VIBES.forEach(v => {
    const sw = document.createElement("button");
    sw.type = "button"; sw.className = "swatch"; sw.dataset.vibe = v.id;
    sw.setAttribute("role", "radio"); sw.setAttribute("aria-label", v.name); sw.title = v.name;
    sw.style.setProperty("--sw", v.orb);
    sw.addEventListener("click", () => setVibe(v.id));
    vibeRow.append(sw);
    const c = document.createElement("button");
    c.type = "button"; c.className = "vibe-card"; c.dataset.vibe = v.id; c.setAttribute("role", "radio");
    c.style.setProperty("--sw", v.sw); c.style.setProperty("--orb-sw", v.orb); c.style.setProperty("--glow-sw", v.glow);
    const pv = document.createElement("div"); pv.className = "pv";
    const nm = document.createElement("b"); nm.textContent = v.name;
    const d = document.createElement("span"); d.textContent = v.desc;
    c.append(pv, nm, d);
    c.addEventListener("click", () => setVibe(v.id));
    vibeGrid.append(c);
  });
  function setVibe(id) {
    if (!VIBES.some(v => v.id === id)) id = "aurora";
    document.documentElement.dataset.vibe = id;
    store.set("sukoon.vibe", id);
    $$(".swatch, .vibe-card").forEach(el => el.setAttribute("aria-checked", el.dataset.vibe === id));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#05070f";
    if (window.Scene) Scene.setVibe(id);
  }
  setVibe(document.documentElement.dataset.vibe || "aurora");

  // ---------- breath cue (driven by the scene's clock) ----------
  let breathRunning = false;
  const cue = $("#orb-cue");
  if (reduceMotion) cue.textContent = "in for 4 · out for 6";
  addEventListener("sukoon:phase", e => {
    if (!reduceMotion) cue.textContent = e.detail === "in" ? "breathe in" : "breathe out";
    if (breathRunning) buzz(e.detail === "in" ? 30 : [15, 60, 15]);
  });
  function buzz(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* unsupported */ } }

  // ---------- chat ----------
  const welcome = $("#welcome"), chat = $("#chat"), messages = $("#messages");
  const input = $("#input"), send = $("#send"), form = $("#composer"), sugg = $("#suggestions");
  const history = [];
  let started = false, busy = false;

  function startChat(mood) {
    if (started) return;
    started = true;
    if (window.Scene) { Scene.setMood(mood); Scene.setFocus(1); }
    welcome.hidden = true; chat.hidden = false;
    document.body.classList.add("chatting");
    const o = Companion.opener(mood);
    botSay(o.text, { actions: o.actions, delay: 500 });
    renderSuggestions(["I can’t focus on studying", "I feel homesick", "Placements are stressing me", "I can’t sleep"]);
    setTimeout(() => input.focus(), 50);
  }

  $$(".mood").forEach(b => b.addEventListener("click", () => startChat(b.dataset.mood)));
  $("#skip-checkin").addEventListener("click", () => startChat("none"));
  $("#brand").addEventListener("click", () => { if (started) messages.scrollTo({ top: 0, behavior: "smooth" }); });

  function renderSuggestions(list) {
    sugg.replaceChildren(...list.map(t => chip({ label: t, say: t })));
  }

  function chip(a) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = a.label;
    b.addEventListener("click", () => a.open ? openDialog(a.open) : sendMessage(a.say));
    return b;
  }

  function addMessage(role, text, opts = {}) {
    const row = document.createElement("div");
    row.className = `msg ${role}`;
    if (role === "bot") { const av = document.createElement("span"); av.className = "avatar"; av.setAttribute("aria-hidden", "true"); row.append(av); }
    const col = document.createElement("div");
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    if (role === "bot") {
      let wi = 0;
      text.split(/\n{2,}/).forEach(p => {
        const el = document.createElement("p");
        p.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { el.append(part); return; }
          const w = document.createElement("span"); w.className = "w"; w.style.setProperty("--i", Math.min(wi++, 90)); w.textContent = part; el.append(w);
        });
        bubble.append(el);
      });
    } else bubble.textContent = text;
    if (opts.crisis) bubble.append(crisisCard());
    if (opts.actions?.length) {
      const a = document.createElement("div"); a.className = "actions";
      opts.actions.forEach(x => a.append(chip(x)));
      bubble.append(a);
    }
    col.append(bubble);
    if (opts.meta) { const m = document.createElement("div"); m.className = "msg-meta"; m.textContent = opts.meta; col.append(m); }
    row.append(col);
    messages.append(row);
    messages.scrollTop = messages.scrollHeight;
    return row;
  }

  function crisisCard() {
    const card = document.createElement("div");
    card.className = "crisis-card";
    const title = document.createElement("b"); title.textContent = "You can reach a real person right now, free:";
    const lines = document.createElement("div"); lines.className = "lines";
    [["Tele-MANAS · 24×7", "14416", "tel:14416"], ["Emergency", "112", "tel:112"], ["iCall · Mon–Sat", "9152987821", "tel:+919152987821"]]
      .forEach(([name, num, href]) => {
        const a = document.createElement("a"); a.href = href;
        const s = document.createElement("span"); s.textContent = name;
        const e = document.createElement("em"); e.textContent = num;
        a.append(s, e); lines.append(a);
      });
    card.append(title, lines);
    return card;
  }

  function typing() {
    const row = document.createElement("div");
    row.className = "msg bot typing";
    row.innerHTML = '<span class="avatar" aria-hidden="true"></span><div class="bubble" aria-label="Sukoon is typing"><span></span><span></span><span></span></div>';
    messages.append(row); messages.scrollTop = messages.scrollHeight;
    return row;
  }

  const wait = ms => new Promise(r => setTimeout(r, reduceMotion ? 0 : ms));

  async function botSay(text, opts = {}) {
    const t = typing();
    await wait(opts.delay ?? Math.min(1800, 500 + text.length * 6));
    t.remove();
    addMessage("bot", text, opts);
    history.push({ role: "assistant", content: text });
  }

  async function askApi(text) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
      const r = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, query: text, user_locale: navigator.language || "en-IN", history: history.slice(-8, -1) }),
        signal: ctrl.signal,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.response) throw new Error(data.detail || `HTTP ${r.status}`);
      return data;
    } finally { clearTimeout(timer); }
  }

  async function sendMessage(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    if (!started) startChat("none");
    busy = true; send.disabled = true;
    sugg.replaceChildren();
    addMessage("user", text);
    history.push({ role: "user", content: text });

    // 1. Safety first, always on-device.
    const triage = Triage.analyze(text);
    if (triage.isCrisis) {
      await botSay(Triage.safetyText(triage), {
        crisis: true, delay: 400,
        actions: [{ label: "All helplines", open: "help" }, { label: "Breathe with me", open: "breathe" }, { label: "I’m safe, I want to keep talking", say: "I’m safe right now, I just want to keep talking" }],
      });
      busy = false; updateSend(); return;
    }

    // 2. Live API if configured, otherwise the on-device companion.
    if (API_URL) {
      const t = typing();
      try {
        const data = await askApi(text);
        t.remove();
        addMessage("bot", data.response, {
          crisis: data.is_crisis,
          meta: data.sources?.length ? `grounded in: ${data.sources.join(", ")}` : undefined,
        });
        history.push({ role: "assistant", content: data.response });
      } catch (e) {
        t.remove();
        setStatus(false, "on-device · fallback");
        const r = Companion.respond(text);
        await botSay(r.text, { actions: r.actions, delay: 200, meta: "live server unreachable; answered on-device" });
      }
    } else {
      const r = Companion.respond(text);
      await botSay(r.text, { actions: r.actions });
    }
    busy = false; updateSend();
  }

  function updateSend() { send.disabled = busy || !input.value.trim(); }
  function autosize() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 160) + "px"; }
  input.addEventListener("input", () => { updateSend(); autosize(); });
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener("submit", e => {
    e.preventDefault();
    const v = input.value; input.value = ""; autosize(); sendMessage(v);
  });

  // ---------- dialogs ----------
  function openDialog(name) {
    const d = $(`#dlg-${name}`);
    if (!d || d.open) return;
    d.showModal();
    d.dispatchEvent(new Event("opened"));
  }
  $$("[data-open]").forEach(b => b.addEventListener("click", () => openDialog(b.dataset.open)));
  $$("dialog").forEach(d => {
    d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
  });

  // ---------- breathe ----------
  const breather = $("#breather"), phase = $("#breath-phase"), count = $("#breath-count");
  const toggle = $("#breath-toggle"), done = $("#breath-done");
  let minutes = 2, running = false, bTimers = [], breaths = 0;
  $$(".seg button").forEach(b => b.addEventListener("click", () => {
    $$(".seg button").forEach(x => x.setAttribute("aria-checked", x === b));
    minutes = +b.dataset.min;
  }));
  function stopBreath(finished) {
    running = false; breathRunning = false; bTimers.forEach(clearTimeout); bTimers = [];
    breather.classList.remove("in", "out");
    phase.textContent = finished ? "well done" : "ready"; count.textContent = "";
    toggle.textContent = "Begin";
    if (finished) {
      done.hidden = false;
      done.textContent = `${breaths} slow breaths. Notice how your shoulders feel now.`;
      if (started) setTimeout(() => botSay("Welcome back. How are you feeling after that breathing? Even a small shift counts.", { delay: 300 }), 600);
    }
  }
  function cycle(endAt) {
    if (!running) return;
    if (Date.now() >= endAt) return stopBreath(true);
    breaths++;
    breather.classList.remove("out"); void breather.offsetWidth; breather.classList.add("in");
    phase.textContent = "breathe in";
    tick(4);
    bTimers.push(setTimeout(() => {
      breather.classList.replace("in", "out");
      phase.textContent = "breathe out";
      tick(6);
      bTimers.push(setTimeout(() => cycle(endAt), 6000));
    }, 4000));
  }
  function tick(n) {
    count.textContent = n;
    for (let i = 1; i < n; i++) bTimers.push(setTimeout(() => { count.textContent = n - i; }, i * 1000));
  }
  toggle.addEventListener("click", () => {
    if (running) return stopBreath(false);
    running = true; breathRunning = true; breaths = 0; done.hidden = true; toggle.textContent = "Stop";
    if (window.Scene) Scene.syncBreath();
    cycle(Date.now() + minutes * 60000);
  });
  $("#dlg-breathe").addEventListener("close", () => running && stopBreath(false));

  // ---------- ground (5-4-3-2-1) ----------
  const STEPS = [
    [5, "things you can see", "Look around slowly. Notice colours, shapes, light."],
    [4, "things you can feel", "Your feet on the floor, fabric on your skin, the air."],
    [3, "things you can hear", "Near and far. Fans, voices, birds, your own breath."],
    [2, "things you can smell", "Or two smells you like, if nothing’s around."],
    [1, "thing you can taste", "Or take a sip of water and notice it."],
  ];
  let gi = 0;
  const gSteps = $("#ground-steps"), gCard = $("#ground-card"), gNext = $("#ground-next"), gBack = $("#ground-back");
  gSteps.replaceChildren(...STEPS.map(() => document.createElement("span")));
  function renderGround() {
    $$("span", gSteps).forEach((s, i) => s.classList.toggle("on", i < gi + (gi < STEPS.length ? 1 : 0)));
    gBack.disabled = gi === 0;
    if (gi >= STEPS.length) {
      gCard.innerHTML = '<div class="big">✓</div><h4>You’re here. Right now.</h4><p class="muted">Your mind followed your senses back into the present. You can return to this anytime.</p>';
      gNext.textContent = "Done";
      return;
    }
    const [n, what, hint] = STEPS[gi];
    gCard.replaceChildren();
    const big = document.createElement("div"); big.className = "big"; big.textContent = n;
    const h = document.createElement("h4"); h.textContent = `Name ${n} ${what}`;
    const p = document.createElement("p"); p.className = "muted"; p.textContent = hint;
    const inputs = document.createElement("div"); inputs.className = "inputs";
    for (let i = 0; i < Math.min(n, 3); i++) {
      const f = document.createElement("input"); f.className = "field"; f.placeholder = i === 0 ? "optional: type it, or just notice it" : "";
      f.setAttribute("aria-label", `${what} ${i + 1}`);
      inputs.append(f);
    }
    gCard.append(big, h, p, inputs);
    gNext.textContent = gi === STEPS.length - 1 ? "Finish" : "Next";
  }
  gNext.addEventListener("click", () => {
    if (gi >= STEPS.length) {
      $("#dlg-ground").close();
      if (started) botSay("That was a grounding exercise well done. How’s your mind feeling now compared to a few minutes ago?", { delay: 300 });
      return;
    }
    gi++; renderGround();
  });
  gBack.addEventListener("click", () => { if (gi > 0) { gi--; renderGround(); } });
  $("#dlg-ground").addEventListener("opened", () => { gi = 0; renderGround(); });

  // ---------- reframe ----------
  const rForm = $("#reframe-form"), rList = $("#reframes");
  function renderReframes() {
    const items = store.get("sukoon.reframes", []);
    rList.replaceChildren(...items.slice().reverse().map((it, idx) => {
      const el = document.createElement("div"); el.className = "reframe-item";
      const del = document.createElement("button"); del.textContent = "remove"; del.type = "button";
      del.addEventListener("click", () => { const all = store.get("sukoon.reframes", []); all.splice(items.length - 1 - idx, 1); store.set("sukoon.reframes", all); renderReframes(); });
      const s = document.createElement("s"); s.textContent = it.thought;
      const p = document.createElement("p"); p.textContent = "→ " + it.reframe;
      el.append(del, s, p); return el;
    }));
  }
  rForm.addEventListener("submit", e => {
    e.preventDefault();
    const f = new FormData(rForm);
    const all = store.get("sukoon.reframes", []);
    all.push({ thought: f.get("thought").trim(), reframe: f.get("reframe").trim(), at: Date.now() });
    store.set("sukoon.reframes", all.slice(-20));
    rForm.reset(); renderReframes();
  });
  renderReframes();
})();
