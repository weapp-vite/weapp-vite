# Weapp Agent

Model-free acceptance and MCP tools for weapp-vite native and Wevu WeChat projects, with an optional independent AI coding mode.

Requires Node.js 24.15+. Install the preview package from npm:

```sh
npm install --global @weapp-agent/cli@preview
```

```sh
npm install --global ./weapp-agent-cli-0.1.0.tgz
weapp-agent init --provider openai --model YOUR_MODEL
weapp-agent doctor
weapp-agent --trust run "Add a counter and verify the project"
```

Set your provider API key in the environment. Project configuration never stores keys.

[Documentation](https://vite.weapp.dev/guide/agent/) · [Model-free acceptance](https://vite.weapp.dev/guide/acceptance) · [Source and validation](https://github.com/weapp-vite/weapp-vite/tree/main/docs/migrations/weapp-agent)

Inspect a saved session before continuing:

```sh
weapp-agent sessions --details
weapp-agent session SESSION_ID --json
weapp-agent resume SESSION_ID "Continue the task"
```

Inspection is read-only and requires no model credentials. Context compression preserves complete user requests and images; if they exceed `contextCharacters`, the run stops with `reason: context_budget` before calling the model. Increase the budget to resume. Interrupted calls are never replayed automatically: inspect their outcomes, then use `resume --acknowledge-interrupted` or `/acknowledge-interrupted [prompt]` in the interactive terminal. See the [session guide](https://vite.weapp.dev/guide/agent/sessions).

Follow-up requirements and images are saved even when recovery stops for acknowledgement. After confirmation, they reach the model in their original order after the complete tool results. Concurrent recovery attempts cannot take over each other's session locks, and closing a session waits for accepted journal writes to finish.

Machine-readable `run` and `resume` output is JSONL. The `run.started` event identifies the project with `projectId` and no longer writes an absolute workspace path. Recovery prompts show only bounded, redacted tool-input previews. Tools marked `mutates: true`, including MCP tools, require `verify_project` before the task can finish.

MIT. Tool permissions are not an operating-system sandbox.

## Use with an existing AI host

```sh
weapp-agent init
weapp-agent doctor --json
# Review project scripts, configuration and scenarios before granting trust.
weapp-agent --trust accept --json
weapp-agent -C /absolute/path/to/project mcp
weapp-agent skill .agents/skills/weapp-acceptance
```

Acceptance/MCP need no API key. Configure `acceptance.scenarios` for actual runtime assertions. Default required checks are build and devtools; missing evidence is unverified, not passed. Reports use version 2 and include source freshness, steps, screenshots and console logs. Legacy verify semantics are unchanged. The Skill is bundled under `skills/weapp-acceptance` and installation never modifies host settings automatically.
