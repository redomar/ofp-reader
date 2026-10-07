"use client";

/*
 * WIND LAB — experimental page (/wind-lab) for tuning the wind-arrow sway. Linked from
 * the reader's Contents under "Experimental".
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brand, ThemeToggle, Toc } from "@/components/chrome";
import { CollapseAllButton, CollapseProvider } from "@/components/collapse";
import { Section } from "@/components/ui";
import { createSway, loop, makeEase, subscribe, type ChaosCfg, type ChaosModel, type SwayInput } from "@/lib/wind/engine";
import { CATS, EASES, PROPOSAL, bpmFor, compute, type Cat, type Cfg, type Kind, type Mapping, type Sample } from "@/lib/wind/model";

const PRESETS: Record<string, Partial<Cfg>> = {
  "Proposal (default)": {},
  "Calmer · cap 240": {
    capBpm: 240,
    anchors: [
      [3, 70],
      [10, 100],
      [20, 140],
      [34, 200],
      [45, 240],
    ],
  },
  "Linear 3→45 kt": { mapping: "linear" },
  "Snappy · wide gusts": { ampPerKt: 2.5, maxAmp: 40, ease: "quad" },
  "Upper air gentle (÷4)": { upperDiv: 4 },
  "Slow-mo ×0.25": { speedMul: 0.25 },
  "Metronome (no chaos)": { chaos: { ...PROPOSAL.chaos, model: "none" } },
};

const CHAOS_PRESETS: Record<string, Partial<ChaosCfg>> = {
  "Sine stack": { model: "sines", freqHz: 0.9 },
  "Smooth noise": { model: "noise", freqHz: 1.4 },
  "Gust kicks": { model: "kicks", kickRate: 0.9, kickStrength: 1.1, kickAttackMs: 60, kickDecayMs: 350 },
  "Spring vane": { model: "spring", stiffness: 60, damping: 6, targetRate: 1.4 },
  "Combo (default)": { model: "combo", freqHz: 0.9, kickRate: 0.8, kickStrength: 1, kickAttackMs: 70, kickDecayMs: 380 },
  Nervous: { model: "combo", freqHz: 2.2, kickRate: 2, kickStrength: 0.8, kickAttackMs: 40, kickDecayMs: 200 },
  "Heavy shoves": { model: "kicks", kickRate: 0.4, kickStrength: 1.4, kickAttackMs: 90, kickDecayMs: 700 },
};

function parseMetarWind(s: string): Pick<Sample, "dir" | "spd" | "gust" | "sector"> {
  const m = s.match(/(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?KT(?:\s+(\d{3})V(\d{3}))?/);
  if (!m) return { dir: null, spd: 0, gust: null, sector: null };
  return {
    dir: m[1] === "VRB" ? null : Number(m[1]),
    spd: Number(m[2]),
    gust: m[3] ? Number(m[3]) : null,
    sector: m[4] ? [Number(m[4]), Number(m[5])] : null,
  };
}

const metar = (raw: string, note: string): Sample => ({ kind: "METAR", raw, note, ...parseMetarWind(raw) });
const pwind = (raw: string, note: string): Sample => {
  const m = raw.match(/^(\d{3})M(\d{2,3})$/)!;
  return { kind: "PWIND", raw, note, dir: Number(m[1]), spd: Number(m[2]), gust: null, sector: null };
};
const avg = (raw: string, note: string): Sample => {
  const m = raw.match(/^(\d{3})\/(\d{3})$/)!;
  return { kind: "AVG", raw, note, dir: Number(m[1]), spd: Number(m[2]), gust: null, sector: null };
};

const SAMPLES: Sample[] = [
  metar("00000KT", "Calm"),
  metar("VRB02KT", "Light and variable"),
  metar("VRB05KT", "Variable, 5 kt"),
  metar("07003KT", "LEPA — near calm"),
  metar("09004KT 050V130", "Light, variable sector 80°"),
  metar("18006KT", "LFSB departure"),
  metar("13008KT", "Light breeze"),
  metar("12010KT 080V160", "EDDB — variable sector 80°"),
  metar("14012KT", "EKCH METAR"),
  metar("10013KT 070V130", "EKBI — variable sector 60°"),
  metar("22015KT", "Moderate"),
  metar("27018KT", "Fresh"),
  metar("24020KT", "Strong-wind warning threshold (20 kt)"),
  metar("13015G25KT", "EKBI TAF — gust spread 10"),
  metar("16016G26KT", "EKCH TAF — gust spread 10"),
  metar("15018G28KT", "Gusts at warning level (28)"),
  metar("12020G30KT", "EKCH TAF TEMPO — spread 10"),
  metar("18010G25KT", "Big spread on light wind (15)"),
  metar("25025G35KT", "High, gusty"),
  metar("28030KT", "High, steady"),
  metar("30028G43KT", "Gale-force gusts (43)"),
  metar("31034KT", "Gale (34 kt mean)"),
  metar("24035G40KT 210V280", "Gale, variable sector 70°"),
  metar("29040G55KT", "Severe gale, spread 15"),
  metar("27045KT", "At the 500 bpm cap"),
  metar("26055G70KT", "Storm (beyond cap)"),
  pwind("178M06", "LFSB T/O PWIND (planned, magnetic)"),
  pwind("148M05", "LFSB LDG PWIND"),
  pwind("129M08", "LEBL LDG PWIND"),
  pwind("115M10", "EDDB T/O PWIND"),
  pwind("116M15", "EKCH T/O PWIND"),
  pwind("136M16", "EKCH LDG PWIND"),
  pwind("270M25", "Hypothetical — high"),
  pwind("310M38", "Hypothetical — gale"),
  avg("267/016", "LFSB→LEBL route average"),
  avg("279/017", "EDDB→EKCH route average"),
  avg("258/030", "EKCH→LFSB route average"),
  avg("270/085", "Jet-stream route"),
  avg("250/150", "Strong jet core"),
];

/* ---------------- visuals ---------------- */

