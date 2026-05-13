"use client";

/**
 * Root-level error boundary (replaces RootLayout when something goes wrong
 * outside the route segment). Must render its own <html> + <body> tags and
 * cannot use Tailwind / globals.css since it bypasses the root layout.
 * Brand-matched inline styles only.
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
          fontFamily:
            "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          margin: 0,
          padding: "4rem 1.5rem",
          minHeight: "100vh",
          background:
            "linear-gradient(135deg, #100020 0%, #200040 50%, #401080 100%)",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center"
        }}
      >
        <svg
          viewBox="0 0 120 40"
          width="160"
          height="54"
          xmlns="http://www.w3.org/2000/svg"
          style={{ marginBottom: "2rem" }}
        >
          <path
            d="M2 38 L18 2 L34 38 L28 38 L24 28 L12 28 L8 38 Z M14 22 L22 22 L18 12 Z"
            fill="#ffffff"
          />
          <rect x="54" y="2" width="8" height="36" fill="#ffffff" />
          <path
            d="M82 20 L100 2 L118 20 L100 38 Z M88 20 L100 8 L112 20 L100 32 Z"
            fill="#ffffff"
          />
        </svg>
        <p
          style={{
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.3em",
            color: "rgba(255, 255, 255, 0.7)",
            margin: 0
          }}
        >
          Application error
        </p>
        <h1
          style={{
            marginTop: "0.75rem",
            fontSize: "2rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#ffffff"
          }}
        >
          We hit an unrecoverable error
        </h1>
        <p
          style={{
            marginTop: "0.75rem",
            color: "rgba(255, 255, 255, 0.75)",
            maxWidth: "28rem",
            lineHeight: 1.6
          }}
        >
          {error.message ||
            "The site couldn't recover. Please reload, and if the problem persists, contact the organizer."}
        </p>
        {error.digest ? (
          <p
            style={{
              marginTop: "0.5rem",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              fontSize: "0.75rem",
              color: "rgba(255, 255, 255, 0.5)"
            }}
          >
            ref: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "2rem",
            background: "#824adb",
            color: "#ffffff",
            border: "none",
            borderRadius: "0.375rem",
            padding: "0.625rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)"
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
