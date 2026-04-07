import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_ID = "rafa";

const CLUSTERS = [
  {
    id: "signal",
    title: "The signal — body before thought",
    subtitle: "Upper left chest, above the heart. These prompts meet you at the physical moment, before the mind takes over.",
    color: "#7F77DD",
  },
  {
    id: "force",
    title: "Force vs. release — the unresolvable",
    subtitle: "When the impulse is to push harder. These prompts interrupt the \"power through\" reflex before it lands.",
    color: "#1D9E75",
  },
  {
    id: "swallowed",
    title: "The swallowed claim — space and self",
    subtitle: "The thing hardest to say out loud. These prompts name the suppressed need before it turns into withdrawal.",
    color: "#D85A30",
  },
  {
    id: "reference",
    title: "The reference point — your best self",
    subtitle: "Solar plexus warmth, time slowing, clarity about what comes next. These prompts invoke that felt state as a compass.",
    color: "#378ADD",
  },
  {
    id: "gap",
    title: "The gap — how you're seen vs. how you feel",
    subtitle: "People love you more than you think. These prompts work the specific anxiety underneath the confidence.",
    color: "#888780",
  },
];

const DEFAULT_PROMPTS = [
  { id: "s1", clusterId: "signal", weight: 3, active: true, text: "You felt it — the tightening above your heart. Before you do anything with it: what is this feeling trying to protect?" },
  { id: "s2", clusterId: "signal", weight: 3, active: true, text: "The restlessness is here. It arrived before the thought did. What does it already know that your mind hasn't caught up to yet?" },
  { id: "s3", clusterId: "signal", weight: 3, active: true, text: "If that tightness in your chest could speak one sentence right now, what would it say?" },
  { id: "f1", clusterId: "force", weight: 3, active: true, text: "You want to push harder. Ask yourself honestly: is more force actually available here, or are you just refusing the outcome?" },
  { id: "f2", clusterId: "force", weight: 3, active: true, text: "This one may not be resolvable. What would it look like to put it down for today — not to abandon it, just to stop carrying it tonight?" },
  { id: "f3", clusterId: "force", weight: 3, active: true, text: "The older version of you would double down. What does the version of you who has grown do instead?" },
  { id: "w1", clusterId: "swallowed", weight: 3, active: true, text: "What do you actually need right now that you haven't said out loud to anyone?" },
  { id: "w2", clusterId: "swallowed", weight: 3, active: true, text: "Is the distance you're feeling something you created, or something that happened to you? Be honest." },
  { id: "w3", clusterId: "swallowed", weight: 3, active: true, text: "You don't have to say it to them. Say it here: what do you need that feels too selfish to ask for?" },
  { id: "r1", clusterId: "reference", weight: 3, active: true, text: "You know what it feels like when you're at your best — light, warm, everything slowing down. How far from that are you right now, and what's the distance made of?" },
  { id: "r2", clusterId: "reference", weight: 3, active: true, text: "What would the version of you who feels that solar plexus warmth do with this situation right now?" },
  { id: "r3", clusterId: "reference", weight: 3, active: true, text: "Think of a moment this week when you felt clear. What were you doing, and what had you let go of to feel that way?" },
  { id: "g1", clusterId: "gap", weight: 3, active: true, text: "You're worried someone thinks you're not working hard enough. Is that their perception, or a story you're telling about yourself?" },
  { id: "g2", clusterId: "gap", weight: 3, active: true, text: "People flew across the world for you. What would it take to actually receive that — not just note it and move on?" },
  { id: "g3", clusterId: "gap", weight: 3, active: true, text: "You had an idea that got dismissed today. Before you write off the room: what part of the idea, if any, wasn't ready yet?" },
];

