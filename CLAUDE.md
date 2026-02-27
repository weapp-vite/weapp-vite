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

## Project Skills (Codex + Claude Code)

This repo includes installable user-facing skills in `./skills`:

- `weapp-vite-best-practices`
- `weapp-vite-vue-sfc-best-practices`
- `wevu-best-practices`
- Project-specific Claude skills can also live in `./.claude/skills` (for example: `playwright-cli`).

Recommended remote install source for all public skills:

```bash
npx skills add sonofmagic/skills
```

To make this repository's latest local skills directly available in local CLI environments:

```bash
pnpm skills:link
```

Dry run:

```bash
pnpm skills:link:dry
```

Notes:
- Maintainer-only skills live in `maintainers/skills/*` and should not be treated as user-facing defaults.
- Running `pnpm skills:link` syncs both `skills/*` and `./.claude/skills/*`, so Codex can directly use project Claude skills too.
- When tasks clearly match one of the skill scopes above, load the corresponding `SKILL.md` and follow its workflow and references.

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

## AI 代码规范

### 语言规范
- 所有 AI 添加的 JSDoc 代码注释必须使用中文
- 所有 AI 添加的 changeset 摘要段落必须使用中文

### 编码规范
- TypeScript + ESM + 2空格缩进
- 包名：kebab-case（如 `weapp-vite`）
- 变量/文件：camelCase（如 `myVariable`）
- 类/类型：PascalCase（如 `MyClass`）
- 优先使用命名导出，除非文件明确只导出一个默认导出
- 保持 eslint/stylelint 干净，避免引入 TypeScript 错误
- 始终修复独立样式文件和 `.vue` 文件中 `<style>` 块的 stylelint 问题
- 如果源文件超过 300 行，评估是否拆分，并在 PR 说明中记录决策
- 拆分时优先使用目录布局：
  - `foo/index.ts`
  - `foo/style.ts`
  - `foo/helpers.ts`
  - 避免 `foo.style.ts` / `foo.helpers.ts`

### Commit 和 Changeset 规范
- 使用 Conventional Commits，如：`feat(weapp-vite): add css preprocess support`
- 对于用户可见或影响行为的变更，必须添加 changeset
- 对于源码 bug 修复（包括带有单元/e2e 更新的 GitHub issue 修复），必须添加 changeset
- 如果发布包含 `weapp-vite`、`wevu` 或 `templates/` 下的内容，还需包含 `create-weapp-vite` 的 bump changeset
- 默认操作是仅提交：检查通过后直接提交变更，除非用户明确要求推送，否则不推送

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
