// Client-side port of backend/crisis.py. Keep the two pattern lists in sync.
// Runs before anything else, in both demo and live mode, so a safety response
// never depends on the network.
(function () {
  const S = { NONE: 0, LOW: 1, MODERATE: 2, HIGH: 3, SEVERE: 4, CRITICAL: 5 };

  const CATEGORIES = [
    { name: "suicide", priority: 1, patterns: [
      ["kill(?:ing)? myself", S.CRITICAL],
      ["end(?:ing)? (?:my|it all|my own) life|end it all", S.CRITICAL],
      ["suicid(?:e|al)", S.CRITICAL],
      ["plan(?:ning)? to die", S.CRITICAL],
      ["(?:want|wanna|going) to die", S.SEVERE],
      ["better off dead|better off without me", S.SEVERE],
      ["no reason to live|don'?t want to (?:live|be alive|exist)", S.SEVERE],
      ["wish i (?:was|were) dead|wish i wasn'?t (?:here|alive)", S.SEVERE],
    ]},
    { name: "self_harm", priority: 2, patterns: [
      ["cut(?:ting)? myself|cutting my (?:arms?|wrists?|legs?)", S.HIGH],
      ["self[- ]?harm(?:ing)?", S.HIGH],
      ["hurt(?:ing)? myself", S.HIGH],
      ["burn(?:ing)? myself", S.HIGH],
      ["bleed out|overdose|od on", S.SEVERE],
    ]},
    { name: "immediate_danger", priority: 1, patterns: [
      ["goodbye forever|this is goodbye", S.CRITICAL],
      ["(?:my )?(?:last|suicide) note", S.CRITICAL],
      ["final message", S.CRITICAL],
    ]},
    { name: "emotional_distress", priority: 3, patterns: [
      ["completely hopeless|no hope left", S.HIGH],
      ["can'?t (?:take|do) (?:it|this) anymore", S.SEVERE],
      ["everything is pointless|nothing matters anymore", S.HIGH],
      ["unbearable pain", S.SEVERE],
      ["want (?:it|everything) to (?:end|stop)", S.SEVERE],
      ["nobody (?:cares|would notice)", S.MODERATE],
    ]},
    { name: "abuse", priority: 2, patterns: [
      ["being (?:abused|hurt|beaten|harassed)", S.SEVERE],
      ["(?:he|she|they) (?:threatens?|hits?|beats?) me", S.SEVERE],
      ["afraid for my life|scared for my life", S.CRITICAL],
      ["domestic violence|sexual(?:ly)? (?:assault|abuse)d?", S.CRITICAL],
      ["ragg(?:ed|ing)", S.HIGH],
    ]},
  ].map(c => ({ ...c, compiled: c.patterns.map(([p, s]) => [new RegExp(`\\b(?:${p})\\b`), s]) }));

  const normalise = t => t.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ");

  function analyze(text) {
    const t = normalise(text);
    let severity = S.NONE;
    const found = [];
    for (const c of CATEGORIES) {
      for (const [re, s] of c.compiled) {
        if (re.test(t)) {
          severity = Math.max(severity, s);
          if (!found.includes(c)) found.push(c);
        }
      }
    }
    found.sort((a, b) => a.priority - b.priority);
    return { isCrisis: severity >= S.HIGH, severity, categories: found.map(c => c.name) };
  }

  const OPENERS = {
    suicide: "I’m really glad you told me. What you’re feeling matters, and you deserve support from a real person right now.",
    self_harm: "Thank you for trusting me with this. You don’t have to handle it alone, and talking to someone can help, even today.",
    immediate_danger: "I’m worried about your safety right now. Please reach out to someone immediately.",
    emotional_distress: "That sounds incredibly heavy. Feeling this way doesn’t mean you’re weak; it means you’ve been carrying a lot.",
    abuse: "No one has the right to hurt or threaten you. You deserve to be safe, and there are people who can help.",
  };

  function safetyText(a) {
    const parts = [];
    if (a.severity === S.CRITICAL) parts.push("If you’re in immediate danger, please call 112 now.");
    a.categories.forEach(c => OPENERS[c] && parts.push(OPENERS[c]));
    parts.push("I’m still here if you want to keep talking. You can tell me as much or as little as you like.");
    return parts.join("\n\n");
  }

  window.Triage = { analyze, safetyText, Severity: S };
})();
