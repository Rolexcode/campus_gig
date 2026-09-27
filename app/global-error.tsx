"use client";

import Link from "next/link";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body>
        <main
          id="main-content"
          tabIndex={-1}
          style={{
            alignItems: "center",
            background: "#f6f8f7",
            color: "#101c18",
            display: "flex",
            fontFamily: "Arial, sans-serif",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "24px",
          }}
        >
          <section
            role="alert"
            style={{
              background: "#ffffff",
              border: "1px solid #dce4e0",
              borderRadius: "18px",
              boxShadow: "0 18px 48px rgba(16, 28, 24, 0.08)",
              maxWidth: "560px",
              padding: "40px",
              textAlign: "center",
              width: "100%",
            }}
          >
            <p style={{ color: "#087f5b", fontSize: "13px", fontWeight: 700 }}>
              CAMPUSGIG
            </p>
            <h1 style={{ fontSize: "30px", margin: "14px 0 0" }}>
              We could not open CampusGig
            </h1>
            <p style={{ color: "#5d6b66", lineHeight: 1.7, margin: "16px 0 0" }}>
              No action was completed. Retry now, or return to the home page and
              continue from there.
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                justifyContent: "center",
                marginTop: "28px",
              }}
            >
              <button
                onClick={reset}
                style={{
                  background: "#087f5b",
                  border: 0,
                  borderRadius: "10px",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: 700,
                  minHeight: "44px",
                  padding: "0 20px",
                }}
                type="button"
              >
                Try again
              </button>
              <Link
                href="/"
                style={{
                  alignItems: "center",
                  border: "1px solid #cbd7d2",
                  borderRadius: "10px",
                  color: "#101c18",
                  display: "inline-flex",
                  fontSize: "15px",
                  fontWeight: 700,
                  minHeight: "44px",
                  padding: "0 20px",
                  textDecoration: "none",
                }}
              >
                Return home
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
