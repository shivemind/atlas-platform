# @atlas/platform

Platform service for AtlasPayments — handles organizations, teams, RBAC, merchant onboarding, underwriting, webhook management, events API, reports, exports, cron jobs, and platform operations.

## API Routes

### Merchant-Facing (`/api/v1/`)

| Route | Methods | Description |
|---|---|---|
| `/api/v1/webhook_endpoints` | GET, POST | List/create webhook endpoints |
| `/api/v1/webhook_endpoints/:id` | GET, PATCH, DELETE | Manage a webhook endpoint |
| `/api/v1/webhook_endpoints/:id/test` | POST | Send a test webhook delivery |
| `/api/v1/webhook_endpoints/:id/rotate_secret` | POST | Rotate webhook signing secret |
| `/api/v1/webhook_deliveries` | GET | List webhook deliveries |
| `/api/v1/webhook_deliveries/:id` | GET | Get a webhook delivery |
| `/api/v1/webhook_deliveries/:id/replay` | POST | Replay a webhook delivery |
| `/api/v1/webhook_deliveries/resend` | POST | Bulk resend failed deliveries |
| `/api/v1/events` | GET | List events (cursor pagination) |
| `/api/v1/events/:id` | GET | Get a single event |
| `/api/v1/reports` | GET, POST | List/create reports |
| `/api/v1/reports/:id` | GET | Get report status |
| `/api/v1/reports/:id/cancel` | POST | Cancel a queued report |
| `/api/v1/exports` | GET, POST | List/create exports |
| `/api/v1/exports/:id` | GET | Get export status |
| `/api/v1/exports/:id/cancel` | POST | Cancel a queued export |
| `/api/v1/export_schedules` | GET, POST | List/create export schedules |
| `/api/v1/export_schedules/:id` | GET, PATCH, DELETE | Manage an export schedule |

### Platform Admin (`/api/internal/`)

| Route | Methods | Description |
|---|---|---|
| `/api/internal/orgs` | GET, POST | List/create organizations |
| `/api/internal/orgs/:orgId` | GET, PATCH, DELETE | Manage an organization |
| `/api/internal/orgs/:orgId/members` | GET, POST | List/add org members |
| `/api/internal/orgs/:orgId/members/:id` | GET, PATCH, DELETE | Manage a member |
| `/api/internal/orgs/:orgId/roles` | GET, POST | List/create RBAC roles |
| `/api/internal/orgs/:orgId/roles/:id` | GET, PATCH, DELETE | Manage a role |
| `/api/internal/orgs/:orgId/teams` | GET, POST | List/create teams |
| `/api/internal/orgs/:orgId/teams/:teamId` | GET, PATCH, DELETE | Manage a team |
| `/api/internal/orgs/:orgId/teams/:teamId/members` | GET, POST | List/add team members |
| `/api/internal/orgs/:orgId/teams/:teamId/members/:id` | DELETE | Remove a team member |
| `/api/internal/orgs/:orgId/audit_logs` | GET | List org audit logs |
| `/api/internal/onboarding` | GET, POST | List/create onboarding profiles |
| `/api/internal/onboarding/:id` | GET, PATCH, DELETE | Manage an onboarding profile |
| `/api/internal/onboarding/:id/submit` | POST | Submit profile for review |
| `/api/internal/onboarding/:id/owners` | GET, POST | List/add beneficial owners |
| `/api/internal/onboarding/:id/owners/:ownerId` | GET, PATCH, DELETE | Manage an owner |
| `/api/internal/onboarding/:id/documents` | GET, POST | List/add documents |
| `/api/internal/onboarding/:id/documents/:docId` | GET, PATCH | Review a document |
| `/api/internal/onboarding/:id/bank_accounts` | GET, POST | List/add bank accounts |
| `/api/internal/onboarding/:id/bank_accounts/:baId` | GET, PATCH, DELETE | Manage a bank account |
| `/api/internal/underwriting/cases` | GET, POST | List/create underwriting cases |
| `/api/internal/underwriting/cases/:id` | GET, PATCH | Manage an underwriting case |
| `/api/internal/underwriting/cases/:id/decisions` | GET, POST | List/record decisions |
| `/api/internal/events` | GET | List all events (admin) |
| `/api/internal/events/:id` | GET | Get a single event (admin) |
| `/api/internal/webhooks/endpoints` | GET | List all webhook endpoints (admin) |
| `/api/internal/webhooks/deliveries` | GET | List all webhook deliveries (admin) |
| `/api/internal/webhooks/deliveries/:id/retry` | POST | Retry a delivery |
| `/api/internal/reports` | GET | List all reports (admin) |
| `/api/internal/reports/:id` | GET, PATCH | Manage report status |
| `/api/internal/exports` | GET | List all exports (admin) |
| `/api/internal/exports/:id` | GET, PATCH | Manage export status |
| `/api/internal/audit_logs` | GET | List all audit logs (admin) |
| `/api/internal/ops/jobs` | GET, POST | List/create jobs |
| `/api/internal/ops/jobs/:id` | GET, PATCH | Manage a job |
| `/api/internal/ops/jobs/:id/retry` | POST | Retry a failed job |
| `/api/internal/ops/jobs/:id/cancel` | POST | Cancel a job |
| `/api/internal/ops/dead_letters` | GET | List dead letters |
| `/api/internal/ops/dead_letters/:id` | GET | Get a dead letter |
| `/api/internal/ops/dead_letters/:id/reprocess` | POST | Reprocess a dead letter |
| `/api/internal/ops/dead_letters/:id/discard` | POST | Discard a dead letter |

### Cron (`/api/internal/cron/`)

| Route | Methods | Description |
|---|---|---|
| `/api/internal/cron/webhooks/retry` | GET, POST | Retry pending webhook deliveries |
| `/api/internal/cron/billing/run` | GET, POST | Process subscription billing |
| `/api/internal/cron/exports/run` | GET, POST | Process scheduled exports |
| `/api/internal/cron/risk/run` | GET, POST | Expire risk list entries |
| `/api/internal/cron/reconciliation/run` | GET, POST | Advance reconciliation periods |

### Health

| Route | Methods | Description |
|---|---|---|
| `/api/health` | GET | Service health check |

## Development

```bash
pnpm install
pnpm prisma:generate
pnpm dev              # runs on port 3005
```

## Testing

```bash
pnpm test
```

## OpenAPI

```bash
pnpm openapi:validate
pnpm openapi:lint
```
