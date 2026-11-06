"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BOOKING_WINDOW_DAYS, CLOSED_WEEKDAY, SLOTS, clinic, concerns } from "../content";
import { goScene } from "./sceneState";

type Day = { iso: string; dow: string; num: number; mon: string };

function openDays(): Day[] {
  const out: Day[] = [];
  const now = new Date();
  for (let i = 1; i <= BOOKING_WINDOW_DAYS && out.length < 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (d.getDay() === CLOSED_WEEKDAY) continue;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ iso, dow: d.toLocaleDateString("en", { weekday: "short" }), num: d.getDate(), mon: d.toLocaleDateString("en", { month: "short" }) });
  }
  return out;
}

const STEPS = ["Concern", "Time", "Details"];

// Mounted only after the first click, so it never prerenders with a stale date.
function TimeStep({ mode, setMode, date, time, onDate, setTime, taken, loading }: {
  mode: string; setMode: (m: string) => void; date: string; time: string; onDate: (d: string) => void;
  setTime: (t: string) => void; taken: string[] | null; loading: boolean;
}) {
  const days = useMemo(() => openDays(), []);
  return (
    <>
      <h3>When suits you?</h3>
      <div className="seg" role="group" aria-label="Visit type">
        {["In clinic", "Video"].map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{m}</button>
        ))}
      </div>
      <div className="days" role="group" aria-label="Date" data-lenis-prevent>
        {days.map((d) => (
          <button key={d.iso} type="button" aria-pressed={date === d.iso} className={date === d.iso ? "on" : ""} onClick={() => onDate(d.iso)}>
            <small>{d.dow}</small><b>{d.num}</b><small>{d.mon}</small>
          </button>
        ))}
      </div>
      {date && (
        <div className="slots" role="group" aria-label="Time" aria-busy={loading}>
          {SLOTS.map((s) => {
            const gone = !taken || taken.includes(s);
            return <button key={s} type="button" disabled={gone} aria-pressed={time === s} className={time === s ? "on" : ""} onClick={() => setTime(s)}>{s}</button>;
          })}
        </div>
      )}
    </>
  );
}

export default function Booking() {
  const [step, setStep] = useState(0);
  const [concern, setConcern] = useState("");
  const [mode, setMode] = useState("In clinic");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [taken, setTaken] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doneId, setDoneId] = useState("");
  const latest = useRef("");
  const spacer = useRef<HTMLDivElement>(null);

  // Draw the particle checkmark inside the confirmation panel.
  useEffect(() => {
    const el = spacer.current;
    if (!doneId || !el) return;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    const worldHalfH = Math.tan((45 * Math.PI) / 360) * 5;
    const x = ((r.left + r.width / 2) / innerWidth) * 2 - 1;
    const y = (1 - ((r.top + r.height / 2) / innerHeight) * 2) * worldHalfH;
    goScene(5, x, 0.9, 0.5, false, y);
  }, [doneId]);

  async function loadSlots(d: string) {
    latest.current = d;
    setDate(d); setTime(""); setTaken(null); setLoading(true); setError("");
    try {
      const res = await fetch(`/api/bookings?date=${d}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (latest.current === d) setTaken(json.taken);
    } catch {
      if (latest.current === d) setError("Could not load times. Please pick the date again.");
    } finally {
      if (latest.current === d) setLoading(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError("");
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concern, mode, date, time, name: f.get("name"), phone: f.get("phone"), email: f.get("email"),
          notes: f.get("notes"), website: f.get("website"), consent: f.get("consent") === "on",
        }),
      });
      const json = await res.json();
      if (res.status === 409) { setStep(1); setError(json.error); loadSlotsKeepError(date, json.error); return; }
      if (!res.ok) { setError(json.error ?? "Something went wrong."); return; }
      setDoneId(json.id);
    } catch {
      setError("Could not reach the clinic. Your booking was not made, please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function loadSlotsKeepError(d: string, msg: string) {
    await loadSlots(d);
    setError(msg);
  }

  function reset() {
    setStep(0); setConcern(""); setDate(""); setTime(""); setTaken(null); setDoneId(""); setError("");
    goScene(0, -0.5, 0.16, 0.9);
  }

  const when = date && new Date(`${date}T00:00:00`).toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" });

  if (doneId) {
    return (
      <div className="panel done" role="status">
        <div className="done-spacer" ref={spacer} aria-hidden="true" />
        <h3>You nailed it!</h3>
        <p><b>You&rsquo;re booked.</b></p>
        <p>{concern}, {mode.toLowerCase()}, on {when} at {time}.</p>
        <p className="ref">Reference <b>{doneId}</b></p>
        <p className="fine">The clinic will call to confirm. Need to change it? Call {clinic.phone}.</p>
        <button type="button" className="btn ghost" onClick={reset}>Book another visit</button>
      </div>
    );
  }

  return (
    <div className="panel">
      <ol className="steps">
        {STEPS.map((s, i) => <li key={s} className={i <= step ? "on" : ""} aria-current={i === step ? "step" : undefined}>{s}</li>)}
      </ol>

      {step === 0 && (
        <>
          <h3>What brings you in?</h3>
          <div className="chips">
            {concerns.map((c) => (
              <button key={c.title} type="button" aria-pressed={concern === c.title} className={concern === c.title ? "on" : ""}
                onClick={() => { setConcern(c.title); setStep(1); }}>{c.title}</button>
            ))}
          </div>
        </>
      )}

      {step === 1 && <TimeStep {...{ mode, setMode, date, time, setTime, taken, loading }} onDate={loadSlots} />}

      {step === 2 && (
        <form onSubmit={submit} className="form">
          <h3>Last step</h3>
          <p className="summary">{concern} · {mode} · {when} · {time}</p>
          <label>Full name<input name="name" required minLength={2} maxLength={80} autoComplete="name" /></label>
          <label>Phone<input name="phone" type="tel" required maxLength={24} autoComplete="tel" /></label>
          <label>Email (optional)<input name="email" type="email" maxLength={120} autoComplete="email" /></label>
          <label>Anything we should know? (optional)<textarea name="notes" rows={2} maxLength={500} /></label>
          <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <label className="check"><input type="checkbox" name="consent" required /> The clinic may store these details and contact me about this appointment.</label>
          <button className="btn" disabled={busy}>{busy ? "Booking…" : "Confirm appointment"}</button>
        </form>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <div className="nav-row">
        {step > 0 && <button type="button" className="link" onClick={() => { setStep(step - 1); setError(""); }}>← Back</button>}
        {step === 1 && <button type="button" className="btn small" disabled={!time} onClick={() => setStep(2)}>Continue →</button>}
      </div>
    </div>
  );
}
