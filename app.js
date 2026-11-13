(() => {
  const POLL_MS = 20000;
  const $ = (sel) => document.querySelector(sel);

  let boardData = null;
  let selectedTicker = null;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function md(s) {
    return esc(String(s ?? ""))
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:]|$)/g, "$1<em>$2</em>")
      .replace(/\*+/g, "")
      .replace(/\s*(→|->)\s*/g, " → ");
  }

  function fmtUsd(n) {
    if (n == null || Number.isNaN(Number(n))) return null;
    const v = Number(n);
    const abs = Math.abs(v);
    if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  }

  function fmtPx(n, digits = 2) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return `$${Number(n).toFixed(digits)}`;
  }

  function ticketClass(t) {
    const v = (t || "").toLowerCase();
    if (v === "open") return "open";
    if (v === "filled") return "filled";
    return "";
  }

  function chipClass(c) {
    const raw = String(c || "");
    if (raw.toUpperCase().includes("PUT-SALE")) return "PUT-SALE";
    return raw.replace(/\s+/g, "-").toUpperCase();
  }

  function renderChips(chips) {
    return (chips || [])
      .map((c) => {
        const cls = chipClass(c);
        return `<span class="chip ${esc(cls)}" data-chip="${esc(c)}">${esc(c)}</span>`;
      })
      .join("");
  }

  function renderSpark(candles) {
    if (!candles || !candles.length) {
      return `<div class="spark empty-spark" title="No daily bars">—</div>`;
    }
    const W = 120;
    const H = 40;
    const padT = 3;
    const padB = 3;
    const padL = 2;
    const padR = 2;
    const n = candles.length;
    const highs = candles.map((b) => Number(b.h));
    const lows = candles.map((b) => Number(b.l));
    let lo = Math.min(...lows);
    let hi = Math.max(...highs);
    if (!(hi > lo)) hi = lo + 1;
    const plotH = H - padT - padB;
    const plotW = W - padL - padR;
    const slot = plotW / n;
    const bodyW = Math.max(1.2, Math.min(3.5, slot * 0.55));
    const yOf = (v) => padT + ((hi - v) / (hi - lo)) * plotH;
    const sticks = candles
      .map((b, i) => {
        const x = padL + slot * i + slot / 2;
        const o = Number(b.o);
        const c = Number(b.c);
        const up = c >= o;
        const yO = yOf(o);
        const yC = yOf(c);
        const yH = yOf(Number(b.h));
        const yL = yOf(Number(b.l));
        const top = Math.min(yO, yC);
        const bot = Math.max(yO, yC);
        const bh = Math.max(1, bot - top);
        const cls = up ? "up" : "dn";
        return (
          `<line class="wick ${cls}" x1="${x.toFixed(2)}" y1="${yH.toFixed(2)}" x2="${x.toFixed(2)}" y2="${yL.toFixed(2)}" />` +
          `<rect class="body ${cls}" x="${(x - bodyW / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${bodyW.toFixed(2)}" height="${bh.toFixed(2)}" />`
        );
      })
      .join("");
    const pts = [];
    candles.forEach((b, i) => {
      if (b.ema8 == null) return;
      const x = padL + slot * i + slot / 2;
      pts.push(`${x.toFixed(2)},${yOf(Number(b.ema8)).toFixed(2)}`);
    });
    const emaPath =
      pts.length >= 2
        ? `<polyline class="ema8" points="${pts.join(" ")}" />`
        : "";
    return `<div class="spark"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${sticks}${emaPath}</svg></div>`;
  }

  function renderBoardRow(name) {
    const chips = renderChips(name.chips);
    return `<button type="button" class="board-row" data-ticker="${esc(name.ticker)}" aria-label="Open ${esc(name.ticker)} detail">
      <span class="board-rank">#${esc(name.rank)}</span>
      <span class="board-ticker">${esc(name.ticker)}</span>
      <div class="board-mid">
        <div class="board-chips">${chips}</div>
        <div class="board-why">${md(name.why || "—")}</div>
      </div>
      <div class="board-scores">
        <div><span class="comp">${esc(name.composite)}</span></div>
        <div>F <strong>${esc(name.flow)}</strong></div>
        <div>T <strong>${esc(name.tech)}</strong></div>
      </div>
      <div class="board-spark">${renderSpark(name.candles)}</div>
    </button>`;
  }

  function renderWatch(items) {
    if (!items || !items.length) return "";
    const cards = items
      .map((w) => {
        const tc = ticketClass(w.ticket);
        return `<div class="watch-card">
          <div class="wt">${esc(w.ticker)}</div>
          <div class="wd">${esc(w.date || "")}</div>
          <div class="wtitle">${esc(w.title || "")}</div>
          <div class="wstruct">${esc(w.structure || "")}</div>
          ${tc ? `<span class="ticket-pill ${tc}">${esc(w.ticket)}</span>` : ""}
        </div>`;
      })
      .join("");
    return `<h2 class="section-title">Spotlight watch (lookback)</h2>
      <div class="watch-strip">${cards}</div>`;
  }

  function statusPill(status) {
    const s = (status || "open").toLowerCase();
    let label = s.replace(/_/g, " ");
    if (s === "real") label = "REAL";
    else if (s === "from_dossier") label = "DOSSIER";
    else if (s === "from_volland") label = "VOLLAND";
    else if (s === "not_on_desk") label = "NOT ON DESK";
    else label = "OPEN";
    return `<span class="status-pill ${esc(s)}">${esc(label)}</span>`;
  }

  function buildDetailChart(name) {
    const bars = name.chart || name.candles || [];
    const levels = name.levels || {};
    if (!bars.length) {
      return `<div class="chart-wrap"><div class="chart-empty">No RH daily bars on board</div></div>`;
    }
    const W = 640;
    const H = 220;
    const padL = 48;
    const padR = 64;
    const padT = 12;
    const padB = 24;
    const closes = bars.map((b) => Number(b.c));
    const highs = bars.map((b) => Number(b.h));
    const lows = bars.map((b) => Number(b.l));
    const guides = [
      { key: "spot", val: levels.spot, color: "#3dd68c", dash: "", label: "Spot" },
      ...(name.trade_lines || []).map((t) => ({
        key: t.kind,
        val: t.value,
        color: t.kind === "put" ? "#ff6b6b" : t.kind === "target" ? "#5b9cff" : t.kind === "longput" ? "#c084fc" : "#f5a623",
        dash: t.kind === "target" ? "2 3" : "5 4",
        label: t.label,
        note: t.note,
      })),
    ].filter((g) => g.val != null && !Number.isNaN(Number(g.val)));

    let lo = Math.min(...lows);
    let hi = Math.max(...highs);
    for (const g of guides) {
      lo = Math.min(lo, Number(g.val));
      hi = Math.max(hi, Number(g.val));
    }
    // include ema series in range
    for (const b of []) {
      for (const k of []) {
        if (b[k] != null) {
          lo = Math.min(lo, Number(b[k]));
          hi = Math.max(hi, Number(b[k]));
        }
      }
    }
    const pad = (hi - lo) * 0.06 || 1;
    lo -= pad;
    hi += pad;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const n = bars.length;
    const xOf = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const yOf = (v) => padT + ((hi - v) / (hi - lo)) * plotH;

    // close line
    const linePts = closes
      .map((c, i) => `${xOf(i).toFixed(2)},${yOf(c).toFixed(2)}`)
      .join(" ");
    const areaPts =
      `${xOf(0).toFixed(2)},${(padT + plotH).toFixed(2)} ` +
      linePts +
      ` ${xOf(n - 1).toFixed(2)},${(padT + plotH).toFixed(2)}`;

    const guideLines = guides
      .map((g) => {
        const y = yOf(Number(g.val));
        return `
          <line x1="${padL}" y1="${y.toFixed(2)}" x2="${(W - padR).toFixed(2)}" y2="${y.toFixed(2)}"
            stroke="${g.color}" stroke-width="1.25" stroke-dasharray="${g.dash}" opacity="0.85" />
          <text x="${(W - padR + 4).toFixed(2)}" y="${(y + 3).toFixed(2)}" fill="${g.color}"
            font-size="9" font-family="IBM Plex Mono, monospace">${esc(g.label)} ${fmtPx(g.val)}${g.note ? `<title>${esc(g.note)}</title>` : ""}</text>`;
      })
      .join("");

    // optional EMA8 polyline overlay (series)
    const emaPts = [];
    [].forEach((b, i) => {
      emaPts.push(`${xOf(i).toFixed(2)},${yOf(Number(b.ema8)).toFixed(2)}`);
    });
    const emaPoly =
      emaPts.length >= 2
        ? `<polyline fill="none" stroke="#f5a623" stroke-width="1" opacity="0.35" points="${emaPts.join(" ")}" />`
        : "";

    const yTicks = [lo, (lo + hi) / 2, hi]
      .map((v) => {
        const y = yOf(v);
        return `<text x="${padL - 6}" y="${(y + 3).toFixed(2)}" text-anchor="end" fill="#5a6d8a" font-size="9" font-family="IBM Plex Mono, monospace">${Number(v).toFixed(1)}</text>
          <line x1="${padL}" y1="${y.toFixed(2)}" x2="${(W - padR).toFixed(2)}" y2="${y.toFixed(2)}" stroke="#1a2740" stroke-width="1" />`;
      })
      .join("");

    const first = bars[0].date || "";
    const last = bars[bars.length - 1].date || "";
    const legend = `
      <span class="lg-spot">Spot</span>
      ${(name.trade_lines || []).map((t) => `<span style="color:${t.kind === "put" ? "#ff6b6b" : t.kind === "target" ? "#5b9cff" : t.kind === "longput" ? "#c084fc" : "#f5a623"}" title="${esc(t.note || "")}">${esc(t.label)} ${fmtPx(t.value)}</span>`).join(" ")}
      ${(name.trade_lines || []).length ? "" : `<span style="color:var(--dim)">no strike levels in flow</span>`}
    `;

    return `<div class="chart-wrap">
      <div class="chart-head">
        <h3>~6-month price · RH daily</h3>
        <div class="chart-legend">${legend}</div>
      </div>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="6-month price chart">
        ${yTicks}
        <polygon points="${areaPts}" fill="rgba(61,214,140,0.08)" />
        <polyline fill="none" stroke="#3dd68c" stroke-width="1.75" points="${linePts}" />
        ${emaPoly}
        ${guideLines}
      </svg>
      <div class="chart-foot">
        <span>${esc(first)} → ${esc(last)} · ${n}d</span>
        <span>as of ${esc(levels.as_of || last)} · ${esc((levels.source || "").split("+")[0].trim() || "RH")}</span>
      </div>
    </div>`;
  }

  function panelStatus(panel) {
    if (!panel || typeof panel !== "object") return "open";
    return panel.status || "open";
  }

  function renderFlowIntel(name) {
    const p = name.panels || {};
    const trade = p.trade_summary || {};
    const iv = p.iv_catalyst || {};
    const oi = p.oi_volland || p.oi_gex || {};
    const tech = p.technical || {};
    const fund = p.fundamental || {};
    const thesis = p.thesis_one_liner || name.thesis_one_liner;
    const spot = p.spotlight || name.spotlight;

    const prints = (trade.top_prints || [])
      .map((x) => `<li>${md(x)}</li>`)
      .join("");

    const ivBody =
      panelStatus(iv) === "open"
        ? `<p><strong>OPEN</strong> — ${esc(iv.summary || "IV not on desk.")}</p>
           <p class="note">${esc(iv.note || "")}</p>`
        : `<p>${esc(iv.summary || "")}</p>
           ${iv.as_of ? `<p class="note">as of ${esc(iv.as_of)} · ${esc(iv.note || "")}</p>` : `<p class="note">${esc(iv.note || "")}</p>`}`;

    function parseLevelsFallback(str) {
      const out = { pos: [], neg: [] };
      if (!str) return out;
      const norm = String(str).replace(/[−–]/g, "-");
      let left = norm;
      let right = "";
      if (norm.includes("|")) {
        const parts = norm.split("|");
        left = parts[0];
        right = parts.slice(1).join("|");
      } else {
        const m = /;\s*(?=-\s*\d)/.exec(norm);
        if (m) {
          left = norm.slice(0, m.index);
          right = norm.slice(m.index + 1);
        }
      }
      const re = /([+\-]?\s*\d+(?:\.\d+)?)\s*\$\s*-?\s*([\d,.]+)\s*([KkMmBb])?/g;
      function side(chunk, defaultSign) {
        const items = [];
        let m;
        const cleaned = String(chunk || "").replace(/^[+:\s-]+/, "");
        while ((m = re.exec(cleaned))) {
          let raw = m[1].replace(/\s+/g, "");
          let sign = defaultSign;
          if (raw.startsWith("+")) { sign = "+"; raw = raw.slice(1); }
          else if (raw.startsWith("-")) { sign = "-"; raw = raw.slice(1); }
          const strike = Number(raw);
          if (Number.isNaN(strike)) continue;
          let num = Number(String(m[2]).replace(/,/g, ""));
          const suf = (m[3] || "").toUpperCase();
          const mult = suf === "B" ? 1e9 : suf === "M" ? 1e6 : suf === "K" ? 1e3 : 1;
          const usd = Math.abs(num) * mult;
          if (!(usd > 0)) continue;
          items.push({ strike, usd, display: fmtUsd(usd) || ("$" + usd), sign });
        }
        re.lastIndex = 0;
        return items;
      }
      out.pos = side(left, "+");
      out.neg = side(right, "-");
      return out;
    }

    function levelList(s, kind) {
      // kind: gamma_pos | gamma_neg | vanna_pos | vanna_neg
      const direct = s[kind];
      if (Array.isArray(direct) && direct.length) return direct;
      const group = kind.startsWith("gamma") ? (s.gamma_levels || {}) : (s.vanna_levels || {});
      const side = kind.endsWith("_pos") ? "pos" : "neg";
      if (Array.isArray(group[side]) && group[side].length) return group[side];
      const raw = kind.startsWith("gamma") ? s.gamma : s.vanna;
      const parsed = parseLevelsFallback(raw);
      return parsed[side] || [];
    }

    function renderStrikeBars(items, tone) {
      if (!items || !items.length) return `<div class="oi-empty-levels">—</div>`;
      const max = Math.max(...items.map((x) => Number(x.usd) || 0), 1);
      return `<div class="oi-bars">${items
        .slice(0, 6)
        .map((it) => {
          const pct = Math.max(6, Math.round((Number(it.usd) / max) * 100));
          const strike = Number(it.strike);
          const label = Number.isInteger(strike) ? strike.toFixed(0) : String(strike);
          const disp = esc(it.display || fmtUsd(it.usd) || "");
          return `<div class="oi-bar-row ${tone}">
            <span class="oi-strike">${esc(label)}</span>
            <span class="oi-bar-track"><span class="oi-bar-fill" style="width:${pct}%"></span></span>
            <span class="oi-bar-val">${disp}</span>
          </div>`;
        })
        .join("")}</div>`;
    }


    function strikeFromCoord(raw) {
      if (raw == null || raw === "") return null;
      const t = String(raw).trim();
      if (/^open$/i.test(t)) return null;
      const m = t.match(/-?\d+(?:\.\d+)?/);
      return m ? m[0] : null;
    }

    function topStrike(items) {
      if (!items || !items.length) return null;
      let best = items[0];
      for (const it of items) {
        if ((Number(it.usd) || 0) > (Number(best.usd) || 0)) best = it;
      }
      if (best.strike == null || best.strike === "") return null;
      const n = Number(best.strike);
      return Number.isFinite(n) ? String(Number.isInteger(n) ? n : n) : String(best.strike);
    }

    function decodeHorizonFoot(s, shortLabel, gPos, gNeg) {
      const support = strikeFromCoord(s.floors) || topStrike(gPos);
      const resist = strikeFromCoord(s.walls) || topStrike(gNeg);
      const pin = strikeFromCoord(s.pins);
      const bits = [];
      bits.push(support ? `Support at ${support}` : "Support OPEN");
      bits.push(resist ? `resistance at ${resist}` : "resistance OPEN");
      if (pin) bits.push(`pin at ${pin}`);
      const line = `${shortLabel}: ${bits.join(", ")}`;
      const key = "Put floor = support · Call wall = resistance · Pin = magnet";
      return `<div class="oi-levels-foot"><div class="oi-decode">${esc(line)}</div><div class="oi-decode-key">${esc(key)}</div></div>`;
    }

    function coordChip(label, value) {
      if (value) {
        return `<div class="oi-chip"><span class="oi-chip-k">${esc(label)}</span><span class="oi-chip-v">${esc(value)}</span></div>`;
      }
      return `<div class="oi-chip oi-chip-open"><span class="oi-chip-k">${esc(label)}</span><span class="oi-chip-v">OPEN</span></div>`;
    }

    function renderOiHorizon(sub, fallbackLabel) {
      const s = sub || {};
      const st = panelStatus(s);
      const label = s.label || fallbackLabel;
      let body;
      if (st === "not_on_desk" || st === "open") {
        const tag = st === "not_on_desk" ? "NOT ON DESK" : "OPEN";
        const reason = String(s.summary || "")
          .replace(/^(OPEN|NOT ON DESK)\s*[—\-]\s*/i, "")
          .trim() || (st === "open"
            ? "No Monthly OpEx / Third Friday breakout in singles."
            : "No Volland read for this horizon.");
        body = `<div class="oi-open-banner"><span class="oi-open-tag">${tag}</span><span class="oi-open-reason">${esc(reason)}</span></div>`;
      } else {
        const gPos = levelList(s, "gamma_pos");
        const gNeg = levelList(s, "gamma_neg");
        const vPos = levelList(s, "vanna_pos");
        const vNeg = levelList(s, "vanna_neg");
        body = `
          ${s.expiry ? `<div class="oi-expiry">${esc(s.expiry)}</div>` : ""}
          <div class="oi-chips">
            ${coordChip("Call wall", s.walls)}
            ${coordChip("Put floor", s.floors)}
            ${coordChip("Pin", s.pins)}
          </div>
          ${s.dealer_positioning ? `<div class="oi-dealer"><span class="oi-chip-k">Dealer</span> ${esc(s.dealer_positioning)}</div>` : ""}
          <div class="oi-greek-grid">
            <div class="oi-greek">
              <div class="oi-greek-title pos">+ Gamma</div>
              ${renderStrikeBars(gPos, "pos")}
            </div>
            <div class="oi-greek">
              <div class="oi-greek-title neg">− Gamma</div>
              ${renderStrikeBars(gNeg, "neg")}
            </div>
            <div class="oi-greek">
              <div class="oi-greek-title pos">+ Vanna</div>
              ${renderStrikeBars(vPos, "pos")}
            </div>
            <div class="oi-greek">
              <div class="oi-greek-title neg">− Vanna</div>
              ${renderStrikeBars(vNeg, "neg")}
            </div>
          </div>
          ${decodeHorizonFoot(s, /all/i.test(label) ? "All expiry" : "OpEx", gPos, gNeg)}`;
      }
      return `<div class="oi-card">
        <div class="oi-card-title"><span>${esc(label)}</span>${statusPill(st)}</div>
        <div class="oi-card-body">${body}</div>
      </div>`;
    }

    let oiBody;
    const mo = oi.monthly_opex;
    const ae = oi.all_expiry;
    if ((panelStatus(oi) === "not_on_desk" || panelStatus(oi) === "open") && !mo && !ae) {
      oiBody = `<div class="oi-open-banner"><span class="oi-open-tag">NOT ON DESK</span><span class="oi-open-reason">${esc(oi.summary || "OI / Volland not on desk.")}</span></div>`;
    } else {
      oiBody = `
        <div class="oi-meta">${oi.as_of ? `as of ${esc(oi.as_of)}` : ""}${oi.as_of && oi.source ? " · " : ""}${oi.source ? esc(String(oi.source).split("/").slice(-1)[0]) : ""}</div>
        <div class="oi-cards">
          ${renderOiHorizon(mo, "Monthly OpEx")}
          ${renderOiHorizon(ae, "All expiry")}
        </div>
      `;
    }

    const lv = (tech.levels || name.levels || {});
    const techBody = `
      <p>${md(tech.tech_why || name.tech_why || "—")}</p>
      <p class="note">Tech score ${esc(tech.tech_score ?? name.tech)}/100 ·
        spot ${fmtPx(lv.spot)} · EMA8 ${fmtPx(lv.ema8)} · EMA21 ${fmtPx(lv.ema21)} · 200-MA ${lv.sma200 != null ? fmtPx(lv.sma200) : "OPEN"}</p>
      ${tech.technicals_note ? `<p class="note">${md(tech.technicals_note)}</p>` : ""}
    `;

    const fundBody =
      panelStatus(fund) === "open"
        ? `<p><strong>OPEN</strong> — ${esc(fund.summary || "No fundamental profile.")}</p>
           ${thesis ? `<p><em>Thesis:</em> ${esc(thesis)}</p>` : ""}`
        : `<p>${esc(fund.summary || "")}</p>
           ${thesis ? `<p><em>Thesis:</em> ${esc(thesis)}</p>` : ""}`;

    let spotBody;
    if (!spot) {
      spotBody = `<p class="note">No Spotlight card on this name — —</p>`;
    } else {
      const tc = ticketClass(spot.ticket);
      spotBody = `<div class="spotlight-strip">
        <div class="sp-title">${esc(spot.title || spot.ticker || "Spotlight")}</div>
        <div class="sp-meta">
          <span>${esc(spot.date || "")}</span>
          <span>${esc(spot.structure || "")}</span>
          ${tc ? `<span class="ticket-pill ${tc}">${esc(spot.ticket)}</span>` : ""}
        </div>
      </div>`;
    }

    return `
      <div class="fi-title">Flow Intelligence</div>
      <details class="accordion" open>
        <summary>Trade / Flow Summary ${statusPill(panelStatus(trade))}</summary>
        <div class="body">
          <p><strong>${esc(name.ticker)}</strong> · ${esc(trade.structure || name.structure_bias || "—")} · conf ${esc(trade.confidence || "OPEN")}</p>
          <p>${md(trade.why || name.why || "—")}</p>
          ${trade.net_premium ? `<p>Net premium (from prints): <strong>${esc(fmtUsd(trade.net_premium.usd) || trade.net_premium.raw)}</strong></p>` : `<p class="note">Net premium: OPEN (no $ print parsed)</p>`}
          ${prints ? `<ul>${prints}</ul>` : ""}
        </div>
      </details>
      <details class="accordion">
        <summary>IV &amp; catalyst ${statusPill(panelStatus(iv))}</summary>
        <div class="body">${ivBody}</div>
      </details>
      <details class="accordion" open>
        <summary>OI / Volland ${statusPill(panelStatus(oi))}</summary>
        <div class="body">${oiBody}</div>
      </details>
      <details class="accordion" open>
        <summary>Technical Analysis ${statusPill(panelStatus(tech))}</summary>
        <div class="body">${techBody}</div>
      </details>
      <details class="accordion">
        <summary>Fundamental / thesis ${statusPill(panelStatus(fund))}</summary>
        <div class="body">${fundBody}</div>
      </details>
      <details class="accordion">
        <summary>Spotlight ${spot ? statusPill("real") : statusPill("open")}</summary>
        <div class="body">${spotBody}</div>
      </details>
    `;
  }

  function renderTradeCard(name) {
    const levels = name.levels || {};
    const prem = name.net_premium;
    const premLabel = prem ? fmtUsd(prem.usd) || prem.raw : "OPEN";
    const top = name.top_print || (name.top_prints || [])[0] || "";
    const volOi = (() => {
      const oi = (name.panels || {}).oi_volland || (name.panels || {}).oi_gex || {};
      if (name.vol_oi) return `${Number(name.vol_oi.volume).toLocaleString()} / ${Number(name.vol_oi.oi).toLocaleString()}`;
      if (oi.vol_oi) return oi.vol_oi;
      const m = String(top).match(/vol\s*[~≈]?\s*([\d,]+)\s*\/\s*OI\s*([\d,]+)/i);
      return m ? `${m[1]}/${m[2]}` : null;
    })();

    return `
      <div class="tc-header">
        <div class="tc-brand"><strong>HAWK OPTIONS</strong> · Flow Alert</div>
        <div class="tc-chips">${renderChips(name.chips)}</div>
      </div>
      <div class="tc-main">
        <div>
          <div class="tc-ticker-line">
            <span class="tc-ticker" id="detail-ticker">${esc(name.ticker)}</span>
            <span class="tc-spot">${fmtPx(levels.spot)}</span>${levels.as_of ? `<span class="tc-asof" style="font-size:10px;color:var(--dim);margin-left:6px">as of ${esc(levels.as_of)} close</span>` : ""}
          </div>
          <div class="tc-structure">${esc(name.structure_bias || "—")}${name.put_sale_only ? " · put-sale only · not a long" : ""}</div>
        </div>
        <div class="tc-premium">
          <div class="val">${esc(premLabel)}</div>
          <div class="sub">${prem ? "net premium (from prints)" : "premium OPEN"}</div>
          <div class="comp">Composite ${esc(name.composite)} · F${esc(name.flow)} / T${esc(name.tech)}</div>
        </div>
      </div>
      <div class="hawk-block">
        <h3>HAWK ANALYSIS</h3>
        <p>${md(name.hawk_analysis || "—")}</p>
      </div>
      <div class="metric-grid">
        <div class="metric-tile">
          <div class="lab">Flow</div>
          <div class="val flow">${esc(name.flow)}<span style="color:var(--dim);font-size:11px">/100</span></div>
        </div>
        <div class="metric-tile">
          <div class="lab">Tech</div>
          <div class="val tech">${esc(name.tech)}<span style="color:var(--dim);font-size:11px">/100</span></div>
        </div>
        <div class="metric-tile">
          <div class="lab">Composite</div>
          <div class="val comp">${esc(name.composite)}<span style="color:var(--dim);font-size:11px">/100</span></div>
          <div class="hint">0.65F / 0.35T</div>
        </div>
        <div class="metric-tile">
          <div class="lab">Top print $</div>
          <div class="val ${prem ? "flow" : "open"}">${esc(premLabel)}</div>
        </div>
        <div class="metric-tile">
          <div class="lab">Structure</div>
          <div class="val" style="font-size:12px">${esc(name.structure_bias || "—")}</div>
        </div>
        <div class="metric-tile">
          <div class="lab">Confidence</div>
          <div class="val">${esc(name.confidence || "OPEN")}</div>
        </div>
        <div class="metric-tile">
          <div class="lab">Vol / OI</div>
          <div class="val ${volOi ? "" : "open"}">${volOi ? esc(volOi) : "n/a"}</div>
          <div class="hint">${name.vol_oi ? esc(name.vol_oi.contract) + " · RH Oct 9" : volOi ? "from dossier/print" : "no specific contract in print"}</div>
        </div>
        <div class="metric-tile">
          <div class="lab">Spot / EMA8</div>
          <div class="val" style="font-size:12px">${fmtPx(levels.spot)} / ${fmtPx(levels.ema8)}</div>
          <div class="hint">EMA21 ${fmtPx(levels.ema21)} · 200 ${levels.sma200 != null ? fmtPx(levels.sma200) : "OPEN"}</div>
        </div>
      </div>
      ${buildDetailChart(name)}
      <div class="tc-footer">
        <div class="tc-foot-box">
          <div class="lab">Strategy bias</div>
          <div class="val">${esc((name.chips || [])[0] || name.structure_bias || "—")}</div>
        </div>
        <div class="tc-foot-box">
          <div class="lab">Condition</div>
          <div class="val">${name.put_sale_only ? "Put-sale only" : "Board filter"}</div>
        </div>
        <div class="tc-foot-box">
          <div class="lab">Rank</div>
          <div class="val">#${esc(name.rank)} · ${(name.chips || []).includes("HIGH") || (name.confidence || "").toLowerCase().startsWith("high") ? "High conf" : esc(name.confidence || "OPEN")}</div>
        </div>
      </div>
    `;
  }

  function openDetail(ticker) {
    if (!boardData) return;
    const name = (boardData.names || []).find((n) => n.ticker === ticker);
    if (!name) return;
    selectedTicker = ticker;
    const levels = name.levels || {};
    $("#detail-spot-pill").textContent = levels.spot != null ? `Spot: ${fmtPx(levels.spot)}${levels.as_of ? " · as of " + levels.as_of : ""}` : "Spot: OPEN";
    $("#trade-card").innerHTML = renderTradeCard(name);
    $("#flow-intel").innerHTML = renderFlowIntel(name);
    const overlay = $("#detail-overlay");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeDetail() {
    selectedTicker = null;
    $("#detail-overlay").hidden = true;
    document.body.style.overflow = "";
  }

  function renderBoard(data) {
    boardData = data;
    const live = data.live === true || (data.label || "").toUpperCase() === "LIVE";
    const badge = live
      ? `<span class="badge live">LIVE</span>`
      : `<span class="badge dry">${esc(data.label || "DRY-RUN")}</span>`;

    const blend = data.composite_blend || {};
    const blendNote =
      blend.note ||
      `LOCKED v1: ${blend.flow ?? 0.65} flow / ${blend.tech ?? 0.35} tech`;

    $("#brand-badges").innerHTML = badge;
    $("#week-of").textContent = data.week_of || "—";
    $("#iso-week").textContent = data.iso_week || "";
    $("#last-updated").textContent = data.last_updated || data.generated || "—";
    $("#last-updated-et").textContent = data.last_updated_et || "";
    $("#blend-note").innerHTML = `Composite blend · <em>${esc(blendNote)}</em>`;
    $("#lookback").textContent = data.flow_lookback || "";

    const names = (data.names || []).slice().sort((a, b) => (a.rank || 99) - (b.rank || 99));
    const grid = $("#grid");
    if (!names.length) {
      grid.innerHTML = `<div class="empty">No names on board yet. Seed or run update_board.py.</div>`;
    } else {
      grid.innerHTML = names.map(renderBoardRow).join("");
      grid.querySelectorAll(".board-row").forEach((btn) => {
        btn.addEventListener("click", () => openDetail(btn.dataset.ticker));
      });
    }

    $("#watch-section").innerHTML = renderWatch(data.spotlight_watch);

    const md = data.scorecard_md || "";
    const mdLink = $("#md-link");
    if (md) {
      mdLink.href = md;
      mdLink.textContent = md;
      mdLink.style.display = "";
    } else {
      mdLink.style.display = "none";
    }

    $("#advisory").textContent =
      data.advisory || "Advisory only — not an order ticket.";
    $("#quiet").textContent =
      data.quiet_window_note ||
      "Quiet window: respect watcher quiet windows; do not burn X API for this board.";

    const gaps = data.data_gaps || [];
    const gapsEl = $("#gaps");
    if (gaps.length) {
      gapsEl.style.display = "";
      gapsEl.querySelector("ul").innerHTML = gaps.map((g) => `<li>${esc(g)}</li>`).join("");
    } else {
      gapsEl.style.display = "none";
    }

    // Keep detail open on poll refresh
    if (selectedTicker && !($("#detail-overlay").hidden)) {
      openDetail(selectedTicker);
    }
  }

  // ── Tabs (Scorecard default · Robotics) ──
  const TABS = ["scorecard", "robotics"];
  let activeTab = "scorecard";

  function setTab(tab, pushHash) {
    if (!TABS.includes(tab)) tab = "scorecard";
    activeTab = tab;
    document.querySelectorAll(".tabs .tab").forEach((btn) => {
      const on = btn.dataset.tab === tab;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    TABS.forEach((t) => {
      const pane = document.getElementById(`tab-${t}`);
      if (pane) pane.hidden = t !== tab;
    });
    if (pushHash) {
      const h = tab === "scorecard" ? "" : `#${tab}`;
      if (location.hash !== h) history.replaceState(null, "", h || location.pathname + location.search);
    }
    if (tab === "robotics" && !roboticsData) loadRobotics();
  }

  function tabFromHash() {
    const h = (location.hash || "").replace(/^#/, "").toLowerCase();
    return TABS.includes(h) ? h : "scorecard";
  }

  // ── Robotics tab (robotics.json) ──
  let roboticsData = null;
  let lastRoboticsJson = "";
  let roboticsFilter = "";
  let roboticsFlowOnly = false;

  function listingClass(listing) {
    const l = String(listing || "").toUpperCase();
    if (l === "US") return "us";
    if (l === "PRIVATE") return "private";
    return "intl";
  }

  function renderRoboBadges(badges) {
    return (badges || [])
      .map((b) => `<span class="robo-badge ${esc(b.kind || "")}">${esc(b.text || "")}</span>`)
      .join("");
  }

  function roboRowMatches(r) {
    if (roboticsFlowOnly && !r.options_flow) return false;
    if (!roboticsFilter) return true;
    const hay = `${r.ticker || ""} ${r.name || ""} ${r.listing || ""} ${r.note || ""}`.toLowerCase();
    return hay.includes(roboticsFilter);
  }

  function renderRoboRow(r) {
    const tick = r.private || !r.ticker
      ? `<span class="robo-ticker private">PRIVATE</span>`
      : `<span class="robo-ticker">${esc(r.ticker)}</span>`;
    const cls = ["robo-row"];
    if (r.options_flow) cls.push("is-flow");
    if ((r.badges || []).some((b) => b.kind === "hot")) cls.push("is-hot");
    if (r.private) cls.push("is-private");
    return `<div class="${cls.join(" ")}">
      <div class="robo-row-top">
        ${tick}
        <span class="robo-listing ${listingClass(r.listing)}">${esc(r.listing || "—")}</span>
      </div>
      <div class="robo-name">${esc(r.name || "—")}</div>
      <div class="robo-note">${esc(r.note || "")}</div>
      ${(r.badges || []).length ? `<div class="robo-badges">${renderRoboBadges(r.badges)}</div>` : ""}
    </div>`;
  }

  function renderRoboticsBody() {
    const data = roboticsData;
    const body = $("#robotics-sections");
    if (!data || !body) return;
    let shown = 0;
    const html = (data.sections || [])
      .map((sec) => {
        const groups = (sec.groups || [])
          .map((g) => {
            const rows = (g.names || []).filter(roboRowMatches);
            if (!rows.length) return "";
            shown += rows.length;
            return `<div class="robo-group">
              ${g.label ? `<div class="robo-group-label">${esc(g.label)} <span>${rows.length}</span></div>` : ""}
              <div class="robo-grid">${rows.map(renderRoboRow).join("")}</div>
            </div>`;
          })
          .join("");
        if (!groups) return "";
        return `<section class="robo-section ${sec.id === "the-names" ? "is-summary" : ""}" id="robo-${esc(sec.id)}">
          <h2 class="section-title">${esc(sec.title)}${sec.subtitle ? ` <span class="robo-sub">· ${esc(sec.subtitle)}</span>` : ""}</h2>
          ${groups}
        </section>`;
      })
      .join("");
    body.innerHTML = html || `<div class="empty">No names match this filter.</div>`;
    const cnt = $("#robo-shown");
    if (cnt) cnt.textContent = `${shown} rows`;
  }

  function renderRobotics(data) {
    roboticsData = data;
    const a = data.article || {};
    const flow = data.options_flow || {};
    const uniq = new Set();
    (data.sections || []).forEach((s) => (s.groups || []).forEach((g) => (g.names || []).forEach((r) => uniq.add(r.ticker || r.name))));
    const rc = $("#robotics-count"); if (rc) rc.textContent = uniq.size ? String(uniq.size) : "";
    const highlights = (data.highlights || [])
      .map((h) => `<div class="robo-highlight"><span class="robo-ticker">${esc(h.ticker)}</span><span>${esc(h.text)}</span></div>`)
      .join("");
    const jump = (data.sections || [])
      .map((s) => `<a href="#robo-${esc(s.id)}" class="robo-jump" data-jump="robo-${esc(s.id)}">${esc(s.title)}</a>`)
      .join("");
    $("#robotics-root").innerHTML = `
      <div class="robo-header">
        <div class="robo-kicker">ROBOTICS · ARTICLE WATCHLIST</div>
        <h2 class="robo-title"><a href="${esc(a.url || "#")}" target="_blank" rel="noopener">${esc(a.title || "Robotics")}</a></h2>
        <div class="meta">
          <span>By <strong>${esc(a.author || "—")}</strong></span>
          <span>${esc(a.outlet || "")}</span>
          <span><strong>${esc(a.date_label || a.date || "")}</strong></span>
          ${a.access ? `<span class="robo-access">${esc(a.access)}</span>` : ""}
        </div>
        <div class="robo-link"><a href="${esc(a.url || "#")}" target="_blank" rel="noopener">${esc(a.url || "")}</a></div>
        <div class="robo-flowline">
          <span class="robo-badge flow">Options flow</span>
          ${(flow.tickers || []).map((t) => `<strong>${esc(t)}</strong>`).join(" · ")}
          <span class="robo-dim">OI as of ${esc(flow.oi_as_of || "—")}</span>
        </div>
        ${highlights}
      </div>
      <div class="robo-tools">
        <input type="search" id="robo-filter" placeholder="Filter ticker / name / note…" value="${esc(roboticsFilter)}" aria-label="Filter robotics names" />
        <label class="robo-toggle"><input type="checkbox" id="robo-flow-only" ${roboticsFlowOnly ? "checked" : ""} /> Options-flow only</label>
        <span class="robo-dim" id="robo-shown"></span>
      </div>
      <div class="robo-jumps">${jump}</div>
      <div id="robotics-sections"></div>
      <p class="robo-foot">${esc(data.advisory || "Advisory only — not an order ticket.")}
        ${data.prices && data.prices.note ? ` · Prices: ${esc(data.prices.note)}` : ""}
        ${data.updated ? ` · robotics.json updated ${esc(data.updated)}` : ""}</p>
    `;
    $("#robo-filter").addEventListener("input", (e) => {
      roboticsFilter = String(e.target.value || "").trim().toLowerCase();
      renderRoboticsBody();
    });
    $("#robo-flow-only").addEventListener("change", (e) => {
      roboticsFlowOnly = !!e.target.checked;
      renderRoboticsBody();
    });
    document.querySelectorAll(".robo-jump").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const el = document.getElementById(link.dataset.jump);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    renderRoboticsBody();
  }

  async function loadRobotics() {
    try {
      const res = await fetch("robotics.json?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      if (text === lastRoboticsJson) return;
      lastRoboticsJson = text;
      renderRobotics(JSON.parse(text));
    } catch (err) {
      const root = $("#robotics-root");
      if (root && !roboticsData) root.innerHTML = `<div class="empty">robotics.json error: ${esc(err.message)}</div>`;
    }
  }

  let lastJson = "";
  let pollCount = 0;

  async function loadBoard() {
    try {
      const res = await fetch("board.json?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      pollCount += 1;
      $("#poll-status").textContent = `poll #${pollCount} · ${new Date().toLocaleTimeString()}`;
      if (text === lastJson) return;
      lastJson = text;
      renderBoard(JSON.parse(text));
    } catch (err) {
      $("#poll-status").textContent = `poll error: ${err.message}`;
    }
  }

  $("#detail-close").addEventListener("click", closeDetail);
  $("#detail-overlay").addEventListener("click", (e) => {
    if (e.target === $("#detail-overlay")) closeDetail();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#detail-overlay").hidden) closeDetail();
  });

  document.querySelectorAll(".tabs .tab").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab, true));
  });
  window.addEventListener("hashchange", () => {
    const t = (location.hash || "").replace(/^#/, "").toLowerCase();
    if (TABS.includes(t)) setTab(t, false);
  });
  setTab(tabFromHash(), false);

  loadBoard();
  loadRobotics();
  setInterval(loadBoard, POLL_MS);
  setInterval(() => {
    if (activeTab === "robotics") loadRobotics();
  }, POLL_MS);
})();
