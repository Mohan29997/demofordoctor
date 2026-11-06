import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { BOOKING_WINDOW_DAYS, CLOSED_WEEKDAY, SLOTS, concerns } from "../../content";

type Booking = {
  id: string; concern: string; mode: string; date: string; time: string;
  name: string; phone: string; email: string; notes: string; createdAt: string;
};

const FILE = path.join(process.cwd(), "data", "bookings.json");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

async function load(): Promise<Booking[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function save(all: Booking[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(all, null, 2));
  await rename(tmp, FILE);
}

// Serialises writes so two requests cannot claim the same slot.
let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

function validDate(date: string) {
  if (!DATE_RE.test(date)) return false;
  const t = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== date) return false;
  const now = Date.now();
  return t > now - DAY && t < now + (BOOKING_WINDOW_DAYS + 1) * DAY && new Date(t).getUTCDay() !== CLOSED_WEEKDAY;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Returns only taken times, never patient details.
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!validDate(date)) return Response.json({ error: "Invalid date" }, { status: 400 });
  const all = await load();
  return Response.json({ taken: all.filter((b) => b.date === date).map((b) => b.time) });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request" }, { status: 400 });

  // Honeypot: pretend success so bots do not retry.
  if (text(body.website, 100)) return Response.json({ id: "ok" }, { status: 201 });

  const b = {
    concern: text(body.concern, 60), mode: text(body.mode, 20), date: text(body.date, 10), time: text(body.time, 5),
    name: text(body.name, 80), phone: text(body.phone, 24), email: text(body.email, 120), notes: text(body.notes, 500),
  };
  const digits = b.phone.replace(/\D/g, "").length;
  if (!concerns.some((c) => c.title === b.concern)) return Response.json({ error: "Please choose a concern." }, { status: 400 });
  if (b.mode !== "In clinic" && b.mode !== "Video") return Response.json({ error: "Please choose a visit type." }, { status: 400 });
  if (!validDate(b.date) || !SLOTS.includes(b.time)) return Response.json({ error: "Please choose a valid date and time." }, { status: 400 });
  if (b.name.length < 2) return Response.json({ error: "Please enter your name." }, { status: 400 });
  if (digits < 7 || digits > 15) return Response.json({ error: "Please enter a valid phone number." }, { status: 400 });
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return Response.json({ error: "Please enter a valid email." }, { status: 400 });
  if (body.consent !== true) return Response.json({ error: "Please agree so we can contact you." }, { status: 400 });

  return locked(async () => {
    const all = await load();
    if (all.some((x) => x.date === b.date && x.time === b.time)) {
      return Response.json({ error: "That slot was just taken. Please pick another time." }, { status: 409 });
    }
    const booking: Booking = { ...b, id: randomUUID().slice(0, 8).toUpperCase(), createdAt: new Date().toISOString() };
    await save([...all, booking]);
    return Response.json({ id: booking.id }, { status: 201 });
  });
}
