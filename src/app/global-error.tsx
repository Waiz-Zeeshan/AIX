"use client";

/**
 * Root-level error boundary (replaces RootLayout when something goes wrong
 * outside the route segment). Must render its own <html> + <body> tags per
 * Next.js App Router docs.
 */

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          margin: 0,
          padding: "4rem 1.5rem",
          minHeight: "100vh",
          background: "#fff",
          color: "#18181b",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center"
        }}
      >
        <p
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#dc2626"
          }}
        >
          Application error
        </p>
        <h1 style={{ marginTop: "0.5rem", fontSize: "1.875rem", fontWeight: 600 }}>
          We hit an unrecoverable error
        </h1>
        <p style={{ marginTop: "0.75rem", color: "#71717a", maxWidth: "28rem" }}>
          {error.message ||
            "The site couldn't recover. Please reload, and if the problem persists, contact the organizer."}
        </p>
        {error.digest ? (
          <p style={{ marginTop: "0.5rem", fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", color: "#a1a1aa" }}>
            ref: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "2rem",
            background: "#18181b",
            color: "#fff",
            border: "none",
            borderRadius: "0.375rem",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer"
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
