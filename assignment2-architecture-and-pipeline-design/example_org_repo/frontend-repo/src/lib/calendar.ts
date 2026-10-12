import { DATE_TYPES, type Reservation } from "./reservation";

export const DEFAULT_TIME_ZONE = "Asia/Bangkok";

export function getCurrentDateInTimeZone(
  now = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const formatterFor = (timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

function localStamp(instant: number, formatter: Intl.DateTimeFormat): string {
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

export function localDateTimeToUtc(
  date: string,
  time: string,
  timeZone = DEFAULT_TIME_ZONE,
): Date {
  const target = `${date}T${time}:00`;
  const wallTime = Date.parse(`${target}Z`);
  if (!Number.isFinite(wallTime)) throw new Error("Invalid date or time.");

  const formatter = formatterFor(timeZone);
  const matches = new Set<number>();
  for (const shift of [-86_400_000, 0, 86_400_000]) {
    const sample = wallTime + shift;
    const offset = Date.parse(`${localStamp(sample, formatter)}Z`) - sample;
    const candidate = wallTime - offset;
    if (localStamp(candidate, formatter) === target) matches.add(candidate);
  }
  if (!matches.size)
    throw new Error("This local time does not exist in the selected timezone.");
  return new Date(Math.min(...matches));
}

export function formatUtcCalendarDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function getCalendarEvent(reservation: Reservation) {
  const definition = DATE_TYPES[reservation.type];
  if (!definition) throw new Error("Unsupported date type.");
  const start = localDateTimeToUtc(reservation.date, reservation.time);
  const end = new Date(
    start.getTime() + definition.durationMinutes * 60_000,
  );
  const description = reservation.activity
    ? `Activity: ${reservation.activity}\n\nConfirmed via dating-with-jedi`
    : "Confirmed via dating-with-jedi";
  return { title: definition.title, description, start, end };
}

export function createGoogleCalendarUrl(reservation: Reservation): string {
  const event = getCalendarEvent(reservation);
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", event.title);
  url.searchParams.set(
    "dates",
    `${formatUtcCalendarDate(event.start)}/${formatUtcCalendarDate(event.end)}`,
  );
  url.searchParams.set("details", event.description);
  return url.toString();
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const folded: string[] = [];
  let current = "";
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75 && current) {
      folded.push(current);
      current = ` ${character}`;
      bytes = 1 + size;
    } else {
      current += character;
      bytes += size;
    }
  }
  folded.push(current);
  return folded.join("\r\n");
}

export function createIcsContent(
  reservation: Reservation,
  uid = `${crypto.randomUUID()}@dating-with-jedi`,
  createdAt = new Date(),
): string {
  const event = getCalendarEvent(reservation);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//dating-with-jedi//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${formatUtcCalendarDate(createdAt)}`,
    `DTSTART:${formatUtcCalendarDate(event.start)}`,
    `DTEND:${formatUtcCalendarDate(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function downloadIcs(reservation: Reservation): void {
  const blob = new Blob([createIcsContent(reservation)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dating-with-jedi-${reservation.date}.ics`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
