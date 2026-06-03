// Parse a Booth schedule string like "W 8:30 AM-11:30 AM" or "TTH 1:30 PM-4:30 PM"
// into days + start/end minutes, for compact display and overlap detection.

export interface Sched {
  days: string[];        // e.g. ["T","TH"]
  start: number;         // minutes from midnight
  end: number;
  compact: string;       // e.g. "TTh 8:30–11:30"
}

const DAY_LABEL: Record<string, string> = {
  M: "M", T: "T", W: "W", TH: "Th", F: "F", SA: "Sa", SU: "Su",
};

function parseDays(s: string): string[] {
  // normalize full weekday names (bid format: "Wednesday, 08:30 am - 11:30 am")
  s = s.toUpperCase()
    .replace(/MONDAY/g, " M ").replace(/TUESDAY/g, " T ").replace(/WEDNESDAY/g, " W ")
    .replace(/THURSDAY/g, " TH ").replace(/FRIDAY/g, " F ")
    .replace(/SATURDAY/g, " SA ").replace(/SUNDAY/g, " SU ");
  const out: string[] = [];
  const re = /TH|TU|SA|SU|M|W|F|T|S/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    let d = m[0];
    if (d === "TU") d = "T";
    if (d === "S") d = "SA";
    out.push(d);
  }
  return out;
}

function toMinutes(h: number, min: number, mer: string | undefined, fallbackMer?: string): number {
  const m = (mer || fallbackMer || "AM").toUpperCase();
  let hh = h % 12;
  if (m === "PM") hh += 12;
  return hh * 60 + min;
}

export function parseSchedule(time: string | null): Sched | null {
  if (!time) return null;
  const dayPart = time.split(/\d/)[0] ?? "";
  const days = parseDays(dayPart.toUpperCase());
  const t = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*[-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!days.length || !t) return null;
  const endMer = t[6];
  const start = toMinutes(+t[1], +t[2], t[3], endMer);
  const end = toMinutes(+t[4], +t[5], endMer, t[3]);
  const fmt = (mins: number) => {
    const h = Math.floor(mins / 60), mm = mins % 60;
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(mm).padStart(2, "0")}`;
  };
  const dayStr = days.map((d) => DAY_LABEL[d] ?? d).join("");
  return { days, start, end, compact: `${dayStr} ${fmt(start)}–${fmt(end)}` };
}

export function overlaps(a: Sched | null, b: Sched | null): boolean {
  if (!a || !b) return false;
  if (!a.days.some((d) => b.days.includes(d))) return false;
  return a.start < b.end && b.start < a.end;
}