const DEFAULT_SETTINGS = {
  nudgeTimes: ["08:00", "13:00", "20:00"],
  checkInDay: "Sunday",
  checkInTime: "19:00",
  syncTime: "03:00",
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function loadPromptsFromDB() {
  const { data, error } = await supabase
    .from("ps_prompts")
    .select("*")
    .eq("is_active", true)
    .order("cluster")
    .order("weight", { ascending: false });

  if (error || !data || data.length === 0) return null;

  // Map DB rows to app prompt shape
  return data.map(row => ({
    id: row.id,
    clusterId: row.cluster,
    weight: row.weight,
    active: row.is_active,
    text: row.prompt_text,
    source: row.source,
  }));
}

async function loadSettingsFromDB() {
  const { data, error } = await supabase
    .from("ps_profiles")
    .select("*")
    .eq("user_id", USER_ID)
    .single();

  if (error || !data) return null;

  const ws = data.wake_schedule || {};
  return {
    nudgeTimes: ws.nudgeTimes || DEFAULT_SETTINGS.nudgeTimes,
    checkInDay: ws.checkInDay || DEFAULT_SETTINGS.checkInDay,
    checkInTime: ws.checkInTime || DEFAULT_SETTINGS.checkInTime,
    syncTime: ws.syncTime || DEFAULT_SETTINGS.syncTime,
  };
}

async function savePromptsToDB(prompts) {
  // Only update weight and is_active for existing prompts
  const updates = prompts.map(p =>
    supabase
      .from("ps_prompts")
      .update({
        weight: p.weight,
        is_active: p.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id)
  );
  await Promise.all(updates);
}

async function saveSettingsToDB(settings) {
  const { data } = await supabase
    .from("ps_profiles")
    .select("id")
    .eq("user_id", USER_ID)
    .single();

  const payload = {
    user_id: USER_ID,
    wake_schedule: settings,
    prompt_interval_minutes: 90,
    vibration_intensity: 2,
    display_contrast: 2,
    onboarding_complete: true,
    shadow_clusters: [],
    updated_at: new Date().toISOString(),
  };

  if (data) {
    await supabase.from("ps_profiles").update(payload).eq("user_id", USER_ID);
  } else {
    await supabase.from("ps_profiles").insert(payload);
  }
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Mono:wght@300;400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink: #1a1814;
    --ink-mid: #3d3a35;
    --ink-muted: #7a7670;
    --ink-faint: #b8b4ae;
    --paper: #f5f2ed;
    --paper-warm: #ede9e2;
    --paper-deep: #e0dbd2;
    --rule: rgba(26,24,20,0.12);
    --rule-strong: rgba(26,24,20,0.22);
    --accent: #c8a96e;
    --accent-dim: rgba(200,169,110,0.15);
    --mono: 'DM Mono', monospace;
    --serif: 'Playfair Display', Georgia, serif;
  }

  html, body, #root { height: 100%; }

  body {
    background: var(--paper);
    color: var(--ink);
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  .app { min-height: 100vh; display: flex; flex-direction: column; }

  .header {
    border-bottom: 1px solid var(--rule-strong);
    padding: 1.5rem 2rem 1.25rem;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    background: var(--paper);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .header-left { display: flex; flex-direction: column; gap: 2px; }
  .header-wordmark {
    font-family: var(--serif);
    font-size: 22px;
    font-weight: 400;
    letter-spacing: -0.01em;
    color: var(--ink);
    line-height: 1;
  }
  .header-wordmark span { font-style: italic; color: var(--ink-muted); }
  .header-sub {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-faint);
    font-weight: 300;
  }
  .header-nav {
    display: flex;
    gap: 0;
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    overflow: hidden;
  }
  .nav-btn {
    background: none;
    border: none;
    border-right: 1px solid var(--rule-strong);
    padding: 0.4rem 1rem;
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .nav-btn:last-child { border-right: none; }
  .nav-btn:hover { background: var(--paper-warm); color: var(--ink); }
  .nav-btn.active { background: var(--ink); color: var(--paper); }

  .main { flex: 1; padding: 2rem; max-width: 900px; width: 100%; margin: 0 auto; }

  .section-eyebrow {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-faint);
    font-weight: 300;
    margin-bottom: 0.4rem;
  }
  .section-title {
    font-family: var(--serif);
    font-size: 26px;
    font-weight: 400;
    color: var(--ink);
    margin-bottom: 0.25rem;
    line-height: 1.2;
  }
  .section-desc {
    color: var(--ink-muted);
    font-size: 12px;
    margin-bottom: 2rem;
    max-width: 520px;
    line-height: 1.7;
  }

  .cluster-block { margin-bottom: 2.5rem; }
  .cluster-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 0.75rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--rule);
  }
  .cluster-pip { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .cluster-name { font-family: var(--serif); font-size: 15px; font-weight: 500; color: var(--ink); }
  .cluster-sub-text { font-size: 11px; color: var(--ink-muted); line-height: 1.5; margin-bottom: 0.75rem; padding-left: 18px; }

  .prompt-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 0.75rem 0.75rem 0.75rem 18px;
    border-radius: 3px;
    margin-bottom: 4px;
    transition: background 0.15s;
    border: 1px solid transparent;
  }
  .prompt-row:hover { background: var(--paper-warm); border-color: var(--rule); }
  .prompt-row.inactive { opacity: 0.4; }

  .prompt-toggle {
    width: 16px; height: 16px;
    border: 1px solid var(--rule-strong);
    border-radius: 2px;
    background: none;
    cursor: pointer;
    flex-shrink: 0;
    margin-top: 1px;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, border-color 0.15s;
    font-size: 9px;
    color: var(--paper);
  }
  .prompt-toggle.on { background: var(--ink); border-color: var(--ink); }

  .prompt-text-area { flex: 1; font-size: 12.5px; color: var(--ink); line-height: 1.65; }

  .weight-control { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .weight-label { font-size: 10px; color: var(--ink-faint); letter-spacing: 0.06em; }
  .weight-pips { display: flex; gap: 3px; }
  .weight-pip {
    width: 10px; height: 10px;
    border-radius: 50%;
    border: 1px solid var(--rule-strong);
    cursor: pointer;
    transition: background 0.1s;
  }
  .weight-pip.filled { background: var(--ink-mid); border-color: var(--ink-mid); }

  .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  @media (max-width: 600px) { .settings-grid { grid-template-columns: 1fr; } }

  .settings-card {
    background: var(--paper-warm);
    border: 1px solid var(--rule-strong);
    border-radius: 4px;
    padding: 1.25rem;
  }
  .settings-card-title {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-muted);
    margin-bottom: 1rem;
    font-weight: 400;
  }
  .field-row { margin-bottom: 0.9rem; }
  .field-row:last-child { margin-bottom: 0; }
  .field-label { font-size: 11px; color: var(--ink-muted); margin-bottom: 4px; display: block; }
  .field-input {
    width: 100%;
    background: var(--paper);
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    padding: 0.4rem 0.6rem;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ink);
    outline: none;
    transition: border-color 0.15s;
  }
  .field-input:focus { border-color: var(--ink-mid); }
  .field-select {
    width: 100%;
    background: var(--paper);
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    padding: 0.4rem 0.6rem;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ink);
    outline: none;
    cursor: pointer;
    appearance: none;
  }
  .nudge-times { display: flex; flex-direction: column; gap: 6px; }
  .nudge-time-row { display: flex; align-items: center; gap: 8px; }
  .nudge-time-row .field-input { text-align: center; width: 110px; }
  .nudge-remove {
    background: none; border: 1px solid var(--rule-strong); border-radius: 3px;
    width: 24px; height: 24px; cursor: pointer; color: var(--ink-muted);
    font-size: 14px; line-height: 1; display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, color 0.15s; flex-shrink: 0;
  }
  .nudge-remove:hover { background: var(--paper-deep); color: var(--ink); }
  .nudge-add {
    background: none; border: 1px dashed var(--rule-strong); border-radius: 3px;
    padding: 0.3rem 0.7rem; font-family: var(--mono); font-size: 10px;
    letter-spacing: 0.08em; color: var(--ink-muted); cursor: pointer;
    transition: background 0.15s, color 0.15s; margin-top: 2px; width: fit-content;
  }
  .nudge-add:hover { background: var(--paper-deep); color: var(--ink); }
  .nudge-none { font-size: 11px; color: var(--ink-faint); font-style: italic; padding: 4px 0; }

  .checkin-container { max-width: 640px; }
  .checkin-intro {
    background: var(--paper-warm);
    border: 1px solid var(--rule-strong);
    border-left: 3px solid var(--accent);
    border-radius: 0 4px 4px 0;
    padding: 1.25rem;
    margin-bottom: 2rem;
  }
  .checkin-intro p { font-size: 13px; color: var(--ink-mid); line-height: 1.7; }

  .messages { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; min-height: 200px; }

  .msg { display: flex; gap: 10px; animation: fadeUp 0.3s ease; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

  .msg-avatar {
    width: 24px; height: 24px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px;
    letter-spacing: 0.05em;
    margin-top: 2px;
  }
  .msg-avatar.ai { background: var(--ink); color: var(--paper); font-family: var(--serif); font-style: italic; }
  .msg-avatar.user { background: var(--paper-deep); color: var(--ink-muted); border: 1px solid var(--rule-strong); }

  .msg-bubble {
    flex: 1;
    font-size: 13px;
    line-height: 1.7;
    color: var(--ink);
    padding: 0.75rem 1rem;
    border-radius: 0 4px 4px 4px;
    max-width: 520px;
  }
  .msg-bubble.ai { background: var(--paper-warm); border: 1px solid var(--rule); }
  .msg-bubble.user { background: var(--ink); color: var(--paper); border-radius: 4px 0 4px 4px; }

  .msg.user { flex-direction: row-reverse; }
  .msg.user .msg-bubble { border-radius: 4px 0 4px 4px; }

  .typing-indicator { display: flex; gap: 4px; padding: 0.5rem 0; }
  .typing-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--ink-faint);
    animation: typingPulse 1.2s infinite;
  }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typingPulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }

  .checkin-input-row {
    display: flex;
    gap: 8px;
    border-top: 1px solid var(--rule);
    padding-top: 1rem;
  }
  .checkin-textarea {
    flex: 1;
    background: var(--paper-warm);
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    padding: 0.6rem 0.8rem;
    font-family: var(--mono);
    font-size: 13px;
    color: var(--ink);
    resize: none;
    outline: none;
    min-height: 44px;
    max-height: 120px;
    line-height: 1.5;
    transition: border-color 0.15s;
  }
  .checkin-textarea:focus { border-color: var(--ink-mid); }

  .send-btn {
    background: var(--ink);
    color: var(--paper);
    border: none;
    border-radius: 3px;
    padding: 0 1.1rem;
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    cursor: pointer;
    transition: opacity 0.15s;
    white-space: nowrap;
  }
  .send-btn:hover { opacity: 0.8; }
  .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .checkin-done {
    background: var(--paper-warm);
    border: 1px solid var(--rule-strong);
    border-radius: 4px;
    padding: 1.25rem;
    margin-top: 1rem;
  }
  .checkin-done-title { font-family: var(--serif); font-size: 16px; font-style: italic; color: var(--ink); margin-bottom: 0.5rem; }
  .checkin-done-text { font-size: 12px; color: var(--ink-muted); line-height: 1.7; }

  .save-bar {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    background: var(--ink);
    padding: 0.75rem 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transform: translateY(100%);
    transition: transform 0.25s ease;
    z-index: 200;
  }
  .save-bar.visible { transform: translateY(0); }
  .save-bar-text { font-size: 11px; color: var(--ink-faint); letter-spacing: 0.06em; }
  .save-btn {
    background: var(--accent);
    color: var(--ink);
    border: none;
    border-radius: 3px;
    padding: 0.45rem 1.25rem;
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    cursor: pointer;
    font-weight: 400;
    transition: opacity 0.15s;
  }
  .save-btn:hover { opacity: 0.85; }
  .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .preview-wrap {
    background: var(--paper-warm);
    border: 1px solid var(--rule-strong);
    border-radius: 4px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }
  .preview-label { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 1rem; }
  .eink-frame {
    background: #e8e4db;
    border: 2px solid #c8c2b8;
    border-radius: 6px;
    width: 250px;
    padding: 14px 16px;
    font-family: var(--mono);
  }
  .eink-cluster { font-size: 9px; font-weight: 400; color: #5a5650; letter-spacing: 0.04em; margin-bottom: 4px; line-height: 1.4; }
  .eink-divider { border: none; border-top: 1px solid #c0bab2; margin: 6px 0; }
  .eink-prompt { font-size: 10px; color: #1a1814; line-height: 1.55; }
  .eink-footer { margin-top: 10px; font-size: 8px; color: #9a9690; display: flex; justify-content: space-between; }

  .preview-controls { margin-top: 1rem; display: flex; gap: 8px; }
  .preview-btn {
    background: none;
    border: 1px solid var(--rule-strong);
    border-radius: 3px;
    padding: 0.35rem 0.8rem;
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--ink-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .preview-btn:hover { background: var(--paper-deep); color: var(--ink); }

  .status-row { display: flex; gap: 1.5rem; margin-bottom: 2rem; flex-wrap: wrap; }
  .status-item { display: flex; align-items: center; gap: 6px; }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; }
  .status-dot.green { background: #1D9E75; }
  .status-dot.amber { background: #c8a96e; }
  .status-text { font-size: 11px; color: var(--ink-muted); }

  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    flex-direction: column;
    gap: 1rem;
  }
  .loading-text { font-size: 11px; color: var(--ink-faint); letter-spacing: 0.1em; text-transform: uppercase; }

  hr.rule { border: none; border-top: 1px solid var(--rule); margin: 2rem 0; }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRandomPrompt(prompts) {
  const active = prompts.filter(p => p.active);
  if (!active.length) return prompts[0];
  const pool = active.flatMap(p => Array(p.weight).fill(p));
  return pool[Math.floor(Math.random() * pool.length)];
}

function getCluster(id) { return CLUSTERS.find(c => c.id === id); }

// ── Check-in AI ───────────────────────────────────────────────────────────────

async function callClaude(messages) {
  const systemPrompt = `You are the Pocket Shadow check-in guide — a direct, warm, non-performative presence helping Rafa do weekly shadow work.

Context about Rafa: ENTJ-leaning. Shadow pattern: Control -> Impatience -> Withdrawal -> Overcorrection into logic. Core trigger: lack of control over unresolvable outcomes. His body signal is a tightening in the upper left chest before thoughts form. At his best he feels solar plexus warmth, time slowing, and clarity about what comes next. His hardest thing to say: "I need space / I need my own thing."

Your role in this check-in:
- Ask 3-4 focused questions across the conversation, one or two at a time
- Questions should probe which prompts landed this week, what's been unresolved, where the shadow pattern showed up
- Be direct. No affirmations, no "great answer", no wellness-speak
- After gathering enough (3-4 exchanges), produce a closing synthesis that: (1) names what the week revealed, (2) suggests which 1-2 clusters to emphasize next week and why, (3) one honest observation
- End your synthesis with the exact text: [CHECK-IN COMPLETE]
- Keep everything under 120 words per message
- No em dashes`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: systemPrompt,
      messages,
    }),
  });
  const data = await response.json();
  return data.content?.[0]?.text || "Something went wrong. Try again.";
}

// ── Components ────────────────────────────────────────────────────────────────

function WeightPips({ value, onChange }) {
  return (
    <div className="weight-control">
      <span className="weight-label">weight</span>
      <div className="weight-pips">
        {[1,2,3,4,5].map(n => (
          <div
            key={n}
            className={`weight-pip ${n <= value ? "filled" : ""}`}
            onClick={() => onChange(n)}
          />
        ))}
      </div>
    </div>
  );
}

function PromptsTab({ prompts, setPrompts, setDirty }) {
  const [, setPreviewIdx] = useState(0);
  const [previewPrompt, setPreviewPrompt] = useState(() => getRandomPrompt(prompts));

  function nextPreview() {
    setPreviewIdx(i => i + 1);
    setPreviewPrompt(getRandomPrompt(prompts));
  }

  const previewCluster = getCluster(previewPrompt.clusterId);

  function togglePrompt(id) {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
    setDirty(true);
  }
  function setWeight(id, w) {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, weight: w } : p));
    setDirty(true);
  }

  return (
    <div>
      <p className="section-eyebrow">Library</p>
      <h2 className="section-title">Prompt library</h2>
      <p className="section-desc">Toggle prompts on or off. Adjust weight to control how often a prompt surfaces relative to others in its cluster. Higher weight means more frequent.</p>

      <div className="preview-wrap">
        <p className="preview-label">Device preview</p>
        <div className="eink-frame">
          <div className="eink-cluster">
            <strong>{previewCluster?.title}</strong><br/>
            {previewCluster?.subtitle}
          </div>
          <hr className="eink-divider" />
          <div className="eink-prompt">{previewPrompt.text}</div>
          <div className="eink-footer">
            <span>pocket shadow</span>
            <span>nudge 2 of 3</span>
          </div>
        </div>
        <div className="preview-controls">
          <button className="preview-btn" onClick={nextPreview}>next prompt</button>
        </div>
      </div>

      {CLUSTERS.map(cluster => {
        const clusterPrompts = prompts.filter(p => p.clusterId === cluster.id);
        return (
          <div key={cluster.id} className="cluster-block">
            <div className="cluster-header">
              <div className="cluster-pip" style={{ background: cluster.color }} />
              <span className="cluster-name">{cluster.title}</span>
            </div>
            <p className="cluster-sub-text">{cluster.subtitle}</p>
            {clusterPrompts.map(prompt => (
              <div key={prompt.id} className={`prompt-row ${!prompt.active ? "inactive" : ""}`}>
                <button
                  className={`prompt-toggle ${prompt.active ? "on" : ""}`}
                  onClick={() => togglePrompt(prompt.id)}
                >
                  {prompt.active ? "✓" : ""}
                </button>
                <span className="prompt-text-area">{prompt.text}</span>
                <WeightPips value={prompt.weight} onChange={w => setWeight(prompt.id, w)} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SettingsTab({ settings, setSettings, setDirty }) {
  function update(key, val) {
    setSettings(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  }
  function updateNudge(idx, val) {
    const times = [...settings.nudgeTimes];
    times[idx] = val;
    update("nudgeTimes", times);
  }
  function addNudge() { update("nudgeTimes", [...settings.nudgeTimes, "12:00"]); }
  function removeNudge(idx) { update("nudgeTimes", settings.nudgeTimes.filter((_, i) => i !== idx)); }

  return (
    <div>
      <p className="section-eyebrow">Configuration</p>
      <h2 className="section-title">Device settings</h2>
      <p className="section-desc">Configure when your device nudges you, when the weekly check-in fires, and when the daily sync runs.</p>

      <div className="status-row">
        <div className="status-item">
          <div className="status-dot green" />
          <span className="status-text">Device last seen: today, 07:42</span>
        </div>
        <div className="status-item">
          <div className="status-dot green" />
          <span className="status-text">Last sync: today, 03:00</span>
        </div>
        <div className="status-item">
          <div className="status-dot amber" />
          <span className="status-text">Next check-in: {settings.checkInDay}, {settings.checkInTime}</span>
        </div>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <p className="settings-card-title">Daily nudge times</p>
          <div className="field-row">
            <label className="field-label">
              {settings.nudgeTimes.length === 0
                ? "No nudges scheduled"
                : `${settings.nudgeTimes.length} nudge${settings.nudgeTimes.length === 1 ? "" : "s"} per day`}
            </label>
            <div className="nudge-times">
              {settings.nudgeTimes.length === 0 && <span className="nudge-none">Device will not vibrate</span>}
              {settings.nudgeTimes.map((t, i) => (
                <div key={i} className="nudge-time-row">
                  <input type="time" className="field-input" value={t} onChange={e => updateNudge(i, e.target.value)} />
                  <button className="nudge-remove" onClick={() => removeNudge(i)} title="Remove">×</button>
                </div>
              ))}
              <button className="nudge-add" onClick={addNudge}>+ add nudge</button>
            </div>
          </div>
        </div>

        <div className="settings-card">
          <p className="settings-card-title">Weekly check-in</p>
          <div className="field-row">
            <label className="field-label">Day</label>
            <select className="field-select" value={settings.checkInDay} onChange={e => update("checkInDay", e.target.value)}>
              {DAYS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="field-row">
            <label className="field-label">Time</label>
            <input type="time" className="field-input" value={settings.checkInTime} onChange={e => update("checkInTime", e.target.value)} />
          </div>
        </div>

        <div className="settings-card">
          <p className="settings-card-title">Daily sync</p>
          <div className="field-row">
            <label className="field-label">Sync time (device pulls updates)</label>
            <input type="time" className="field-input" value={settings.syncTime} onChange={e => update("syncTime", e.target.value)} />
          </div>
          <div className="field-row">
            <label className="field-label">Sync status</label>
            <div style={{ fontSize: 12, color: "var(--ink-muted)", paddingTop: 4 }}>Device pulls latest prompt library and weights once daily at the configured time over WiFi.</div>
          </div>
        </div>

        <div className="settings-card">
          <p className="settings-card-title">About</p>
          <div style={{ fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.7 }}>
            <div>Firmware: v0.1.0</div>
            <div>Clusters: 5</div>
            <div style={{ marginTop: 8 }}>ESP32 + 2.13" e-ink</div>
            <div>LiPo 1000mAh</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckInTab({ prompts }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function startCheckin() {
    setStarted(true);
    setLoading(true);
    const opening = [{ role: "user", content: "Ready for my weekly check-in." }];
    const reply = await callClaude(opening);
    setMessages([{ role: "assistant", content: reply }]);
    setLoading(false);
  }

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);
    const reply = await callClaude(newMessages);
    const isComplete = reply.includes("[CHECK-IN COMPLETE]");
    const cleanReply = reply.replace("[CHECK-IN COMPLETE]", "").trim();
    setMessages(prev => [...prev, { role: "assistant", content: cleanReply }]);

    if (isComplete) {
      setDone(true);
      // Log the completed check-in to Supabase
      await supabase.from("ps_checkins").insert({
        user_id: USER_ID,
        prompt_text: cleanReply,
        cluster: "reference",
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        reflection_text: newMessages.filter(m => m.role === "user").map(m => m.content).join(" | "),
        reflection_at: new Date().toISOString(),
      });
    }
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div>
      <p className="section-eyebrow">Reflection</p>
      <h2 className="section-title">Weekly check-in</h2>
      <p className="section-desc">A brief AI-guided conversation that surfaces what the week revealed and adjusts which clusters get more airtime on your device.</p>

      {!started ? (
        <div className="checkin-intro">
          <p>This takes about five minutes. You'll be asked a few focused questions about the week. At the end, your prompt weights will be adjusted based on what came up.</p>
          <button className="save-btn" style={{ marginTop: "1rem", display: "inline-block" }} onClick={startCheckin}>
            Begin check-in
          </button>
        </div>
      ) : (
        <div className="checkin-container">
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role === "user" ? "user" : ""}`}>
                <div className={`msg-avatar ${m.role === "assistant" ? "ai" : "user"}`}>
                  {m.role === "assistant" ? "ps" : "R"}
                </div>
                <div className={`msg-bubble ${m.role === "assistant" ? "ai" : "user"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="msg">
                <div className="msg-avatar ai">ps</div>
                <div className="msg-bubble ai">
                  <div className="typing-indicator">
                    <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {!done && (
            <div className="checkin-input-row">
              <textarea
                className="checkin-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Type your response..."
                rows={1}
              />
              <button className="send-btn" onClick={send} disabled={loading || !input.trim()}>Send</button>
            </div>
          )}

          {done && (
            <div className="checkin-done">
              <p className="checkin-done-title">Check-in complete</p>
              <p className="checkin-done-text">Your prompt weights have been noted. Sync your device tonight to pull the updated library.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState("prompts");
  const [prompts, setPrompts] = useState(DEFAULT_PROMPTS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load from Supabase on mount
  useEffect(() => {
    async function init() {
      const [dbPrompts, dbSettings] = await Promise.all([
        loadPromptsFromDB(),
        loadSettingsFromDB(),
      ]);
      if (dbPrompts) setPrompts(dbPrompts);
      if (dbSettings) setSettings(dbSettings);
      setLoading(false);
    }
    init();
  }, []);

  async function save() {
    setSaving(true);
    await Promise.all([
      savePromptsToDB(prompts),
      saveSettingsToDB(settings),
    ]);
    setSaving(false);
    setDirty(false);
  }

  if (loading) {
    return (
      <>
        <style>{css}</style>
        <div className="app">
          <div className="loading-screen">
            <div className="loading-text">Loading...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <header className="header">
          <div className="header-left">
            <div className="header-wordmark">Pocket <span>Shadow</span></div>
            <div className="header-sub">shadow work device — config</div>
          </div>
          <nav className="header-nav">
            <button className={`nav-btn ${tab === "prompts" ? "active" : ""}`} onClick={() => setTab("prompts")}>Prompts</button>
            <button className={`nav-btn ${tab === "checkin" ? "active" : ""}`} onClick={() => setTab("checkin")}>Check-in</button>
            <button className={`nav-btn ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>Settings</button>
          </nav>
        </header>

        <main className="main">
          {tab === "prompts" && <PromptsTab prompts={prompts} setPrompts={setPrompts} setDirty={setDirty} />}
          {tab === "checkin" && <CheckInTab prompts={prompts} />}
          {tab === "settings" && <SettingsTab settings={settings} setSettings={setSettings} setDirty={setDirty} />}
        </main>

        <div className={`save-bar ${dirty ? "visible" : ""}`}>
          <span className="save-bar-text">{saving ? "Saving..." : "Unsaved changes"}</span>
          <button className="save-btn" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </>
  );
}
