import { useRef, useState } from "react";
import Invitation from "./components/Invitation";
import {
  createGoogleCalendarUrl,
  DEFAULT_TIME_ZONE,
  downloadIcs,
  getCurrentDateInTimeZone,
} from "./lib/calendar";
import { reserve } from "./lib/api";
import {
  dateTypes,
  type DateType,
  type Reservation,
} from "./lib/reservation";

function SiteFooter() {
  return (
    <footer>
      <div className="footer-tagline">
        LESS SCROLLING <span aria-hidden="true">✳</span> MORE MEMORIES
      </div>
    </footer>
  );
}

export default function App() {
  const path = window.location.pathname;
  const normalizedPath = path.replace(/\/+$/, "") || "/";
  let invitePath = "";
  try {
    if (
      normalizedPath !== "/" &&
      /^\/[^/]+$/.test(normalizedPath)
    )
      invitePath = decodeURIComponent(path.replace(/^\/|\/$/g, ""));
  } catch {
    /* Invalid URL stays on the minimal page. */
  }
  const [step, setStep] = useState<"invite" | "form" | "success">("invite");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:30");
  const [type, setType] = useState<DateType>("coffee");
  const [activity, setActivity] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<Reservation>();
  const googleCalendarUrl = confirmed
    ? createGoogleCalendarUrl(confirmed)
    : "";
  const minimumDate = getCurrentDateInTimeZone();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    if (date && date < getCurrentDateInTimeZone()) {
      setError("Please choose today or a future date in Bangkok.");
      return;
    }
    if (type === "other" && !activity.trim()) {
      setError("Tell me what you’d like to do ✨");
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError("");
    const reservation: Reservation = {
      invitePath, date, time, type,
      ...(type === "other" ? { activity: activity.trim() } : {}),
    };
    try {
      await reserve(reservation);
      setConfirmed(reservation);
      setStep("success");
    } catch (caught) {
      setError(
        caught instanceof Error && caught.name === "Error"
          ? caught.message
          : "Couldn’t confirm your date. Please try again 🥲",
      );
    } finally {
      setPending(false);
      inFlight.current = false;
    }
  }

  if (normalizedPath === "/")
    return <main className="empty"><p>Nothing to see here 👀</p></main>;
  if (!invitePath)
    return <main className="empty"><p>Nothing to see here 👀</p></main>;
  return (
    <div className="page">
      <header>
        <a className="brand" href={path}>
          <span aria-hidden="true">✳</span> dating with jedi
        </a>
        <span className="header-note">a little time, together</span>
      </header>
      <main className={`card ${step}`}>
        <div className="card-top">
          <span>YOU + ME + A PLAN</span>
          <span aria-hidden="true">♡</span>
        </div>
        {step === "invite" && <Invitation onYes={() => setStep("form")} />}
        {step === "form" && (
          <>
            <button
              className="back-button"
              type="button"
              disabled={pending}
              onClick={() => {
                setError("");
                setStep("invite");
              }}
            >
              <span aria-hidden="true">← </span>Back
            </button>
            <p className="eyebrow">THAT’S A YES, THEN ✨</p>
            <h1>
              Let’s make
              <br />
              <em>a little plan.</em>
            </h1>
            <p className="intro">Pick a day. Pick a vibe. I’ll be there.</p>
            <form onSubmit={submit}>
              <fieldset disabled={pending}>
                <legend className="sr-only">Choose our date</legend>
                <div className="datetime">
                  <label>
                    Date
                    <input
                      autoFocus
                      type="date"
                      value={date}
                      required
                      min={minimumDate}
                      max="9999-12-31"
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </label>
                  <label>
                    Time
                    <input
                      type="time"
                      value={time}
                      required
                      onChange={(event) => setTime(event.target.value)}
                    />
                  </label>
                </div>
                <fieldset className="types">
                  <legend>What are we doing?</legend>
                  <div className="type-grid">
                    {dateTypes.map((option) => (
                      <label
                        key={option.value}
                        className={`type-option ${type === option.value ? "selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="type"
                          value={option.value}
                          checked={type === option.value}
                          onChange={() => setType(option.value)}
                        />
                        <span aria-hidden="true">{option.emoji}</span>
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {type === "other" && (
                  <label className="custom-activity">
                    What do you have in mind?
                    <input
                      type="text"
                      value={activity}
                      onChange={(event) => setActivity(event.target.value)}
                      placeholder="A picnic in the park…"
                      required
                      maxLength={200}
                    />
                  </label>
                )}
              </fieldset>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="primary confirm"
                disabled={pending}
                type="submit"
              >
                {pending ? "Saving our date…" : "Confirm date 💖"}
              </button>
              <p className="small">A little something to look forward to.</p>
            </form>
          </>
        )}
        {step === "success" && confirmed && (
          <div>
            <div role="status">
              <div className="success-icon" aria-hidden="true">
                💌
              </div>
              <p className="eyebrow">OFFICIALLY ON THE SCHEDULE</p>
              <h1>It’s a date! 💖</h1>
              <div className="receipt">
                <p>
                  {new Intl.DateTimeFormat("en", {
                    dateStyle: "long",
                    timeZone: "UTC",
                  }).format(new Date(`${confirmed.date}T00:00:00Z`))}
                </p>
                <p>
                  {confirmed.time} · {DEFAULT_TIME_ZONE}
                </p>
                <strong>
                  {
                    dateTypes.find((option) => option.value === confirmed.type)
                      ?.emoji
                  }{" "}
                  {confirmed.activity ||
                    dateTypes.find((option) => option.value === confirmed.type)
                      ?.label}
                </strong>
              </div>
              <p className="intro">See you there ✨</p>
            </div>
            <div
              className="calendar-actions"
              aria-label="Calendar export options"
            >
              <a
                className="primary export-action"
                href={googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Add to Google Calendar
              </a>
              <button
                className="secondary export-action"
                type="button"
                onClick={() => downloadIcs(confirmed)}
              >
                Download .ics
              </button>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