function Arrow({
  dir,
  amp,
  chaosAmp,
  size,
  guides,
  swayRef,
}: {
  dir: number;
  amp: number;
  chaosAmp: number;
  size: number;
  guides: boolean;
  swayRef: (el: HTMLSpanElement | null) => void;
}) {
  const r = 7.6;
  // rounded so server and browser trig agree (avoids a hydration mismatch)
  const toXY = (deg: number) => [Math.sin((deg * Math.PI) / 180) * r, -Math.cos((deg * Math.PI) / 180) * r].map((v) => Math.round(v * 1000) / 1000);
  const wedge = (half: number) => {
    const a0 = toXY(dir + 180 - half);
    const a1 = toXY(dir + 180 + half);
    return `M0 0 L${a0[0]} ${a0[1]} A ${r} ${r} 0 ${half * 2 > 180 ? 1 : 0} 1 ${a1[0]} ${a1[1]} Z`;
  };
  const mid = toXY(dir + 180);
  return (
    <span className="wl-arrow" style={{ width: size, height: size }}>
      {guides && (
        <svg width={size} height={size} viewBox="-8 -8 16 16" className="wl-guide" aria-hidden="true">
          <circle r="7.6" fill="none" stroke="var(--rule)" strokeWidth="0.25" />
          {chaosAmp > 0 && <path d={wedge(Math.min(179, amp + chaosAmp))} fill="var(--magenta)" opacity="0.1" />}
          <path d={wedge(Math.max(0.5, amp))} fill="var(--cat, var(--blue))" opacity="0.16" />
          <line x1="0" y1="0" x2={mid[0]} y2={mid[1]} stroke="var(--ink-3)" strokeWidth="0.25" strokeDasharray="0.6 0.6" />
        </svg>
      )}
      <span className="wl-sway" ref={swayRef}>
        <svg width={size} height={size} viewBox="-8 -8 16 16" aria-hidden="true">
          <g transform={`rotate(${dir + 180})`}>
            <path
              d="M0 -7 L4 1 L1 0 L1 7 L-1 7 L-1 0 L-4 1 Z"
              fill="var(--cat, var(--blue))"
              stroke="var(--ink)"
              strokeWidth={size < 24 ? 0.9 : 0.45}
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </span>
    </span>
  );
}

