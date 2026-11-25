# Scenario contract (version 1)

Add model-free configuration to the project, preserving existing fields:

```json
{
  "version": 1,
  "verification": [
    { "kind": "build", "command": "pnpm", "args": ["run", "build"] }
  ],
  "acceptance": {
    "requiredChecks": ["build", "devtools"],
    "scenarios": ["acceptance/counter.json"],
    "timeoutMs": 600000
  }
}
```

Use the project's actual package manager and scripts. Available required categories: typecheck, build, test, devtools. The default requires build and devtools; categories omitted from requirements are still reported when configured. An arbitrary command labelled devtools is not runtime proof for version 2 acceptance.

```json
{
  "version": 1,
  "name": "counter increments",
  "steps": [
    { "action": "route", "path": "/pages/agent-proof/index" },
    { "action": "wait", "selector": "#count", "timeoutMs": 5000 },
    { "action": "assert", "selector": "#count", "text": "0" },
    { "action": "tap", "selector": "#increment" },
    { "action": "assert", "selector": "#count", "text": "1" },
    { "action": "screenshot" }
  ]
}
```

Each scenario starts with route (reLaunch), contains at least one assert, and has a unique name. `find`, `tap`, and `wait` take selector; `input` takes selector and string value. `assert` compares exact element text, polling for up to timeoutMs (default 5000, maximum 60000). `wait` waits for an element. No JavaScript/eval step is supported. Use real route names and selectors from the project.

Navigation, input and taps run once. Only read assertions poll. Each successful scenario gets an automatic screenshot; a failed scenario attempts a screenshot. Console evidence is collected at the end when the connection remains available. Credentials, configured scripts, acceptance files and the AppID require review before trusting a project. Use an isolated test environment for interactions with external effects.

No automatic upload, publishing or submission is part of this workflow.
