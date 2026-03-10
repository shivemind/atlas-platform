export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Atlas Platform Service</h1>
      <p>
        Orgs, teams, RBAC, onboarding, underwriting, webhooks, events, reports,
        exports, cron jobs, and platform ops.
      </p>
      <p>
        Health check:{" "}
        <a href="/api/health">
          <code>/api/health</code>
        </a>
      </p>
    </main>
  );
}
