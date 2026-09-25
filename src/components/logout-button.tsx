"use client";

import { useState } from "react";

/** Ends the app session (POST /api/auth/logout) and returns to the sign-in page. */
export function LogoutButton(props: { className?: string }) {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      // Full reload intentionally clears client state after logout.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
  }

  return (
    <button type="button" onClick={logout} disabled={busy} className={props.className}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
