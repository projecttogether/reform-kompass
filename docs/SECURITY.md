# Security

## Private reporting

Report vulnerabilities through
[GitHub's private reporting](https://github.com/projecttogether/reform-kompass/security/advisories/new)
or by email to `info@projecttogether.org`, the address in
[ProjectTogether's imprint](https://projecttogether.org/impressum/), and ask for
the Reform-Kompass security maintainer. Do not post security reports in public
issues or pull requests.

Include the affected revision, relevant route or file, the expected and actual
behavior, prerequisites and a minimal reproduction using fabricated data. Do
not include live credentials, personal records, session cookies or assessment
conversations. Ask the maintainer for a suitable secure transfer method if more
sensitive evidence is needed. No response or remediation deadline is promised.

Only the latest maintained `main` revision is supported. Tagged historical
versions are not maintained unless release notes explicitly say otherwise.

## Controls and deployment responsibilities

The assessment must work without accounts, a database or provider credentials.
Optional account queries are owner-scoped; admin access comes from `ADMIN_EMAILS`
and needs a sign-in from the last 24 hours. Each account's saved assessments are
limited in number, storage and save rate, and lists never load whole states.
Sign-in codes are limited per address per 10 minutes and per day.
Mutating account routes compare the complete request Origin to the configured
public origin. Host and forwarded-host headers do not expand that allowlist.
Every response carries a framing-blocking Content-Security-Policy and other
security headers; see [deployment](deployment.md#security-headers).

Request bodies and provider conversation context are bounded before paid calls.
AI request and concurrency limits are process-local. They are not a hard
financial budget across replicas or restarts; operators must also configure
provider spend limits and edge protections. Proxy headers are untrusted unless
explicitly configured as described in [deployment](deployment.md#proxy-trust-and-ai-limits).

Keep secrets in runtime configuration, never in source, build arguments, issue
bodies or logs. The development console mail transport prints one-time codes
and is disabled in production. Protect production logs and backups as sensitive
operational data.

CI scans the Git history with redacted Gitleaks output. Revoke an exposed
credential first; removing it from the history does not make it safe again.
