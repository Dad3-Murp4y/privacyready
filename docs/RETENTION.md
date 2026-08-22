# PrivacyReady internal retention schedule

This document describes the retention boundaries implemented in the application. It is operational guidance, not a public privacy notice or legal determination.

## Schedule

| Record | Eligibility boundary | Implemented action |
| --- | --- | --- |
| Active organisation and account data | Not eligible while no deletion request exists | Retained |
| Organisation requested for deletion | 30 days after `deletionRequestedAt` | Delete the organisation and its cascading users, scans and DSRs |
| Authenticated scans and embedded findings | 12 months after scan creation | Delete the Scan row and embedded findings JSON |
| Anonymous unclaimed scans | 24 hours after `claimTokenExpires` | Delete the Scan row |
| Closed DSRs | 24 months after `resolvedAt` when status is `COMPLETED` or `REJECTED` | Delete the DSR row |
| Expired email-verification tokens | At token expiry | Clear the hash and expiry fields; retain the user account |
| Expired password-reset tokens | At token expiry | Clear the hash and expiry fields; retain the user account |
| Email suppression records | Excluded from age-based cleanup | Retain until a separately reviewed operational or legal decision permits removal |

CloudWatch log retention and RDS backup retention are managed separately and are not changed by this application cleanup.

## Subscription cancellation and deletion

Stripe subscription cancellation changes billing and entitlement status only. It does not request or perform account deletion.

Organisation deletion requires an authenticated organisation administrator to create an explicit deletion request through the account deletion API. The request records `deletionRequestedAt`; it can be cancelled during the 30-day recovery period. The API does not immediately delete data and cannot target an organisation supplied by the browser. It derives the organisation from the authenticated user.

The additive `deletionRequestedAt` field does not schedule or execute deletion by itself.

## Running retention safely

There is no cron job or automated CD task for retention cleanup. An operator must run the application command from an approved environment with database connectivity.

Always generate a dry-run report first:

```bash
cd services/api
npm run retention:report
```

The report contains aggregate eligible counts and performs no updates or deletes.

Execution requires both the explicit command and confirmation environment value:

```bash
cd services/api
RETENTION_EXECUTION_CONFIRMED=DELETE_ELIGIBLE_RECORDS npm run retention:execute
```

Before execution, review the dry-run counts, confirm the intended database/environment, preserve appropriate recovery capability and follow the repository deployment/runbook controls. Do not schedule this command until operational ownership, monitoring and failure handling have been approved.

## Cascades and exclusions

Deleting an organisation cascades through Prisma/PostgreSQL relationships to its users, scans and DSRs. Suppression records are not organisation-owned and are not part of the cascade. Stripe provider-side records, SES metadata, support mailbox records, logs, backups and browser-held values are outside this database cleanup and require their own reviewed retention handling.
