<p align="center">
  <img src="./website/public/logo.png" height="150" alt="weapp-vite logo">
</p>

<h1 align="center">weapp-vite</h1>

<p align="center">
  <a href="https://deepwiki.com/weapp-vite/weapp-vite"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
  <a href="https://www.npmjs.com/package/weapp-vite"><img src="https://img.shields.io/npm/v/weapp-vite?logo=npm&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/weapp-vite"><img src="https://img.shields.io/npm/dm/weapp-vite?logo=npm&label=downloads" alt="npm downloads"></a>
  <a href="https://github.com/weapp-vite/weapp-vite/stargazers"><img src="https://img.shields.io/github/stars/weapp-vite/weapp-vite?style=social" alt="GitHub stars"></a>
  <a href="https://github.com/weapp-vite/weapp-vite/blob/main/LICENSE"><img src="https://img.shields.io/github/license/weapp-vite/weapp-vite" alt="License"></a>
  <a href="https://github.com/weapp-vite/weapp-vite/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/weapp-vite/weapp-vite/ci.yml?branch=main&label=CI" alt="CI status"></a>
  <a href="https://atomgit.com/sonofmagic/weapp-vite"><img src="https://atomgit.com/sonofmagic/weapp-vite/star/badge.svg" alt="GitCode Star"></a>
</p>

<p align="center"><strong>Modern development experience for mini-programs</strong></p>
<p align="center"><a href="https://vite.icebreaker.top">Documentation</a> · <a href="./README.md">中文 README</a></p>

weapp-vite is built for teams maintaining mini-programs. It keeps the native mini-program directory model, syntax, and platform capabilities, while adding TypeScript, Vite/Rolldown, Vue SFC, automated debugging, and AI-friendly workflows. You can start from a template or adopt it gradually in an existing project.

## Table of Contents

- [Why weapp-vite](#why-weapp-vite)
- [Highlights](#highlights)
- [Quick Start](#quick-start)
- [Workspace Layout](#workspace-layout)
- [Key Packages](#key-packages)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Contributors](#contributors)
- [Star History](#star-history)
- [License](#license)

## Why weapp-vite

- **Keep your existing mini-program model**: continue using native `Page` / `Component`, WXML, WXSS, and JSON configuration; existing projects can adopt the toolchain incrementally through directory migration and config setup.
- **Bring modern frontend DX into mini-programs**: TypeScript, ESM, Sass/Less, PostCSS, Tailwind CSS, JSONC, path aliases, and the Vite plugin ecosystem become part of the project instead of being maintained through scattered scripts.
- **Reduce repetitive mini-program plumbing**: automatic `miniprogram_npm` builds, subpackage dependency analysis, auto component imports, auto routes, layouts, generators, and chunk strategies help with projects that have many pages, packages, and components.
- **Stay native, then upgrade where it pays off**: teams can first stabilize the build chain with `weapp-vite + native`, then introduce Vue SFC and Wevu in new pages or selected modules instead of rewriting everything at once.
- **Debug and verify in the real mini-program workflow**: `wv dev --open`, DevTools bootstrapping, console log bridging, screenshots, screenshot comparison, `preview/upload` passthrough, and `analyze` cover the daily loop from local development to pre-upload checks.
- **Make AI collaboration verifiable**: generated `AGENTS.md`, MCP, DevTools logs, runtime screenshots, and screenshot comparison let AI agents inspect and validate the actual mini-program runtime instead of only editing files.

## Highlights

- New projects: use [`create-weapp-vite`](packages/create-weapp-vite) to choose native, Wevu, Tailwind CSS, TDesign, Vant, plugin, or library templates with aligned dependencies.
- Existing projects: adopt Weapp-vite manually or through `wv init` while preserving the current page structure and platform APIs.
- Vue SFC: write `.vue`, `<script setup>`, JSON macros, class/style bindings, and Wevu-powered reactive runtime code for mini-programs.
- Engineering workflow: build, watch, HMR, auto imports, auto routes, subpackage strategies, npm builds, and output analysis.
- IDE and acceptance checks: WeChat DevTools opening, logs, screenshots, screenshot comparison, preview, and upload workflows.
- AI-ready workflow: MCP, packaged docs, skills guidance, and real mini-program runtime inspection entry points.

## Quick Start

### Create a new project

```bash
pnpm create weapp-vite
```

You can also use `yarn create weapp-vite` or `npm create weapp-vite@latest`.

### Work on this monorepo locally

```bash
pnpm install
pnpm build:pkgs
pnpm test
```

Useful follow-up commands:

```bash
pnpm build:apps
pnpm build:templates
pnpm build:docs
```

## Workspace Layout

- `packages/` and `packages-runtime/`: core tooling and runtime packages
- `@weapp-core/`: shared workspace utilities and constants
- `apps/`: demo and playground applications
- `templates/`: starter templates used by the scaffolder
- `e2e/` and `e2e-apps/`: CI, runtime, and issue reproduction coverage
- `website/`: the documentation site
- `docs/`: architecture notes, plans, and reports
- `extensions/`: editor and integration extensions

## Key Packages

- [`weapp-vite`](packages/weapp-vite): the main mini-program bundler
- [`create-weapp-vite`](packages/create-weapp-vite): official project scaffolder
- [`@weapp-vite/mcp`](packages/mcp): MCP-related tooling
- [`weapp-ide-cli`](packages/weapp-ide-cli): CLI helpers for WeChat DevTools workflows
- [`rolldown-require`](packages/rolldown-require): helper for bundling and requiring files with Rolldown

## Documentation

- Main docs: <https://vite.icebreaker.top>
- Contributing guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Chinese README: [README.md](./README.md)

## Contributing

Contributions are welcome.

- Open an issue for bugs, feature ideas, or documentation gaps.
- Send a PR for fixes, refactors, docs, or new examples.
- Share production use cases, middleware, and ecosystem integrations.

For contribution details, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Contributors

Thanks to [all contributors](https://github.com/weapp-vite/weapp-vite/graphs/contributors).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=weapp-vite/weapp-vite&type=Date)](https://star-history.com/#weapp-vite/weapp-vite&Date)

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
