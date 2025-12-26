# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

weapp-vite is a modern build tool for WeChat miniprograms, built on top of Vite and Rolldown. It provides a Vite-like development experience for miniprogram development, supporting WXML, WXSS, TypeScript, Vue SFC, and component auto-imports.

### Vue Support

Vue SFC support is now **built directly into `weapp-vite`**.

- Vue files (`.vue`) are automatically processed
- Runtime API available at `weapp-vite/runtime`
- See [packages/weapp-vite/test/vue/README.md](packages/weapp-vite/test/vue/README.md) for details

## Common Commands

### Development
```bash
pnpm dev              # Watch mode for all packages (excludes apps, templates, website)
pnpm dev --filter=<package-name>  # Watch specific package
```

### Building
```bash
pnpm build            # Build all packages (excludes apps, templates, website)
pnpm build:pkgs       # Build packages/* and @weapp-core/* only
pnpm build:apps       # Build apps/* and templates/* only
pnpm ci               # CI build (excludes apps, templates, website)
```

### Testing
```bash
pnpm test             # Run tests with coverage
pnpm test:dev         # Watch mode for tests
pnpm e2e              # Run E2E tests
pnpm e2e:dev          # Watch mode for E2E tests
```

### Linting & Publishing
```bash
pnpm lint             # Run linters via turbo
pnpm publish-packages # Publish to npm
```

### Utility Scripts
```bash
pnpm builtin          # Fetch WeChat official components from docs
pnpm auto-import:components  # Update component resolvers (TDesign, Vant, WeUI)
pnpm vite:patch       # Patch Vite for .wxss support
pnpm script:init      # Initialize monorepo workspace
pnpm script:sync      # Sync workspace configuration
pnpm script:clean     # Clean generated files
pnpm script:mirror    # Mirror configuration across packages
```

### Changesets (Version Management)
```bash
pnpm release          # Add changeset
pnpm cv               # Version changesets
pnpm pr/pr:beta/pr:rc # Enter pre-release mode
pnpm pr:exit          # Exit pre-release mode
```

## Architecture Overview

### Monorepo Structure

```
weapp-vite/
├── packages/weapp-vite/    # Main bundler package
├── @weapp-core/            # Shared core utilities
│   ├── init/               # Project initialization
│   ├── logger/             # Logging system
│   ├── schematics/         # Code generation
│   └── shared/             # Shared utilities
├── packages/rolldown-require/  # Custom require for Rolldown
├── packages/vite-plugin-performance/  # Performance monitoring
├── packages/weapp-ide-cli/  # CLI utilities
├── packages/@weapp-vite/   # Supporting packages
├── templates/              # Project templates
├── apps/                   # Demo apps
└── website/                # Documentation
```

### Core Build Pipeline

The system uses a **service-oriented architecture** centered around `CompilerContext`:

1. **ConfigService** - Loads and merges project configurations (`vite.config.ts`, `project.config.json`)
2. **ScanService** - Discovers project structure and entry points (pages, components)
3. **NpmService** - Manages npm packages and generates `miniprogram_npm`
4. **WxmlService** - Processes WXML templates, handles component resolution
5. **JsonService** - Processes JSON configuration files
6. **AutoImportService** - Handles component and API auto-imports
7. **AutoRoutesService** - Generates route configurations from file structure
8. **BuildService** - Orchestrates the Rolldown build process
9. **WatcherService** - File watching for hot reload

### Key Concepts

#### Rolldown Integration
- Uses Rolldown (Rust-based bundler) instead of Rollup for faster builds
- Custom `rolldown-require` package handles miniprogram-specific module resolution
- Rolldown is patched via `node_modules/.pnpm_patches/` for .wxss support

#### Auto-import System
- **Components**: Automatically imports components from WeChat APIs and UI libraries (TDesign, Vant, WeUI)
- **APIs**: Platform-specific API imports (weapp/h5)
- Component lists are scraped from official docs using `scripts/builtin.ts` and `scripts/update-auto-import-components.ts`

#### WXML Processing
- WXML templates are parsed and compiled to JavaScript
- Component discovery and dependency tracking
- Event binding extraction and virtual DOM generation

#### Platform Support
- **Native**: Traditional WeChat miniprogram rendering
- **Skyline**: New renderer with enhanced capabilities
- **Web**: Progressive Web App support

## Important Implementation Notes

### Package Manager
- **Must use pnpm** (enforced by `preinstall` script and `only-allow`)
- `shamefullyHoist: true` in `pnpm-workspace.yaml` for compatibility

### Build Tools
- **tsup** is used for building most packages (not tsdown anymore)
- **Vite 8 beta** for development
- **Rolldown beta** for bundling
- **Turbo** for task orchestration

### Testing
- **Vitest** for unit tests
- E2E tests in `./e2e/` directory
- Test fixtures in `packages/weapp-vite/test/fixtures/`

### File Extensions
- `.wxss` is the miniprogram equivalent of `.css`
- `.wxml` is the miniprogram equivalent of `.html`
- The `vite:patch` script modifies Vite to support `.wxss` resolution

### Type Generation
- Volar support in `@weapp-vite/volar` package
- Auto-generated types for components and APIs

## Development Workflow

When making changes:
1. Run `pnpm dev` to start watch mode for all packages
2. For changes in templates/apps, use specific filters: `pnpm dev --filter=<name>`
3. Run tests before committing: `pnpm test`
4. Use `pnpm lint` to check code style
5. Add changesets for user-facing changes: `pnpm release`

### Updating Component Lists
If WeChat adds new components or UI libraries update:
```bash
pnpm builtin                  # Update WeChat components
pnpm auto-import:components   # Update TDesign/Vant/WeUI
```