/** Drives the arrows and the live trace of one card from the shared loop. */
function useMotion(input: SwayInput, reduced: boolean) {
  const els = useRef<(HTMLSpanElement | null)[]>([]);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const latest = useRef(input);
  const live = useRef({ angle: 0, base: 0, chaos: 0 });
  useEffect(() => {
    latest.current = input;
  });
  useEffect(() => {
    const eng = createSway(latest.current);
    const hist: [number, number][] = [];
    return subscribe((t, dt) => {
      eng.update(latest.current);
      const v = eng.step(t, dt);
      live.current = v;
      const a = reduced ? 0 : v.angle;
      els.current.forEach((el) => el && (el.style.transform = `rotate(${a.toFixed(2)}deg)`));
      const cv = canvas.current;
      if (!cv) return;
      hist.push([v.base, v.angle]);
      if (hist.length > 240) hist.shift();
      const g = cv.getContext("2d")!;
      const W = cv.width;
      const H = cv.height;
      const lim = Math.max(5, latest.current.maxDeg);
      g.clearRect(0, 0, W, H);
      g.strokeStyle = "rgba(128,128,128,0.35)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, H / 2);
      g.lineTo(W, H / 2);
      g.stroke();
      const y = (d: number) => H / 2 - (d / lim) * (H / 2 - 2);
      const line = (idx: 0 | 1, color: string, w: number) => {
        g.strokeStyle = color;
        g.lineWidth = w;
        g.beginPath();
        hist.forEach((h, i) => {
          const x = (i / 239) * W;
          if (i) g.lineTo(x, y(h[idx]));
          else g.moveTo(x, y(h[idx]));
        });
        g.stroke();
      };
      line(0, "rgba(61,127,208,0.55)", 1);
      line(1, "#c2338c", 1.6);
    });
    // re-created (fresh randomness) when the seed changes
  }, [input.seed, reduced]);
  const bindBig = useCallback((el: HTMLSpanElement | null) => {
    els.current[0] = el;
  }, []);
  const bindSmall = useCallback((el: HTMLSpanElement | null) => {
    els.current[1] = el;
  }, []);
  return { bindBig, bindSmall, canvas };
}

function Card({ s, i, cfg, phase }: { s: Sample; i: number; cfg: Cfg; phase: number }) {
  const d = compute(s, cfg);
  const dir = s.sector && cfg.useSector ? d.centre : (s.dir ?? 0);
  const ease = useMemo(() => makeEase(cfg.ease === "custom" ? cfg.customEase : EASES[cfg.ease]), [cfg.ease, cfg.customEase]);
  const seed = Math.floor(phase * 1e6) + i * 9973 + cfg.seedRound * 7919;
  const input: SwayInput = { amp: d.amp, chaosAmp: d.chaosAmp, swingMs: d.swingMs, spread: d.kickSpread, ease, seed, chaos: cfg.chaos, maxDeg: d.limit + 10 };
  const { bindBig, bindSmall, canvas } = useMotion(input, cfg.reduced);
  return (
    <article
      className="wl-card"
      data-cat={d.cat}
      style={{
        ["--cat" as string]: cfg.catColour ? CATS[d.cat].color : "var(--blue)",
        ["--cat-ink" as string]: cfg.catColour ? CATS[d.cat].ink : "var(--sheet)",
      }}
    >
      <header>
        <span className="wl-kind" data-k={s.kind}>
          {kindLabel[s.kind]}
        </span>
        <span className="wl-cat" title={CATS[d.cat].rule(cfg.calmKt)}>
          {CATS[d.cat].label}
        </span>
      </header>
      <div className="wl-raw">{s.raw}</div>
      <div className="wl-note">{s.note}</div>
      <div className="wl-stage">
        <Arrow dir={dir} amp={d.amp} chaosAmp={d.chaosAmp} size={cfg.size} guides={cfg.guides} swayRef={bindBig} />
        <div className="wl-inline">
          <span className="wl-incontext">
            <Arrow dir={dir} amp={d.amp} chaosAmp={0} size={16} guides={false} swayRef={bindSmall} />
            <span className="mono">{s.kind === "PWIND" || s.kind === "AVG" ? s.raw : `${s.dir ?? "VRB"}° ${s.spd}${s.gust ? `G${s.gust}` : ""} kt`}</span>
          </span>
          <span className="wl-mini">actual app size</span>
        </div>
      </div>
      <canvas ref={canvas} width={480} height={70} className="wl-trace" aria-label="Live angle trace" />
      <div className="wl-mini wl-legend">
        <i style={{ background: "rgba(61,127,208,0.55)" }} /> regular swing <i style={{ background: "#c2338c" }} /> total angle · ±{(d.limit + 10).toFixed(0)}°
        scale
      </div>
      <dl className="wl-debug">
        <dt>direction</dt>
        <dd>
          {s.dir == null ? "VRB" : `${String(s.dir).padStart(3, "0")}°`}
          {s.kind === "PWIND" ? " M" : " T"}
          {s.sector && ` · sector ${s.sector[0]}–${s.sector[1]}°`}
        </dd>
        <dt>speed</dt>
        <dd>
          {s.spd} kt{s.kind === "AVG" && cfg.upperDiv !== 1 ? ` → scaled ${d.scaleKt.toFixed(1)} kt` : ""}
        </dd>
        <dt>gust</dt>
        <dd>{s.gust != null ? `${s.gust} kt · spread ${d.spread}` : "—"}</dd>
        <dt>rhythm</dt>
        <dd>
          <b>{d.bpm.toFixed(0)} bpm</b> · swing {d.swingMs.toFixed(0)} ms · {d.cycleHz.toFixed(2)} Hz
        </dd>
        <dt>regular</dt>
        <dd>
          <b>±{d.amp.toFixed(1)}°</b> ({d.why})
        </dd>
        <dt>chaos</dt>
        <dd>
          <b>±{d.chaosAmp.toFixed(1)}°</b> {d.chaosAmp > 0 ? `· ${cfg.chaos.model}` : "· off"}
        </dd>
        <dt>arrow points</dt>
        <dd>{((dir + 180) % 360).toFixed(0)}° (downwind)</dd>
      </dl>
    </article>
  );
}

