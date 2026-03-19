export default function NotFound() {
  return (
    <div style={{ paddingTop: 40 }}>
      <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
        404
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-1)", marginBottom: 10 }}>
        Model not found
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.7, maxWidth: 400 }}>
        This model doesn&apos;t exist yet. To add it, open{" "}
        <code style={{ background: "var(--surface)", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>lib/models.ts</code>{" "}
        and add a new entry to the <code style={{ background: "var(--surface)", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>MODELS</code> array.
      </p>
    </div>
  )
}
