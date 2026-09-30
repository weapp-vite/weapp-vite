---
title: "Quickstart"
description: "An independent coding agent for WeChat mini-programs."
sidebar:
  order: 12
---

## Install the preview

Install the preview package from npm:

```sh
npm install --global @weapp-agent/cli@preview
```

```sh
weapp-agent --version
```

## Build from source

Weapp Agent is an early source preview. Use Node.js 24.15 or newer and pnpm.

```bash
git clone https://github.com/weapp-vite/weapp-vite.git
cd weapp-agent
corepack enable
pnpm install
pnpm build
node packages/agent-cli/dist/index.mjs --help
```

From a checkout, you can also pack and install the local CLI with `pnpm --filter @weapp-agent/cli pack`.

## Configure a project

```bash
weapp-agent init --provider openai --model YOUR_MODEL
weapp-agent doctor
weapp-agent --trust run "Add a counter to the home page and verify the change"
```

Set `OPENAI_API_KEY` in your terminal environment. For Anthropic, select `--provider anthropic` and set `ANTHROPIC_API_KEY`. Compatible services require `--base-url`.

Run `weapp-agent` for the terminal interface. Use `run --json` for automation, `--image` for references, and `resume SESSION_ID` to continue a task.

## What gets verified

Configured typecheck, build, test and DevTools commands produce separate results. Missing checks are unverified. Browser previews are not evidence of WeChat runtime correctness.

Project trust allows local edits and configured checks. Arbitrary shell commands and unknown MCP actions need approval. This is tool-level permission control, not an operating system sandbox.

Read the [CLI reference](/guide/agent/cli) and [architecture](/guide/agent/architecture).

## Use your existing AI host

This checkout also provides model-free acceptance. Run `weapp-agent init` without a model, inspect with `doctor --json`, configure `acceptance.scenarios`, then review and authorize `weapp-agent --trust accept --json`. Start `weapp-agent -C /absolute/project mcp` for the five project/acceptance tools. Install the bundled Skill into a new folder with `weapp-agent skill .agents/skills/weapp-acceptance`.

Version 2 reports require all declared checks to pass and evidence to remain current. Missing runtime evidence is unverified, screenshots are not visual assertions, and DevTools is not a physical device. Independent run/resume still require model configuration. These new commands require the package built from this checkout until its release is published. See the [acceptance guide](/guide/acceptance).
