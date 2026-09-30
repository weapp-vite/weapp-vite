# Weapp Agent

A delivery capability layer for weapp-vite native and Wevu WeChat projects. Let your existing AI host edit code while Weapp Agent runs deterministic acceptance and returns source-bound evidence. Independent model-backed CLI mode remains available.

[Documentation](https://agent.weapp.dev/en/quickstart) · [中文](README.md)

## Install the preview

Download the `.tgz` from [GitHub Releases](https://github.com/weappjs/weapp-agent/releases), then run:

```sh
npm install --global @weapp-agent/cli@preview
weapp-agent --version
```

## Source preview

Requires Node.js 24.15+ and pnpm.

```bash
corepack enable
pnpm install
pnpm build
node apps/cli/dist/index.mjs --help
pnpm --filter @weapp-agent/cli pack --pack-destination ../../artifacts
```

Install the generated tarball to use `weapp-agent` globally. In a mini-program project:

```bash
weapp-agent init --provider openai --model YOUR_MODEL
# Set OPENAI_API_KEY in your terminal environment.
weapp-agent --trust run "Add a counter to the home page and verify it"
```

## Model-free host integration (source preview)

Build/install this checkout to use the new commands; this change has not been published to npm.

```sh
weapp-agent init
weapp-agent doctor --json
# After reviewing scripts, configuration and scenarios:
weapp-agent --trust accept --json
weapp-agent -C /absolute/path/to/project mcp
weapp-agent skill .agents/skills/weapp-acceptance
```

Configure `acceptance.scenarios` with deterministic route/find/input/tap/wait/assert/screenshot steps. By default both build and DevTools evidence are required; missing runtime evidence cannot pass. The five MCP tools inspect the project, start/query/cancel tasks and read reports/artifacts. Version 2 reports distinguish failed, unverified, blocked, cancelled, timed-out and interrupted execution and recheck source freshness when read. No additional model key is needed. Legacy `verify` output remains compatible.

See the [acceptance guide](apps/docs/src/content/docs/acceptance.mdx), [bundled Skill](apps/cli/skills/weapp-acceptance/SKILL.md) and [counter scenario](examples/acceptance/counter.json).

Supports OpenAI, Anthropic and compatible endpoints; streaming terminal conversations, reference images, tool approvals, JSON events, persistent sessions, conflict-aware editing, project verification, and stdio/HTTP MCP.

Trust permits local edits and configured checks. Arbitrary shell commands and unknown MCP operations need approval. This is not an operating-system sandbox. Source and images needed for a task are sent to your selected model provider; sessions stay local.

Use `pnpm validate` for offline checks. [VALIDATION.md](VALIDATION.md) distinguishes deterministic tests from real-provider and real-DevTools evidence.

Scaffolded with repoctl. Documentation uses Nimbus and Cloudflare Workers Static Assets. MIT licensed.
