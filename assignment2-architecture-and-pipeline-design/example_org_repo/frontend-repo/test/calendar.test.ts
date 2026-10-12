import assert from "node:assert/strict";
import test from "node:test";
import {
  createGoogleCalendarUrl,
  createIcsContent,
  escapeIcsText,
  getCurrentDateInTimeZone,
  getCalendarEvent,
  localDateTimeToUtc,
} from "../src/lib/calendar";
import { DATE_TYPES, type Reservation } from "../src/lib/reservation";

const dinner: Reservation = {
  invitePath: "test-invitation",
  date: "2026-09-25",
  time: "18:30",
  type: "dinner",
};

test("gets the current calendar date in Bangkok", () => {
  assert.equal(
    getCurrentDateInTimeZone(new Date("2026-09-22T16:59:59Z")),
    "2026-09-22",
  );
  assert.equal(
    getCurrentDateInTimeZone(new Date("2026-09-22T17:00:00Z")),
    "2026-09-23",
  );
});

test("date types define the canonical event titles and durations", () => {
  assert.deepEqual(DATE_TYPES, {
    coffee: {
      label: "Coffee",
      emoji: "☕",
      title: "☕ Coffee Date",
      durationMinutes: 90,
    },
    beer: {
      label: "Beer",
      emoji: "🍺",
      title: "🍺 Beer Date",
      durationMinutes: 120,
    },
    dinner: {
      label: "Dinner",
      emoji: "🍝",
      title: "🍝 Dinner Date",
      durationMinutes: 120,
    },
    movie: {
      label: "Movie",
      emoji: "🎬",
      title: "🎬 Movie Date",
      durationMinutes: 180,
    },
    "theme-park": {
      label: "Theme park",
      emoji: "🎡",
      title: "🎡 Theme Park Date",
      durationMinutes: 300,
    },
    other: {
      label: "Something else",
      emoji: "✨",
      title: "💖 Date",
      durationMinutes: 120,
    },
  });
});

test("converts Bangkok local time to UTC without using the host timezone", () => {
  assert.equal(
    localDateTimeToUtc("2026-09-25", "18:30").toISOString(),
    "2026-09-25T11:30:00.000Z",
  );
  const event = getCalendarEvent(dinner);
  assert.equal(event.title, "🍝 Dinner Date");
  assert.equal(event.start.toISOString(), "2026-09-25T11:30:00.000Z");
  assert.equal(event.end.toISOString(), "2026-09-25T13:30:00.000Z");
});

test("builds an unauthenticated Google Calendar template URL", () => {
  const url = new URL(createGoogleCalendarUrl(dinner));
  assert.equal(url.origin, "https://calendar.google.com");
  assert.equal(url.pathname, "/calendar/render");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(url.searchParams.get("text"), "🍝 Dinner Date");
  assert.equal(
    url.searchParams.get("dates"),
    "20260925T113000Z/20260925T133000Z",
  );
  assert.equal(
    url.searchParams.get("details"),
    "Confirmed via dating-with-jedi",
  );
});

test("creates an iCalendar event with UTC start and end times", () => {
  const content = createIcsContent(
    dinner,
    "test-id@dating-with-jedi",
    new Date("2026-09-22T01:02:03.456Z"),
  );
  for (const line of [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//dating-with-jedi//EN",
    "BEGIN:VEVENT",
    "UID:test-id@dating-with-jedi",
    "DTSTAMP:20260922T010203Z",
    "DTSTART:20260925T113000Z",
    "DTEND:20260925T133000Z",
    "SUMMARY:🍝 Dinner Date",
    "DESCRIPTION:Confirmed via dating-with-jedi",
    "END:VEVENT",
    "END:VCALENDAR",
  ])
    assert.ok(content.includes(`${line}\r\n`), `Missing ${line}`);
});

test("escapes iCalendar text metacharacters and newlines", () => {
  assert.equal(
    escapeIcsText("Back\\slash, semicolon;\r\nnext line"),
    "Back\\\\slash\\, semicolon\\;\\nnext line",
  );
  const content = createIcsContent(
    {
      ...dinner,
      type: "other",
      activity: "Picnic, games; bring \\ blankets\nOutside",
    },
    "custom-id",
    new Date("2026-09-22T01:02:03Z"),
  );
  assert.ok(content.includes("\r\n "), "Expected a folded iCalendar line");
  const unfolded = content.replace(/\r\n /g, "");
  assert.ok(
    unfolded.includes(
      "DESCRIPTION:Activity: Picnic\\, games\\; bring \\\\ blankets\\nOutside\\n\\nConfirmed via dating-with-jedi",
    ),
  );
});
