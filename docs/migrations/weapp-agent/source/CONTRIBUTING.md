# Contributing

Understand the root cause and preserve project boundaries before proposing changes. Include a reproducible scenario and tests that distinguish correct behavior from the reported bug.

## Development

Use Node.js 24 and the pnpm version declared in package.json.

```bash
corepack enable
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:pack
pnpm exec repo doctor
pnpm exec repo check
```

Create packages with `pnpm exec repo new NAME --template tsdown`. Adjust managed tooling through repoctl.config.ts. Docs are independently checked with Nimbus lint and Astro check.

Never add API keys, local sessions, screenshots containing private information, or machine-specific configuration to Git. Tests use deterministic models by default. Real provider and DevTools runs must record actual prerequisites and outcomes, without treating missing prerequisites as success.

For publishable changes use pnpm change. Public npm publishing is intentionally not automatic in this preview.
