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

weapp-vite brings a modern Vite-style workflow to traditional mini-program development. The monorepo includes the core bundler, runtime packages, templates, IDE helpers, MCP support, and end-to-end examples for building WeChat and related mini-program projects with better DX.

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

- Use a modern toolchain for mini-program apps instead of legacy-only workflows.
- Start quickly with the official `create-weapp-vite` scaffolder.
- Build across multiple templates, runtimes, demos, and e2e apps from one workspace.
- Explore AI-friendly tooling such as MCP support, IDE helpers, and packaged skills.

## Highlights

- Official scaffolder: [`create-weapp-vite`](packages/create-weapp-vite)
- Core bundler/runtime packages under `packages/`, `packages-runtime/`, and `@weapp-core/`
- Ready-to-run demo apps in `apps/` and regression fixtures in `e2e-apps/`
- Documentation site in `website/`
- Extensive CI, HMR, IDE, and runtime validation scripts powered by `pnpm` + `turbo`

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
