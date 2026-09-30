# Delivery capability layer

The primary user is an existing weapp-vite native/Wevu WeChat developer using an AI host. The host owns planning and edits; this project owns deterministic acceptance and evidence. Independent CLI agent mode remains supported.

## Implemented in this checkout

- Model-optional project configuration, with model-required independent run/resume.
- Shared CLI/MCP acceptance service: inspect, start, status, cancel and report/artifacts.
- Version 2 verdicts, declared required checks, source freshness and persisted step intent/results.
- Project locks, cancellation, deadlines and non-replaying interruption recovery.
- Deterministic DevTools scenarios and opt-in bundled Skill installation.
- Installable-package MCP smoke coverage, native/Wevu contract matrix, real DevTools harness and host-level evaluation catalog.

## Release gates still open

- Resolve and reproduce the Wevu repeat-build/runtime vendor error recorded in VALIDATION.md; do not advertise both frameworks as fully validated until that gate passes.
- Record actual Codex and one other host end-to-end sessions. SDK clients validate the protocol, not those products' complete user experience.
- Run the repository CI matrix on Linux/macOS/Windows; local checks are macOS evidence only.
- Publish a reviewed preview through the release workflow and update ecosystem installation links. This checkout has not published a release or changed user host settings.

## Adoption work

Use benchmarks/tasks.json and the paired evaluation procedure to recruit and observe 10 developers, measure first-report time and manual takeovers, and seek 5 weekly users over three weeks. No observed adoption or savings figures are recorded yet. Outreach and other repositories' documentation changes are separate external actions.

Focus subsequent development on the observed blockers. Add diagnosis and release preparation only after the acceptance loop is reliable. Consider a thin graphical workbench only when users need persistent multi-project evidence views. Desktop parity, cloud execution, team accounts and broad framework coverage are not current deliverables.
