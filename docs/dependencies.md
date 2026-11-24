# Dependency maintenance

Use Node.js 22 and `npm ci` with the committed lockfile. The Docker build installs
development dependencies to compile the application; its final standalone image
contains traced runtime dependencies. CSS and lint tooling belong in development
dependencies.

Update dependencies in a focused change, review the lockfile, then run:

```bash
npm ci
npm run check
npm audit --omit=dev --audit-level=moderate
npm audit
npx drizzle-kit export
```

The export command checks the migration tool without contacting a database or
writing migrations. Do not run `npm audit fix --force` without reviewing its
proposed version changes: it may suggest obsolete framework and lint versions.

## Compatibility choices

ESLint 9 is used because the maintained import, React and accessibility plugins
currently declare support through ESLint 9. Align their peer ranges before
moving to ESLint 10. Next.js and React stay on their current supported majors.

The selector-parser override takes compatible 6.1 security fixes where the
Tailwind typography plugin pins an older 6.x release. The legacy
`@esbuild-kit/core-utils` loader used by drizzle-kit is constrained to patched
esbuild 0.25; its transform-only usage is checked with `drizzle-kit export`.
TypeScript ESLint's `typescript-estree` gets minimatch 11, which fixes
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249); it only
calls `minimatch(path, pattern, { dot: true })`, which minimatch 11 keeps.
Review and remove these overrides when parent dependencies incorporate the fixes.

## Audit interpretation

Track production and tooling findings separately. Production advisories fail
CI at moderate severity. The full audit still needs review; a dependency-package
count is not a count of independently exploitable application vulnerabilities.

The tooling tree also uses minimatch 3 through ESLint and its plugins. That line
is outside the advisory's affected range (7.0.0 to below 11.0.1). Do not replace
minimatch 3 with 11 globally: its module interface is incompatible with those
consumers. As of 7 November 2026, `npm audit` reports no findings. CI runs lint
on repository-controlled patterns without provider or deployment secrets, using
a read-only GitHub token.

Dependabot proposes weekly npm and GitHub Actions updates. The workflows pin
Actions by commit and the standalone Gitleaks download by archive checksum; the
scanner does not need an organization Action license key. Review its version
and checksum together when updating it.