/* ---------------- page ---------------- */

const kindLabel: Record<Kind, string> = { METAR: "METAR wind chip", PWIND: "TLR PWIND", AVG: "AVG WIND (cruise)", CUSTOM: "Custom" };

const WL_SECTIONS = [
  ["controls", "Controls"],
  ["filters", "Filters & custom card"],
  ["arrows", "Arrows"],
] as const;

export default function WindLab() {
  const [cfg, setCfg] = useState<Cfg>(PROPOSAL);
  const [filter, setFilter] = useState<Kind | "ALL">("ALL");
  const [catFilter, setCatFilter] = useState<Cat | "ALL">("ALL");
  const [custom, setCustom] = useState({ dir: 240, spd: 22, gust: 34, s0: "", s1: "" });
  const [customOn, setCustomOn] = useState(false);
  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const setChaos = <K extends keyof ChaosCfg>(k: K, v: ChaosCfg[K]) => setCfg((c) => ({ ...c, chaos: { ...c.chaos, [k]: v } }));
  useEffect(() => {
    loop.speed = cfg.speedMul;
    loop.paused = cfg.paused;
  }, [cfg.speedMul, cfg.paused]);
  const phases = useMemo(() => SAMPLES.map((_, i) => (i * 0.6180339) % 1), []);

  const customSample: Sample = {
    kind: "CUSTOM",
    raw: `${String(custom.dir).padStart(3, "0")}${String(custom.spd).padStart(2, "0")}${custom.gust ? `G${custom.gust}` : ""}KT${custom.s0 && custom.s1 ? ` ${custom.s0}V${custom.s1}` : ""}`,
    note: "Type your own",
    dir: custom.dir,
    spd: custom.spd,
    gust: custom.gust > custom.spd ? custom.gust : null,
    sector: custom.s0 && custom.s1 ? [Number(custom.s0), Number(custom.s1)] : null,
  };
  const list = [...(customOn ? [customSample] : []), ...SAMPLES].filter(
    (s) => s.kind === "CUSTOM" || ((filter === "ALL" || s.kind === filter) && (catFilter === "ALL" || compute(s, cfg).cat === catFilter)),
  );
  const catCount = (k: Cat) => SAMPLES.filter((s) => (filter === "ALL" || s.kind === filter) && compute(s, cfg).cat === k).length;

  const num = (k: keyof Cfg, label: string, min: number, max: number, step: number, unit = "") => (
    <label className="wl-ctl">
      <span>
        {label}{" "}
        <b>
          {String(cfg[k])}
          {unit}
        </b>
      </span>
      <input type="range" min={min} max={max} step={step} value={cfg[k] as number} onChange={(e) => set(k, Number(e.target.value) as never)} />
    </label>
  );
  const chaosNum = (k: keyof ChaosCfg, label: string, min: number, max: number, step: number, unit = "") => (
    <label className="wl-ctl">
      <span>
        {label}{" "}
        <b>
          {String(cfg.chaos[k])}
          {unit}
        </b>
      </span>
      <input type="range" min={min} max={max} step={step} value={cfg.chaos[k] as number} onChange={(e) => setChaos(k, Number(e.target.value) as never)} />
    </label>
  );
  const chk = (k: keyof Cfg, label: string) => (
    <label className="wl-chk">
      <input type="checkbox" checked={cfg[k] as boolean} onChange={(e) => set(k, e.target.checked as never)} /> {label}
    </label>
  );

  // bpm curve preview
  const curve = Array.from({ length: 61 }, (_, kt) => [kt, bpmFor(kt, cfg)] as const);

  return (
    <CollapseProvider>
      <style>{CSS}</style>
      <a href="#main" className="skip">
        Skip to the arrows
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand sub="· Wind lab" />
          <span className="wl-exp">Experimental</span>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={() => set("paused", !cfg.paused)}>
            {cfg.paused ? "▶ Play" : "❚❚ Pause"}
          </button>
          <button type="button" className="btn" onClick={() => setCfg(PROPOSAL)}>
            Reset to proposal
          </button>
          <CollapseAllButton ids={WL_SECTIONS.map(([id]) => id)} className="btn status-all" />
          <Link href="/" className="btn">
            ← Back to reader
          </Link>
          <ThemeToggle />
        </div>
        <div className="status" role="status">
          <span>
            Tune how the wind arrow sways (AVG WIND, PWIND, METAR chips). One beat ={" "}
            {cfg.beat === "swing" ? "one swing (tick→tock)" : "one full left-right-left cycle"}.
          </span>
        </div>
      </header>
      <div className="layout wl">
        <Toc sections={WL_SECTIONS} />
        <main id="main" className="is-filled">
          <Section id="controls" no={1} title="Controls" meta={<span>rhythm · gusts · chaos · motion</span>}>
            <div className="wl-panel" id="wl-panel">
              <div className="wl-group">
                <h2>Presets</h2>
                <div className="wl-row">
                  {Object.entries(PRESETS).map(([n, p]) => (
                    <button key={n} onClick={() => setCfg({ ...PROPOSAL, ...p })}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="wl-group">
                <h2>Speed → rhythm</h2>
                <label className="wl-ctl">
                  <span>Mapping</span>
                  <select value={cfg.mapping} onChange={(e) => set("mapping", e.target.value as Mapping)}>
                    <option value="piecewise">Piecewise (pilot thresholds)</option>
                    <option value="linear">Linear</option>
                    <option value="sqrt">Square root (fast early)</option>
                    <option value="log">Logarithmic</option>
                  </select>
                </label>
                {num("floorBpm", "Floor", 20, 200, 5, " bpm")}
                {num("capBpm", "Cap", 100, 600, 10, " bpm")}
                {num("calmKt", "Calm ≤", 0, 10, 1, " kt")}
                {num("capKt", "Cap reached at", 20, 120, 1, " kt")}
                <label className="wl-ctl">
                  <span>Beat =</span>
                  <select value={cfg.beat} onChange={(e) => set("beat", e.target.value as Cfg["beat"])}>
                    <option value="swing">one swing (tick→tock)</option>
                    <option value="cycle">full cycle (L→R→L)</option>
                  </select>
                </label>
                {num("upperDiv", "AVG WIND (upper air) ÷", 1, 8, 0.5)}
              </div>

              <div className="wl-group">
                <h2>Piecewise anchors</h2>
                <table className="wl-anchors">
                  <thead>
                    <tr>
                      <th>kt</th>
                      <th>bpm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cfg.anchors.map(([k, b], i) => (
                      <tr key={i}>
                        <td>
                          <input
                            type="number"
                            value={k}
                            onChange={(e) => set("anchors", cfg.anchors.map((a, j) => (j === i ? [Number(e.target.value), a[1]] : a)) as Cfg["anchors"])}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={b}
                            onChange={(e) => set("anchors", cfg.anchors.map((a, j) => (j === i ? [a[0], Number(e.target.value)] : a)) as Cfg["anchors"])}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <svg viewBox="0 0 240 110" className="wl-curve" aria-label="bpm against wind speed">
                  {[0, 10, 20, 30, 40, 50, 60].map((kt) => (
                    <g key={kt}>
                      <line x1={20 + kt * 3.6} x2={20 + kt * 3.6} y1={8} y2={92} stroke="var(--grid)" />
                      <text x={20 + kt * 3.6} y={104} textAnchor="middle">
                        {kt}
                      </text>
                    </g>
                  ))}
                  {[20, 34].map((kt) => (
                    <line
                      key={kt}
                      x1={20 + kt * 3.6}
                      x2={20 + kt * 3.6}
                      y1={8}
                      y2={92}
                      stroke={kt === 20 ? "var(--amber)" : "var(--red)"}
                      strokeDasharray="3 2"
                    />
                  ))}
                  <polyline
                    fill="none"
                    stroke="var(--magenta)"
                    strokeWidth="2"
                    points={curve.map(([kt, b]) => `${20 + kt * 3.6},${92 - (b / 600) * 84}`).join(" ")}
                  />
                  <text x={4} y={12}>
                    600
                  </text>
                  <text x={4} y={94}>
                    0
                  </text>
                </svg>
                <p className="wl-mini">amber = strong-wind warning (20 kt) · red = gale (34 kt) · x = kt, y = bpm</p>
              </div>

              <div className="wl-group">
                <h2>Gusts → swing size</h2>
                {num("baseAmp", "No-gust sway ±", 0, 15, 0.5, "°")}
                {num("ampPerKt", "Per kt of gust spread", 0, 5, 0.1, "°")}
                {num("maxAmp", "Max sway ±", 5, 90, 1, "°")}
                {num("vrbAmp", "VRB wander ±", 0, 180, 5, "°")}
                {chk("useSector", "Use METAR variable sector (e.g. 080V160)")}
              </div>

              <div className="wl-group">
                <h2>Gust chaos (gusts · VRB · sectors)</h2>
                <label className="wl-ctl">
                  <span>Model</span>
                  <select value={cfg.chaos.model} onChange={(e) => setChaos("model", e.target.value as ChaosModel)}>
                    <option value="none">None — metronome</option>
                    <option value="sines">Sine stack (1 : 1.618 : 2.71)</option>
                    <option value="noise">Smooth noise</option>
                    <option value="kicks">Gust kicks</option>
                    <option value="spring">Spring vane</option>
                    <option value="combo">Combo: sines + kicks</option>
                  </select>
                </label>
                <div className="wl-row" style={{ marginBottom: 8 }}>
                  {Object.entries(CHAOS_PRESETS).map(([n, p]) => (
                    <button key={n} className="wl-small" aria-pressed={false} onClick={() => setCfg((c) => ({ ...c, chaos: { ...c.chaos, ...p } }))}>
                      {n}
                    </button>
                  ))}
                </div>
                <label className="wl-ctl">
                  <span>
                    Share given to chaos <b>{Math.round(cfg.chaosShare * 100)}%</b>
                  </span>
                  <input type="range" min={0} max={1} step={0.05} value={cfg.chaosShare} onChange={(e) => set("chaosShare", Number(e.target.value))} />
                </label>
                <label className="wl-ctl">
                  <span>Applies to</span>
                  <select value={cfg.chaosScope} onChange={(e) => set("chaosScope", e.target.value as Cfg["chaosScope"])}>
                    <option value="gusty">Gusts, VRB and variable sectors only</option>
                    <option value="all">Every arrow (steady ones get a little)</option>
                  </select>
                </label>
                {cfg.chaosScope === "all" && num("steadyChaos", "Steady-wind chaos ±", 0, 10, 0.5, "°")}
                <button className="wl-small" onClick={() => set("seedRound", cfg.seedRound + 1)}>
                  ↻ Re-roll randomness
                </button>
              </div>

              <div className="wl-group">
                <h2>Chaos tuning</h2>
                {chaosNum("freqHz", "Wobble frequency", 0.1, 5, 0.1, " Hz")}
                <label className="wl-chk">
                  <input type="checkbox" checked={cfg.chaos.freqFromBpm} onChange={(e) => setChaos("freqFromBpm", e.target.checked)} /> Tie wobble to rhythm (×
                  swing rate)
                </label>
                {cfg.chaos.freqFromBpm && chaosNum("freqMul", "× swing rate", 0.1, 3, 0.05)}
                {chaosNum("kickRate", "Kicks / s at 10 kt spread", 0, 4, 0.1)}
                {chaosNum("kickStrength", "Kick strength", 0.1, 2, 0.05, "×")}
                {chaosNum("kickAttackMs", "Kick attack", 10, 300, 5, " ms")}
                {chaosNum("kickDecayMs", "Kick recovery", 50, 1500, 10, " ms")}
                {chaosNum("stiffness", "Spring stiffness", 5, 300, 5)}
                {chaosNum("damping", "Spring damping", 0.5, 30, 0.5)}
                {chaosNum("targetRate", "Spring target changes / s", 0.1, 5, 0.1)}
              </div>

              <div className="wl-group">
                <h2>Motion</h2>
                <label className="wl-ctl">
                  <span>Easing</span>
                  <select value={cfg.ease} onChange={(e) => set("ease", e.target.value)}>
                    {Object.keys(EASES).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                    <option value="custom">custom…</option>
                  </select>
                </label>
                {cfg.ease === "custom" && (
                  <label className="wl-ctl">
                    <span>timing function</span>
                    <input value={cfg.customEase} onChange={(e) => set("customEase", e.target.value)} />
                  </label>
                )}
                {num("speedMul", "Playback ×", 0.1, 3, 0.05)}
                {num("size", "Card arrow size", 24, 140, 2, "px")}
                {chk("randomPhase", "Randomise phase (arrows not in sync)")}
                {chk("guides", "Show sway sector guides")}
                {chk("catColour", "Colour by wind category")}
                {chk("reduced", "Simulate reduced motion")}
              </div>
            </div>
          </Section>

          <Section id="filters" no={2} title="Filters & custom card" meta={<span>{list.length} shown</span>}>
            <div className="wl-row wl-filter">
              {(["ALL", "METAR", "PWIND", "AVG"] as const).map((k) => (
                <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                  {k === "ALL" ? `All (${SAMPLES.length})` : kindLabel[k]}
                </button>
              ))}
            </div>

            <div className="wl-row wl-cats" role="group" aria-label="Filter by wind category">
              <button aria-pressed={catFilter === "ALL"} onClick={() => setCatFilter("ALL")}>
                Any strength
              </button>
              {(Object.keys(CATS) as Cat[]).map((k) => (
                <button
                  key={k}
                  className="wl-catbtn"
                  aria-pressed={catFilter === k}
                  onClick={() => setCatFilter(catFilter === k ? "ALL" : k)}
                  style={{ ["--cat" as string]: CATS[k].color, ["--cat-ink" as string]: CATS[k].ink }}
                >
                  <i aria-hidden="true" />
                  {CATS[k].label}
                  <small>{CATS[k].rule(cfg.calmKt)}</small>
                  <small>({catCount(k)})</small>
                </button>
              ))}
              <span className="wl-mini">
                AVG WIND uses its ÷ scaled speed; High follows the Met Office strong-wind warning (20 kt / 28 G); gale (34 / 43 G) and storm (48 kt) follow
                theirs.
              </span>
            </div>

            {/* the inputs stay in place (dimmed and disabled when off) so turning it on doesn't move anything */}
            <div className={`wl-custom-bar${customOn ? "" : " is-off"}`}>
              <button type="button" aria-pressed={customOn} onClick={() => setCustomOn(!customOn)} title="Add a card at the top built from the values you type">
                Custom card {customOn ? "· on" : "· off"}
              </button>
              {(["dir", "spd", "gust"] as const).map((k) => (
                <label key={k}>
                  {k}
                  <input type="number" value={custom[k]} disabled={!customOn} onChange={(e) => setCustom({ ...custom, [k]: Number(e.target.value) })} />
                </label>
              ))}
              <label>
                variable from
                <input value={custom.s0} placeholder="—" disabled={!customOn} onChange={(e) => setCustom({ ...custom, s0: e.target.value })} />
              </label>
              <label>
                to
                <input value={custom.s1} placeholder="—" disabled={!customOn} onChange={(e) => setCustom({ ...custom, s1: e.target.value })} />
              </label>
            </div>
          </Section>

          <Section id="arrows" no={3} title="Arrows" meta={<span>METAR · PWIND · AVG WIND</span>}>
            <div className="wl-grid">
              {/* holds the custom card's slot while it's off, so the grid doesn't shift */}
              {!customOn && (
                <button type="button" className="wl-card wl-slot" onClick={() => setCustomOn(true)}>
                  Custom card off
                  <small>turn it on to build a card from your own wind</small>
                </button>
              )}
              {list.map((s, i) => (
                <Card key={s.kind + s.raw + i} s={s} i={i} cfg={cfg} phase={phases[i % phases.length]} />
              ))}
            </div>
          </Section>
        </main>
      </div>
    </CollapseProvider>
  );
}

const CSS = `
@keyframes wl-sway { from { transform: rotate(calc(-1 * var(--amp))); } to { transform: rotate(var(--amp)); } }
.wl-group h2 { margin: 0 0 8px; font-family: var(--font-cond); letter-spacing: .1em; text-transform: uppercase; font-size: 14px; color: var(--ink-2); }
.wl p { margin: 4px 0 0; color: var(--ink-2); }
/* buttons inside the lab read as the site's filter pills */
.wl .sheet-body button { border: 1px solid var(--rule-strong); background: var(--sheet); color: var(--ink); padding: 3px 10px; font-family: var(--font-cond); font-weight: 600; font-size: 13px; letter-spacing: .05em; text-transform: uppercase; cursor: pointer; border-radius: 999px; }
.wl .sheet-body button[aria-pressed="true"] { background: var(--ink); color: var(--sheet); border-color: var(--ink); }
.wl-exp { font: 700 11px var(--font-cond); letter-spacing: .14em; text-transform: uppercase; color: var(--ink-2); padding: 2px 8px; border: 1px solid var(--rule-strong); background: repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in srgb, var(--rule-strong) 22%, transparent) 4px 6px); }
.wl-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.wl-panel { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.wl-group { border-left: 2px solid var(--rule); padding-left: 10px; }
.wl-ctl { display: flex; flex-direction: column; gap: 2px; font-size: 13px; margin-bottom: 8px; }
.wl-ctl span { display: flex; justify-content: space-between; color: var(--ink-2); }
.wl-ctl b { font-family: var(--font-mono); color: var(--magenta); }
.wl-ctl input, .wl-ctl select { width: 100%; }
.wl input[type=range], .wl input[type=checkbox] { accent-color: var(--magenta); }
.wl-ctl input:not([type=range]), .wl-ctl select, .wl-anchors input, .wl-custom input { background: var(--field); color: var(--ink); border: 1px solid var(--rule-strong); padding: 3px 6px; font-family: var(--font-mono); font-size: 12px; }
.wl-chk { display: block; font-size: 13px; margin: 4px 0; }
.wl-anchors { border-collapse: collapse; margin-bottom: 6px; }
.wl-anchors th { font-size: 11px; color: var(--ink-3); text-align: left; }
.wl-anchors input { width: 70px; }
.wl-curve { width: 100%; max-width: 260px; display: block; }
.wl-curve text { font-size: 8px; fill: var(--ink-3); font-family: var(--font-mono); }
.wl-mini { font-size: 11px; color: var(--ink-3); }
.wl-filter { margin: 0 0 12px; }
.wl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
.wl-card { background: var(--field); border: 1px solid var(--rule); padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
.wl-card header { display: flex; justify-content: space-between; align-items: center; }
.wl-kind { font-family: var(--font-cond); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: 11px; color: var(--ink-3); }
.wl-kind[data-k=CUSTOM] { color: var(--magenta); }
.wl-cat { font-family: var(--font-cond); font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: .06em; border: 1px solid var(--ink); background: var(--cat); color: var(--cat-ink); padding: 0 6px; border-radius: 2px; cursor: help; }
.wl-card { border-top: 3px solid var(--cat, var(--rule-strong)) !important; }
.wl-cats { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 0 0 14px; }
.wl-catbtn { display: inline-flex; align-items: center; gap: 6px; }
.wl-catbtn i { width: 11px; height: 11px; border-radius: 50%; background: var(--cat); border: 1px solid var(--ink); display: inline-block; }
.wl-catbtn small { font-family: var(--font-mono); font-weight: 400; font-size: 11px; color: var(--ink-3); letter-spacing: 0; }
.wl-catbtn[aria-pressed="true"] { background: var(--cat) !important; color: var(--cat-ink) !important; border-color: var(--ink) !important; }
.wl-catbtn[aria-pressed="true"] small { color: var(--cat-ink); }
.wl-raw { font-family: var(--font-mono); font-weight: 600; font-size: 15px; }
.wl-note { font-size: 12px; color: var(--ink-2); min-height: 16px; }
.wl-stage { display: flex; align-items: center; gap: 14px; padding: 8px 0; border-top: 1px dashed var(--rule); border-bottom: 1px dashed var(--rule); margin: 4px 0; }
.wl-arrow { position: relative; display: inline-grid; place-items: center; flex: none; }
.wl-arrow > * { grid-area: 1 / 1; }
.wl-sway { display: inline-block; transform-origin: 50% 50%; line-height: 0; }
.wl-inline { display: flex; flex-direction: column; gap: 4px; }
.wl-incontext { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--rule); padding: 3px 8px; background: var(--field); font-size: 13px; }
.wl-debug { display: grid; grid-template-columns: max-content 1fr; gap: 1px 10px; margin: 0; font-size: 12px; }
.wl-debug dt { color: var(--ink-3); font-family: var(--font-cond); letter-spacing: .05em; text-transform: uppercase; }
.wl-debug dd { margin: 0; font-family: var(--font-mono); }
.wl-debug b { color: var(--magenta); }
.wl-custom { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; font-size: 11px; color: var(--ink-3); }
.wl-custom label { display: flex; flex-direction: column; }
.wl-custom-bar { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; margin: 0 0 12px; font-size: 12px; color: var(--ink-2); }
.wl-custom-bar label { display: flex; flex-direction: column; gap: 2px; }
.wl-custom-bar.is-off label { opacity: .45; }
.wl .sheet-body button.wl-slot { display: grid; place-content: center; gap: 4px; min-height: 160px; border: 1.5px dashed var(--rule-strong) !important; border-radius: 0; background: transparent; color: var(--ink-3); font-size: 14px; letter-spacing: .1em; }
.wl .sheet-body button.wl-slot small { font: 400 12px var(--font-sans); letter-spacing: 0; text-transform: none; }
.wl .sheet-body button.wl-slot:hover { border-color: var(--blue) !important; color: var(--blue); }
.wl-custom-bar input { width: 80px; background: var(--field); color: var(--ink); border: 1px solid var(--rule-strong); padding: 3px 6px; font-family: var(--font-mono); font-size: 12px; }
.wl .wl-small { padding: 2px 7px; font-size: 12px; }
.wl-trace { width: 100%; height: 35px; display: block; background: var(--field); border: 1px solid var(--rule); }
.wl-legend { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.wl-legend i { display: inline-block; width: 10px; height: 3px; margin-left: 4px; }
.wl-custom input { width: 100%; }
`;
