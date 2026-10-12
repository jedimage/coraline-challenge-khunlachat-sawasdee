import type { Reservation } from "./reservation";

export type { Reservation } from "./reservation";

export async function reserve(reservation: Reservation): Promise<void> {
  const base = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
    /\/+$/,
    "",
  );
  const endpoint = base.endsWith("/api")
    ? `${base}/reserve`
    : `${base}/api/reserve`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservation),
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 403)
    throw new Error("This invitation is not valid 👀");
  if (response.status === 400)
    throw new Error("Please check your date, time, and activity.");
  if (!response.ok)
    throw new Error("Something went wrong 🥲 Please try again.");
  const result = await response.json();
  if (result.success !== true)
    throw new Error("Something went wrong 🥲 Please try again.");
}
