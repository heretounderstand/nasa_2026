/* Flame in Freefall — front-end statique.
 * Lit window.DASHBOARD (data/dashboard.js, produit par `python -m engine.pipeline`).
 * Aucun chiffre n'est calculé ici à partir de rien : tout vient du JSON du moteur,
 * et chaque texte est rédigé par règles à partir de ce JSON.
 */
(function () {
  "use strict";
  var D = window.DASHBOARD;
  var main = document.getElementById("main");

  // ------------------------------------------------------------------ outils
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(x, d) {
    if (x == null || isNaN(x)) return "—";
    return Number(x).toLocaleString("fr-FR", { maximumFractionDigits: d == null ? 2 : d });
  }
  function pct(x, d) { return x == null ? "[à définir]" : num(x * 100, d == null ? 1 : d) + " %"; }
  function byId(list, key) { var o = {}; list.forEach(function (x) { o[x[key]] = x; }); return o; }

  var CTX = byId(D.contexts, "context_id");
  var SCN = byId(D.scenarios, "scenario_id");
  var SRC = byId(D.sources, "source_id");
  var CTX_ORDER = ["terre", "iss", "gateway", "lune", "mars"];
  var CONF = ["tres_faible", "faible", "moyenne", "elevee"];
  var CONF_WORD = { tres_faible: "Très faible", faible: "Faible", moyenne: "Moyenne", elevee: "Élevée" };
  var EVID_WORD = { limitees: "limitées", moyennes: "moyennes", solides: "solides" };
  var AGR_WORD = { faible: "faible", moyen: "moyen", eleve: "élevé" };
  var CLASS_WORD = {
    extinction: "s'éteint", sustained: "continue de brûler",
    cool_flame: "flamme froide persistante", no_cool_flame: "pas de flamme froide",
    more_flammable_than_1g: "plus inflammable qu'à 1 g", similar_to_1g: "comparable à 1 g",
    less_flammable_than_1g: "moins inflammable qu'à 1 g"
  };
  var CEIL_WORD = {
    partial_gravity_no_long_duration: "gravité partielle sans mesure de longue durée : au mieux « faible »",
    out_of_data_envelope: "scénario hors de l'enveloppe des données : au mieux « faible »",
    single_source: "une seule source : au mieux « moyenne »",
    model_below_baseline: "le modèle ne bat pas la référence : aucune prédiction affichée"
  };
  var PLATFORM_WORD = {
    iss: "ISS", drop_tower: "tour de chute", drop_tower_centrifuge: "tour de chute centrifugée",
    parabolic_flight: "vol parabolique", suborbital_centrifuge: "fusée suborbitale en rotation",
    ground: "au sol (1 g)", simulation: "simulation", lunar_surface: "surface lunaire"
  };
  var GRAV_STATUS = {
    micro_long: "microgravité, essais longue durée", micro_short: "microgravité, essais courts seulement",
    micro_untested: "microgravité, jamais testée", partial_long: "gravité partielle, essais longue durée",
    partial_short: "gravité partielle, essais de quelques secondes", partial_untested: "gravité partielle, jamais testée",
    earth_long: "1 g, essais au sol", earth_short: "1 g", earth_untested: "1 g, non testée"
  };
  var REGIME_WORD = { micro: "microgravité", lunar: "gravité lunaire", martian: "gravité martienne", partial_other: "gravité partielle", earth: "1 g" };

  function answerFor(sid, cid) {
    for (var i = 0; i < D.answers.length; i++) {
      var a = D.answers[i];
      if (a.scenario_id === sid && a.context_id === cid) return a;
    }
    return null;
  }
  function lumens(level, cls, total) {
    total = total || 4;
    var n = level == null ? 0 : level;
    var out = '<span class="lumens ' + (cls || "") + '" aria-hidden="true">';
    for (var i = 0; i < total; i++) {
      var h = cls === "big" ? ' style="height:' + (28 + i * 18) + 'px"' : "";
      out += "<i" + (i < n ? ' class="on"' : "") + h + "></i>";
    }
    return out + "</span>";
  }
  function confLevel(a) { return a ? CONF.indexOf(a.confidence) + 1 : 0; }

  // ------------------------------------------------------------- navigation
  function route() {
    var h = (location.hash || "#carte").slice(1).split("/");
    return { view: h[0] || "carte", a: h[1], b: h[2] };
  }
  function renderNav(view) {
    var items = [["carte", "01 CARTE"], ["scenario", "02 SCÉNARIO"], ["priorites", "03 PRIORITÉS"]];
    document.getElementById("nav").innerHTML = items.map(function (it) {
      var cur = view === it[0] ? ' aria-current="page"' : "";
      return '<a href="#' + it[0] + '"' + cur + ">" + it[1] + "</a>";
    }).join("");
  }

  // ------------------------------------------------- barre de question
  // Aiguillage par mots-clés en attendant le LLM : il ne produit jamais de
  // réponse ni de chiffre, il choisit seulement un scénario et un contexte.
  var CTX_RULES = [[/lun|moon/i, "lune"], [/mars|martien/i, "mars"], [/gateway/i, "gateway"], [/iss|station/i, "iss"]];
  var SCN_RULES = [
    [/c[âa]ble|fil|wire|[ée]lectri|gaine/i, "s1"], [/fum|d[ée]tect|smoke/i, "s5"],
    [/froide|invisible|goutte|carburant|droplet/i, "s3"], [/gaz|fuite|leak/i, "s4"],
    [/tissu|textile|fabric|v[êe]tement|enrichi/i, "s2"], [/certifi|mat[ée]riau|norme|s[ûu]r/i, "s6"]
  ];
  document.getElementById("ask").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var q = document.getElementById("q").value;
    var cid = "lune", sid = "s6", hitC = false, hitS = false;
    CTX_RULES.some(function (r) { if (r[0].test(q)) { cid = r[1]; hitC = true; return true; } return false; });
    SCN_RULES.some(function (r) { if (r[0].test(q)) { sid = r[1]; hitS = true; return true; } return false; });
    document.getElementById("ask-note").textContent =
      "Traduit en : « " + SCN[sid].title + " » · " + CTX[cid].label +
      (hitC && hitS ? "" : " (par défaut pour la partie non reconnue)") +
      ". Aiguillage par mots-clés : le modèle de langue n'est pas encore branché.";
    location.hash = "#scenario/" + sid + "/" + cid;
  });

  // ================================================================ CARTE
  var mapState = { proj: "gravity", pts: true, cov: true, lim: true };
  var PROJ = {
    gravity: { label: "O₂ × GRAVITÉ", key: "gravity_g", min: 0, max: 1, ticks: [[0, "0 g"], [0.5, "0,5 g"], [1, "1 g"]], axis: "GRAVITÉ" },
    pressure: { label: "O₂ × PRESSION", key: "pressure_kpa", min: 0, max: 520, ticks: [[0, "0"], [101.3, "101 kPa"], [260, "260"], [520, "520 kPa"]], axis: "PRESSION (kPa)" },
    flow: { label: "O₂ × ÉCOULEMENT", key: "flow_velocity_cm_s", min: 0, max: 40, ticks: [[0, "0"], [20, "20"], [40, "40 cm/s"]], axis: "ÉCOULEMENT (cm/s)" }
  };
  var X0 = 80, X1 = 960, Y0 = 40, Y1 = 500, O2MIN = 0.10, O2MAX = 0.40;
  function jitter(id, amp) { // dispersion d'affichage, déterministe
    var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return ((h % 1000) / 1000) * amp;
  }

  function mapSvg() {
    var P = PROJ[mapState.proj];
    function sx(v) { return X0 + (Math.min(Math.max(v, P.min), P.max) - P.min) / (P.max - P.min) * (X1 - X0); }
    function sy(o) { return Y1 - (o - O2MIN) / (O2MAX - O2MIN) * (Y1 - Y0); }
    var pts = D.experiments.filter(function (e) {
      return e.o2_mole_fraction != null && e[P.key] != null && e.o2_mole_fraction >= O2MIN && e.o2_mole_fraction <= O2MAX;
    });
    var s = '<svg viewBox="0 0 1000 560" role="img" aria-label="' + pts.length + ' expériences placées selon ' + esc(P.axis.toLowerCase()) + " et le taux d'oxygène\">";
    s += '<defs><radialGradient id="glow"><stop offset="0%" stop-color="#CFE8FF" stop-opacity="0.07"/><stop offset="100%" stop-color="#CFE8FF" stop-opacity="0"/></radialGradient></defs>';
    if (mapState.cov) {
      s += '<g aria-hidden="true">';
      pts.forEach(function (e) {
        s += '<circle cx="' + (sx(e[P.key]) + jitter(e.experiment_id, 10) - 5).toFixed(1) + '" cy="' + sy(e.o2_mole_fraction).toFixed(1) + '" r="30" fill="url(#glow)"/>';
      });
      s += "</g>";
    }
    s += '<g stroke="#1E252E">';
    [0.1, 0.2, 0.3, 0.4].forEach(function (o) { s += '<line x1="' + X0 + '" y1="' + sy(o) + '" x2="' + X1 + '" y2="' + sy(o) + '"/>'; });
    s += '</g><g font-family="JetBrains Mono, monospace" font-size="12" fill="#98A0AA">';
    [0.1, 0.2, 0.3, 0.4].forEach(function (o) { s += '<text x="68" y="' + (sy(o) + 4) + '" text-anchor="end">' + o * 100 + " %</text>"; });
    P.ticks.forEach(function (t) { s += '<text x="' + sx(t[0]) + '" y="526" text-anchor="middle">' + t[1] + "</text>"; });
    s += '<text x="520" y="550" text-anchor="middle" fill="#EDEBE6">' + P.axis + '</text><text x="22" y="270" text-anchor="middle" fill="#EDEBE6" transform="rotate(-90 22 270)">OXYGÈNE</text></g>';

    if (mapState.proj === "gravity") {
      s += '<g stroke="#5D6670" stroke-dasharray="3 5"><line x1="' + sx(0.165) + '" y1="40" x2="' + sx(0.165) + '" y2="500"/><line x1="' + sx(0.38) + '" y1="40" x2="' + sx(0.38) + '" y2="500"/></g>';
      s += '<g font-family="JetBrains Mono, monospace" font-size="12" fill="#EDEBE6"><text x="' + (sx(0.165) + 6) + '" y="58">LUNE 0,16 g</text><text x="' + (sx(0.38) + 6) + '" y="58">MARS 0,38 g</text></g>';
      if (mapState.lim) {
        var L = D.limit_band.levels;
        var top = L.map(function (l) { return sx(l.gravity_g) + "," + sy(l.high); });
        var bot = L.slice().reverse().map(function (l) { return sx(l.gravity_g) + "," + sy(l.low); });
        var mid = L.map(function (l) { return sx(l.gravity_g) + "," + sy((l.low + l.high) / 2); });
        s += '<g><polygon points="' + top.concat(bot).join(" ") + '" fill="#FF7A2F" fill-opacity="0.22"/>';
        s += '<polyline points="' + mid.join(" ") + '" fill="none" stroke="#FF7A2F" stroke-width="2.5"/>';
        L.forEach(function (l) { s += '<circle cx="' + sx(l.gravity_g) + '" cy="' + sy((l.low + l.high) / 2) + '" r="3" fill="#FF7A2F"/>'; });
        s += '<g font-family="Archivo, sans-serif" font-size="13" fill="#FFB27A"><text x="600" y="' + (sy(0.147) - 10) + '">combustion possible ↑</text><text x="600" y="' + (sy(0.137) + 22) + '">↓ extinction</text></g></g>';
        s += limitInset(sx);
      }
    }
    if (mapState.pts) {
      s += '<g fill="#EDEBE6">';
      pts.forEach(function (e) {
        var cx = sx(e[P.key]) + jitter(e.experiment_id, 10) - 5;
        var title = e.experiment_id + " · " + (PLATFORM_WORD[e.platform] || e.platform) + " · O₂ " + pct(e.o2_mole_fraction);
        s += '<circle cx="' + cx.toFixed(1) + '" cy="' + sy(e.o2_mole_fraction).toFixed(1) + '" r="3" fill-opacity="0.85"><title>' + esc(title) + "</title></circle>";
      });
      s += "</g>";
    }
    // Essais à venir (FM2)
    s += '<g font-family="Archivo, sans-serif" font-size="13">';
    D.upcoming.forEach(function (u, i) {
      var x = sx(u[P.key] != null ? u[P.key] : NaN), y = sy(u.o2_mole_fraction);
      if (isNaN(x)) return;
      s += '<rect x="' + (x - 6) + '" y="' + (y - 6) + '" width="12" height="12" fill="none" stroke="#FF7A2F" stroke-dasharray="2 2" transform="rotate(45 ' + x + " " + y + ')"><title>' + esc(u.id + " (à venir) · " + u.provenance) + "</title></rect>";
      if (i === 0) s += '<text x="' + (x + 12) + '" y="' + (y + 4) + '" fill="#FFB27A">FM2 · à venir</text>';
    });
    // Contextes de mission
    var markers = { terre: "#EDEBE6", iss: "#CFE8FF", gateway: "#CFE8FF", lune: "#FF7A2F" };
    Object.keys(markers).forEach(function (cid) {
      var c = CTX[cid].conditions;
      var xv = mapState.proj === "gravity" ? c.gravity_g : mapState.proj === "pressure" ? c.pressure_kpa : null;
      if (xv == null || c.o2_mole_fraction == null) return;
      var x = sx(xv), y = sy(c.o2_mole_fraction), lune = cid === "lune";
      var right = x > 800, dx = xv === 0 ? 46 : 14; // à 0 g, décaler hors de la colonne de points
      if (lune) s += '<circle class="pg" cx="' + x + '" cy="' + y + '" r="10" fill="none" stroke="#FF7A2F" stroke-width="2" style="transform-origin:' + x + "px " + y + 'px;animation:ping 2.2s ease-out infinite"/>';
      s += '<rect x="' + (x - 7) + '" y="' + (y - 7) + '" width="14" height="14" fill="' + (lune ? "#FF7A2F" : "none") + '" stroke="' + markers[cid] + '" stroke-width="2" transform="rotate(45 ' + x + " " + y + ')"/>';
      s += '<text x="' + (right ? x - 14 : x + dx) + '" y="' + (y + 4) + '" text-anchor="' + (right ? "end" : "start") + '" fill="' + markers[cid] + '" font-weight="600" paint-order="stroke" stroke="#07090C" stroke-width="4">' + esc(CTX[cid].label) + " · " + pct(c.o2_mole_fraction) + "</text>";
      if (cid === "terre") s += '<text x="' + (x - 14) + '" y="' + (y + 13) + '" text-anchor="end" fill="#98A0AA">référence : certification</text>';
    });
    if (mapState.proj === "gravity") s += '<text x="' + (sx(0.38) + 6) + '" y="100" fill="#98A0AA">Habitat martien :</text><text x="' + (sx(0.38) + 6) + '" y="117" fill="#98A0AA">atmosphère à définir</text>';
    s += "</g></svg>";
    return { svg: s, n: pts.length };
  }

  // Encart : la limite agrandie (essais réels, PMMA, Olson 2024 via Ferkul 2026 p. 20)
  function limitInset(sx) {
    var bx = 590, by = 96, bw = 350, bh = 200, lo = 0.13, hi = 0.155;
    function iy(o) { return by + bh - (o - lo) / (hi - lo) * bh; }
    function ix(g) { return bx + g * bw; }
    var t = '<g aria-label="Agrandissement de la limite d’inflammabilité"><rect x="' + (bx - 44) + '" y="' + (by - 30) + '" width="' + (bw + 60) + '" height="' + (bh + 62) + '" fill="#07090C" stroke="#1E252E"/>';
    t += '<text x="' + (bx - 34) + '" y="' + (by - 12) + '" font-family="JetBrains Mono, monospace" font-size="11" fill="#98A0AA">ZOOM · PMMA · ' + num(D.limit_band.pressure_kpa, 1) + ' kPa</text>';
    [0.13, 0.14, 0.15].forEach(function (o) {
      t += '<line x1="' + bx + '" x2="' + (bx + bw) + '" y1="' + iy(o) + '" y2="' + iy(o) + '" stroke="#1E252E"/><text x="' + (bx - 6) + '" y="' + (iy(o) + 4) + '" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="11" fill="#98A0AA">' + num(o * 100, 0) + ' %</text>';
    });
    [[0, "0"], [0.165, "Lune"], [0.38, "Mars"], [1, "1 g"]].forEach(function (g) {
      t += '<text x="' + ix(g[0]) + '" y="' + (by + bh + 18) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#98A0AA">' + g[1] + "</text>";
    });
    var L = D.limit_band.levels;
    t += '<polygon points="' + L.map(function (l) { return ix(l.gravity_g) + "," + iy(l.high); }).concat(L.slice().reverse().map(function (l) { return ix(l.gravity_g) + "," + iy(l.low); })).join(" ") + '" fill="#FF7A2F" fill-opacity="0.22"/>';
    D.experiments.forEach(function (e) {
      if (e.source_id !== D.limit_band.source_id) return;
      var x = ix(e.gravity_g), y = iy(e.o2_mole_fraction);
      t += e.outcome_type === "sustained"
        ? '<circle cx="' + x + '" cy="' + y + '" r="4" fill="#CFE8FF"><title>flamme stable · ' + num(e.gravity_g) + " g · O₂ " + pct(e.o2_mole_fraction, 2) + "</title></circle>"
        : '<path d="M' + (x - 4) + "," + (y - 4) + "l8,8m0,-8l-8,8" + '" stroke="#FF7A2F" stroke-width="2"><title>extinction · ' + num(e.gravity_g) + " g · O₂ " + pct(e.o2_mole_fraction, 2) + "</title></path>";
    });
    t += '<g font-family="Archivo, sans-serif" font-size="12"><circle cx="' + (bx + 190) + '" cy="' + (by - 15) + '" r="4" fill="#CFE8FF"/><text x="' + (bx + 198) + '" y="' + (by - 11) + '" fill="#EDEBE6">stable</text>';
    t += '<path d="M' + (bx + 248) + "," + (by - 19) + 'l8,8m0,-8l-8,8" stroke="#FF7A2F" stroke-width="2"/><text x="' + (bx + 262) + '" y="' + (by - 11) + '" fill="#EDEBE6">éteinte</text></g></g>';
    return t;
  }

  function mapStats() {
    var micro = {}, partial = [], maxDur = 0;
    D.experiments.forEach(function (e) {
      if (e.gravity_regime === "micro" && e.is_measured) micro[e.source_id] = 1;
      if (["lunar", "martian", "partial_other"].indexOf(e.gravity_regime) >= 0) partial.push(e);
    });
    var partialSources = {};
    partial.forEach(function (e) { partialSources[e.source_id] = 1; });
    var minLevel = D.limit_band.levels.reduce(function (m, l) { return l.low < m.low ? l : m; });
    return { micro: Object.keys(micro).length, partialN: partial.length, partialSrc: Object.keys(partialSources).length, minG: minLevel.gravity_g };
  }

  function viewCarte() {
    var m = mapSvg(), st = mapStats();
    var layers = [["pts", "Expériences", "#EDEBE6"], ["cov", "Couverture", "#CFE8FF"], ["lim", "Limite d'inflammabilité", "#FF7A2F"]];
    var html = '<div class="row" style="justify-content:space-between;align-items:flex-end"><h1 class="hero">La connaissance est une lumière. <span>Voici où elle s’éteint.</span></h1></div>';
    html += '<div class="row"><section class="grow" aria-label="Carte de la connaissance" style="display:flex;flex-direction:column;gap:14px">';
    html += '<div class="row" style="justify-content:space-between;gap:12px;align-items:center"><div class="seg" role="group" aria-label="Projection">';
    Object.keys(PROJ).forEach(function (k) { html += '<button type="button" data-proj="' + k + '" aria-pressed="' + (mapState.proj === k) + '">' + PROJ[k].label + "</button>"; });
    html += '</div><div class="seg" role="group" aria-label="Couches">';
    layers.forEach(function (l) {
      var on = mapState[l[0]];
      html += '<button type="button" data-layer="' + l[0] + '" aria-pressed="' + on + '" style="display:inline-flex;align-items:center;gap:8px;font-family:var(--display);font-size:13px"><span style="width:10px;height:10px;background:' + (on ? l[2] : "#1E252E") + '"></span>' + l[1] + "</button>";
    });
    html += '</div></div><div class="panel map-scroll">' + m.svg + "</div>";
    html += '<p class="legend-note">' + m.n + " expériences placées (O₂ connu, entre 10 et 40 %), légèrement dispersées horizontalement pour la lisibilité. ";
    html += mapState.proj === "gravity"
      ? "Bande orange : limite d'inflammabilité du " + esc(D.limit_band.material) + " à " + num(D.limit_band.pressure_kpa, 1) + " kPa, entre le dernier essai éteint et le premier essai stable à chaque niveau de gravité (" + esc(SRC[D.limit_band.source_id].title.split(",")[0]) + ", valeurs lues sur la figure, essais de 5 s). La pression n'est pas représentée sur cette projection."
      : "Le marqueur martien n'apparaît pas : son atmosphère n'est pas définie.";
    html += "</p></section>";

    html += '<aside class="side" style="display:flex;flex-direction:column;gap:28px"><section aria-label="Lecture" style="display:flex;flex-direction:column;gap:16px"><div class="eyebrow">Lecture</div>';
    html += '<div class="stat"><b>' + st.micro + "</b><span>sources avec des mesures en microgravité. La colonne de gauche est éclairée.</span></div>";
    html += '<div class="stat"><b>' + st.partialN + "</b><span>essais en gravité partielle, issus de " + st.partialSrc + " sources, tous en tour de chute, vol parabolique ou fusée : de 5 s à environ 2,5 min. Entre 0 et 1 g, presque l’obscurité.</span></div>";
    html += '<div class="stat"><b class="fire">↓</b><span>La limite d’inflammabilité du PMMA est au plus bas vers ' + num(st.minG) + " g, près de la gravité lunaire : moins de gravité ne veut pas dire moins de feu.</span></div></section>";
    html += '<section aria-label="Scénarios" style="display:flex;flex-direction:column"><div class="eyebrow" style="margin-bottom:8px">Scénarios · habitat lunaire</div>';
    D.scenarios.forEach(function (sc) {
      var a = answerFor(sc.scenario_id, "lune");
      html += '<a class="list-link" href="#scenario/' + sc.scenario_id + '/lune"><span>' + esc(sc.title) + '</span><span aria-label="Confiance ' + esc(CONF_WORD[a.confidence]) + '">' + lumens(confLevel(a)) + "</span></a>";
    });
    html += '<a class="mono small" style="margin-top:16px;padding:10px 0" href="#sources">SOURCES DE DONNÉES →</a></section></aside></div>';
    main.innerHTML = html;
    main.querySelectorAll("[data-proj]").forEach(function (b) { b.addEventListener("click", function () { mapState.proj = b.dataset.proj; viewCarte(); }); });
    main.querySelectorAll("[data-layer]").forEach(function (b) { b.addEventListener("click", function () { mapState[b.dataset.layer] = !mapState[b.dataset.layer]; viewCarte(); }); });
  }

  // ============================================================= SCÉNARIO
  function compCells(a) {
    var c = a.components;
    var cov = c.coverage >= 0.35 ? 4 : c.coverage >= 0.2 ? 3 : c.coverage >= 0.1 ? 2 : c.coverage > 0.01 ? 1 : 0;
    var grav = c.gravity_factor >= 1 ? 4 : c.gravity_factor >= 0.5 ? 2 : 1;
    var nn = c.n_neighbors >= 10 ? 4 : c.n_neighbors >= 5 ? 3 : c.n_neighbors >= 3 ? 2 : c.n_neighbors >= 1 ? 1 : 0;
    return [
      ["Couverture des conditions (κ)", num(c.coverage), cov],
      ["Régime de gravité : " + (GRAV_STATUS[c.gravity_regime] || c.gravity_regime), "γ = " + num(c.gravity_factor), grav],
      ["Qualité des sources", num(c.source_quality), Math.round(c.source_quality * 4)],
      ["Nombre d’expériences voisines", String(c.n_neighbors), nn],
      ["Accord entre voisines", num(c.agreement), Math.round(c.agreement * 4)]
    ];
  }
  function unitFor(qt) { return qt === "smoke_particle_size" ? " µm" : ""; }
  function fmtVal(qt, v) { return qt === "wire_limiting_oxygen" ? pct(v) : num(v, 3) + unitFor(qt); }

  function answerText(sc, a, ctx) {
    var qt = sc.question_type, o = a.observations, parts = [];
    if (a.prediction != null) {
      var p = typeof a.prediction === "string" ? (CLASS_WORD[a.prediction] || a.prediction) : fmtVal(qt, a.prediction);
      parts.push("Modèle (" + a.model.name + ") : " + p + ".");
    }
    if (o.counts) {
      var tot = 0; Object.keys(o.counts).forEach(function (k) { tot += o.counts[k]; });
      var top = Object.keys(o.counts).sort(function (x, y) { return o.counts[y] - o.counts[x]; });
      parts.push("Parmi les " + tot + " expériences les plus proches de ce cas : " + top.map(function (k) { return o.counts[k] + " « " + (CLASS_WORD[k] || k) + " »"; }).join(", ") + ".");
    } else if (o.median != null) {
      parts.push("Les expériences les plus proches donnent " + fmtVal(qt, o.min) + " à " + fmtVal(qt, o.max) + " (médiane " + fmtVal(qt, o.median) + ").");
    }
    if (qt === "wire_limiting_oxygen" && ctx.conditions.o2_mole_fraction != null && o.max != null) {
      var above = ctx.conditions.o2_mole_fraction > o.max;
      parts.push("L’oxygène de ce contexte (" + pct(ctx.conditions.o2_mole_fraction) + ") est " + (above ? "au-dessus de" : "dans") + " cette plage : " + (above ? "une flamme peut se propager le long du câble." : "la marge est incertaine."));
    }
    if (o.delta_o2_pts) {
      var d = o.delta_o2_pts.slice().sort(function (x, y) { return x - y; });
      parts.push("Écart de limite d’oxygène par rapport au test à 1 g : de " + num(d[0]) + " à " + num(d[d.length - 1]) + " point(s) (négatif : brûle avec moins d’oxygène qu’à 1 g).");
    }
    if (qt === "smoke_particle_size" && o.median != null) {
      parts.push("Des particules de quelques dixièmes de micromètre sont mal vues par les détecteurs optiques réglés pour la fumée terrestre ; aucun déclenchement d’alarme n’est enregistré dans ces données.");
    }
    if (!o.n) parts.push("Aucune expérience exploitable pour ce cas.");
    return parts.join(" ");
  }
  function whyText(a) {
    var s = "Confiance " + CONF_WORD[a.confidence].toLowerCase() + " : preuves " + EVID_WORD[a.evidence_axis] + ", accord " + AGR_WORD[a.agreement_axis] + ".";
    var c = a.ceilings_applied.filter(function (k) { return CEIL_WORD[k]; }).map(function (k) { return CEIL_WORD[k]; });
    if (c.length) s += " Plafonds : " + c.join(" ; ") + ".";
    if (a.model && a.model.name && a.model.cv_score != null) {
      s += " Modèle " + a.model.name + " en validation croisée groupée : " + num(a.model.cv_score, 3) + " contre " + num(a.model.baseline_score, 3) + " pour la référence" +
        (a.model.shown ? " (affiché)." : " (non affiché).");
    }
    return s;
  }
  var CAPTION = {
    terre: "À 1 g, l’air chaud monte et refroidit la flamme : elle vacille. Sur LUCI, la flamme du tissu SIBAL s’éteint environ 45 s plus tôt à 1 g qu’en gravité partielle (Ferkul 2025, p. 34).",
    iss: "Microgravité : flamme sphérique et bleue. Sa survie dépend de la ventilation.",
    gateway: "Microgravité, plus d’oxygène et moins de pression qu’à bord de l’ISS : une combinaison peu testée.",
    lune: "Vol parabolique : le tissu SIBAL brûle de façon stable vers le bas pendant les 20 s de gravité lunaire, à 0,086 cm/s (Ferkul 2026, p. 21-22).",
    mars: "Fils gainés : en gravité martienne, la limite de propagation sur âme NiCr remonte à 17-18 % d’O₂ (Konno 2023, fig. 2). Atmosphère d’habitat : inconnue."
  };
  function flame(cid) {
    if (cid === "iss" || cid === "gateway") return '<div class="fl-micro"></div>';
    if (cid === "terre") return '<div class="fl-earth"><i></i></div>';
    if (cid === "lune") return '<div class="fl-moon"><i></i></div>';
    return '<div class="fl-mars">?</div>';
  }
  function evidenceItem(ev) {
    var det = D.evidence_details[ev.experiment_id] || {};
    var src = SRC[ev.source_id] || { title: ev.source_id };
    var where = det.provenance_file ? det.provenance_file + (det.provenance_page ? ", p. " + det.provenance_page : "") + (det.provenance_row ? ", ligne " + det.provenance_row : "") : "";
    var meta = [PLATFORM_WORD[det.platform] || det.platform, det.gravity_g != null ? num(det.gravity_g, 3) + " g" : null,
      det.o2_mole_fraction != null ? "O₂ " + pct(det.o2_mole_fraction) : null, det.pressure_kpa != null ? num(det.pressure_kpa, 1) + " kPa" : null, det.fuel].filter(Boolean).join(" · ");
    return '<div class="ev"><span class="rank">' + String(ev.relevance_rank).padStart(2, "0") + '</span><div style="display:flex;flex-direction:column;gap:6px;min-width:0">' +
      '<span class="t">' + esc(src.title) + '</span><span class="m">' + esc(meta) + '</span><span class="f">' + esc(det.notes || "") + '</span><span class="m">' + esc(ev.experiment_id + (where ? " · " + where : "")) + "</span></div></div>";
  }

  function viewScenario(sid, cid) {
    sid = SCN[sid] ? sid : "s6";
    cid = CTX[cid] ? cid : "lune";
    var sc = SCN[sid], ctx = CTX[cid], c = ctx.conditions, ref = !ctx.computed;
    var a = ref ? null : answerFor(sid, cid);
    var html = '<nav class="tabs" aria-label="Scénarios">';
    D.scenarios.forEach(function (s) { html += '<a href="#scenario/' + s.scenario_id + "/" + cid + '"' + (s.scenario_id === sid ? ' aria-current="true"' : "") + ">" + esc(s.title) + "</a>"; });
    html += "</nav>";
    html += '<div style="display:flex;flex-direction:column;gap:14px"><div class="eyebrow">Scénario ' + sid.toUpperCase() + " · risque " + ["", "faible", "modéré", "élevé"][sc.risk_level] + '</div><h1 class="hero">' + esc(sc.question) + "</h1>";
    html += '<div class="chips"><span>g = ' + (c.gravity_g === 0 ? "≈ 0 (microgravité)" : num(c.gravity_g)) + "</span><span>O₂ = " + pct(c.o2_mole_fraction) + "</span><span>P = " + (c.pressure_kpa == null ? "[à définir]" : num(c.pressure_kpa, 1) + " kPa") + "</span>";
    sc.assumptions.forEach(function (h) { html += '<span class="assume" title="Hypothèse du scénario, pas une donnée">hypothèse : ' + esc(h) + "</span>"; });
    html += "</div></div>";

    html += '<section aria-label="Contexte de mission" style="display:flex;flex-direction:column;gap:12px"><div class="eyebrow">Transporter le scénario · la descente de confiance</div><div class="ctx-strip">';
    CTX_ORDER.forEach(function (k, i) {
      var cx = CTX[k], aa = cx.computed ? answerFor(sid, k) : null;
      html += '<a href="#scenario/' + sid + "/" + k + '"' + (k === cid ? ' aria-current="true"' : "") + ' aria-label="' + esc(cx.label) + (aa ? ", confiance " + CONF_WORD[aa.confidence] : ", référence") + '">' +
        '<span class="name"><b>' + esc(cx.label) + "</b><span>" + (cx.computed ? "0" + i : "RÉF.") + "</span></span>" + (aa ? lumens(confLevel(aa), "wide") : '<span class="small muted">certification</span>') + "</a>";
    });
    html += "</div></section>";

    html += '<div class="row" style="align-items:stretch"><section class="grow" aria-label="Réponse" style="display:flex;flex-direction:column;gap:24px">';
    if (ref) {
      var n1g = D.experiments.filter(function (e) { return e.gravity_regime === "earth"; }).length;
      html += '<div class="level">' + lumens(4, "big") + '<div style="display:flex;flex-direction:column;gap:4px"><span class="eyebrow">Cadre de certification</span><span class="level-word">Référence</span></div></div>';
      html += '<p class="answer">C’est ici que les matériaux sont certifiés : NASA-STD-6001, test 1, à 1 g. Le matériau est exposé à une flamme ; il échoue si la flamme dépasse 15 cm ou produit des débris enflammés.</p>';
      html += '<p class="why">Point de comparaison, non calculé par le moteur. Le corpus contient ' + n1g + " essais à 1 g (essais au sol de Saffire-II et LUCI, références des articles), qui servent de base aux écarts mesurés ailleurs.</p>";
    } else {
      html += '<div class="level">' + lumens(confLevel(a), "big") + '<div style="display:flex;flex-direction:column;gap:4px"><span class="eyebrow">Confiance</span><span class="level-word">' + CONF_WORD[a.confidence] + "</span></div></div>";
      html += '<p class="answer">' + esc(answerText(sc, a, ctx)) + "</p>";
      html += '<p class="why">' + esc(whyText(a)) + "</p>";
      html += '<span class="small muted">Texte rédigé par règles à partir de la sortie du moteur : aucun chiffre n’est produit par un modèle de langue. Les valeurs viennent des expériences citées plus bas.</span>';
      html += '<div><div class="eyebrow" style="padding-bottom:10px">Décomposition</div>';
      compCells(a).forEach(function (r) { html += '<div class="comp"><span>' + r[0] + '</span><span class="val">' + r[1] + '</span><span class="lumens wide" aria-label="' + r[0] + " : " + r[2] + ' sur 4">' + lumens(r[2], "wide").replace(/^<span class="lumens wide" aria-hidden="true">|<\/span>$/g, "") + "</span></div>"; });
      html += "</div>";
    }
    html += '</section><aside class="side flame-box" aria-label="Comportement de la flamme"><div class="flame-stage">' + flame(cid) + '</div><div class="flame-cap"><span class="eyebrow">Ce que montrent les essais</span><span>' + esc(CAPTION[cid]) + "</span></div></aside></div>";

    if (!ref) {
      html += '<div class="row"><section class="grow" aria-label="Preuves" style="display:flex;flex-direction:column"><div class="eyebrow" style="padding-bottom:10px">Preuves, par pertinence</div>';
      if (!a.evidence.length) html += '<p class="muted">Aucune expérience voisine.</p>';
      a.evidence.forEach(function (ev) { html += evidenceItem(ev); });
      if (a.observations.n > a.evidence.length) html += '<p class="small muted">' + a.observations.n + " expériences voisines au total, dont les " + a.evidence.length + " premières sont listées.</p>";
      html += '<a class="mono small" style="margin-top:8px;padding:10px 0" href="#sources">TOUTES LES SOURCES →</a></section>';
      html += '<section class="side missing" aria-label="Ce qui manque"><span class="eyebrow" style="color:var(--fire)">Ce qui manque</span><ul>';
      (a.gaps.length ? a.gaps : ["Rien de bloquant identifié par le moteur pour ce cas."]).forEach(function (g) { html += "<li>" + esc(g) + "</li>"; });
      html += '</ul><a class="btn" href="#priorites/' + cid + '">Voir les priorités →</a></section></div>';
    }
    main.innerHTML = html;
  }

  // ============================================================ PRIORITÉS
  function viewPriorites(cid) {
    cid = ["iss", "gateway", "lune", "mars"].indexOf(cid) >= 0 ? cid : "lune";
    var rows = D.priorities.filter(function (p) { return p.context_id === cid; });
    rows.sort(function (x, y) { return y.risk_level * (4 - y.knowledge_rank) - x.risk_level * (4 - x.knowledge_rank) || x.scenario_id.localeCompare(y.scenario_id); });
    var html = '<div class="row" style="justify-content:space-between;align-items:flex-end;gap:24px"><h1 class="hero">Les angles morts. <span>Ce qu’il faut étudier en premier.</span></h1><div class="seg" role="group" aria-label="Contexte de mission">';
    ["iss", "gateway", "lune", "mars"].forEach(function (k) { html += '<button type="button" data-ctx="' + k + '" aria-pressed="' + (k === cid) + '">' + esc(CTX[k].label.toUpperCase()) + "</button>"; });
    html += '</div></div><div class="row"><section class="grow" aria-label="Matrice risque et connaissance" style="display:flex;flex-direction:column;gap:10px"><div class="matrix"><div class="q-dark"></div><div class="q-lit"></div>';
    html += '<span class="lab" style="left:20px;top:16px;color:var(--fire)">ANGLE MORT · RISQUE ÉLEVÉ, PEU DE CONNAISSANCE</span><span class="lab" style="right:20px;bottom:16px;color:var(--light)">SOUS CONTRÔLE</span>';
    var seen = {};
    rows.forEach(function (p, i) {
      var k = seen[p.risk_level] || 0;
      seen[p.risk_level] = k + 1;
      var left = 8 + p.knowledge_rank * 24, top = (p.risk_level === 3 ? 14 : 62) + k * 10, lit = p.knowledge_rank >= 2;
      html += '<a class="dot" href="#scenario/' + p.scenario_id + "/" + cid + '" style="left:' + left + "%;top:" + top + '%"><i style="background:' + (lit ? "#CFE8FF" : "#FF7A2F") + ";box-shadow:0 0 12px " + (lit ? "rgba(207,232,255,.6)" : "rgba(255,122,47,.55)") + '"></i><span>' + String(i + 1).padStart(2, "0") + " · " + esc(SCN[p.scenario_id].title.split(/[:,]/)[0]) + "</span></a>";
    });
    html += '</div><div class="mono small muted" style="display:flex;justify-content:space-between"><span>← OBSCURITÉ</span><span>CONNAISSANCE (confiance du moteur)</span><span>LUMIÈRE →</span></div><span class="small muted">Axe vertical : niveau de risque du scénario (proposition de l’équipe). Axe horizontal : confiance calculée.</span></section>';
    html += '<section class="side" aria-label="Classement"><div class="eyebrow" style="padding-bottom:10px">Classement · risque × obscurité</div>';
    rows.forEach(function (p, i) {
      html += '<a class="rank-row" href="#scenario/' + p.scenario_id + "/" + cid + '"><b' + (i === 0 ? ' class="first"' : "") + ">" + String(i + 1).padStart(2, "0") + '</b><span style="display:flex;flex-direction:column;gap:4px;min-width:0"><span style="font-size:16px;font-weight:600;line-height:1.3">' + esc(SCN[p.scenario_id].title) + '</span><span class="small muted">Risque ' + ["", "faible", "modéré", "élevé"][p.risk_level] + " · confiance " + CONF_WORD[p.confidence].toLowerCase() + (p.blind_spot ? " · angle mort" : "") + "</span></span></a>";
    });
    html += "</section></div>";

    // Quoi étudier ensuite : manques regroupés sur tous les scénarios et contextes
    var gaps = {};
    D.answers.forEach(function (a) {
      if (a.context_id !== cid) return;
      a.gaps.forEach(function (g) {
        if (/^Pas de modèle|^Le modèle|^Prédiction masquée/.test(g)) return;
        var key = g.replace(/\s*Première mesure.*$/, "");
        gaps[key] = gaps[key] || { text: g, scen: {}, risk: 0 };
        gaps[key].scen[a.scenario_id] = 1;
        gaps[key].risk = Math.max(gaps[key].risk, SCN[a.scenario_id].risk_level);
      });
    });
    var list = Object.keys(gaps).map(function (k) { var g = gaps[k]; g.n = Object.keys(g.scen).length; return g; })
      .sort(function (x, y) { return y.n - x.n || y.risk - x.risk; }).slice(0, 6);
    html += '<section aria-label="Quoi étudier ensuite" style="display:flex;flex-direction:column;gap:4px"><div class="row" style="justify-content:space-between;align-items:baseline;gap:12px;padding-bottom:12px"><h2 class="section">Quoi étudier ensuite</h2><span class="small muted">Manques relevés par le moteur pour ce contexte, classés par nombre de scénarios qu’une nouvelle expérience éclairerait.</span></div>';
    list.forEach(function (g, i) {
      html += '<div class="study"><b>' + String(i + 1).padStart(2, "0") + '</b><span style="font-size:17px;font-weight:600;line-height:1.4">' + esc(g.text) + '</span><span style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">' + lumens(g.n, "", 6) + '<span class="mono small muted">' + g.n + " scénario" + (g.n > 1 ? "s" : "") + " éclairé" + (g.n > 1 ? "s" : "") + "</span></span></div>";
    });
    html += "</section>";
    main.innerHTML = html;
    main.querySelectorAll("[data-ctx]").forEach(function (b) { b.addEventListener("click", function () { location.hash = "#priorites/" + b.dataset.ctx; }); });
  }

  // ============================================================== SOURCES
  function viewSources() {
    var counts = {};
    D.experiments.forEach(function (e) { counts[e.source_id] = (counts[e.source_id] || 0) + 1; });
    var KIND = { psi_dataset: "jeu PSI", article: "article", report: "rapport", standard: "norme", upcoming: "à venir" };
    var ACC = { open: "libre", restricted: "restreint", pending: "en attente" };
    var html = '<h1 class="hero">Sources. <span>D’où vient chaque valeur.</span></h1><div class="table-scroll"><table class="src"><thead><tr><th>SOURCE</th><th>TYPE</th><th>ACCÈS</th><th>ESSAIS</th><th>RÉFÉRENCE</th></tr></thead><tbody>';
    D.sources.forEach(function (s) {
      var ref = esc(s.reference || "").replace(/(https?:\/\/[^\s;]+)/g, '<a href="$1" rel="noopener" target="_blank">$1</a>');
      html += "<tr><td>" + esc(s.title) + (s.year ? ' <span class="muted">(' + s.year + ")</span>" : "") + "</td><td>" + KIND[s.kind] + '</td><td><span class="tag ' + s.access + '">' + ACC[s.access] + "</span></td><td class=\"mono\">" + (counts[s.source_id] || "—") + "</td><td class=\"small\">" + ref + "</td></tr>";
    });
    html += "</tbody></table></div><p class=\"small muted\">Inaccessibles : MAPTIS (base de certification des matériaux) et les portails ACME et Saffire de NASA Glenn. Le bucket AWS Open Data de PSI ne contient pas la combustion.</p>";
    main.innerHTML = html;
  }

  // ================================================================ rendu
  function render() {
    var r = route();
    renderNav(r.view === "sources" ? "" : r.view);
    if (r.view === "scenario") viewScenario(r.a, r.b);
    else if (r.view === "priorites") viewPriorites(r.a);
    else if (r.view === "sources") viewSources();
    else viewCarte();
    window.scrollTo(0, 0);
  }
  document.getElementById("disclaimer").textContent = D.disclaimer;
  window.addEventListener("hashchange", render);
  render();
})();
