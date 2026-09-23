---
title: create-weapp-vite
description: create-weapp-vite 是官方脚手架，用于快速创建小程序工程，并在模板中对齐 Weapp-vite / Wevu 的版本组合。
keywords:
  - Weapp-vite
  - api
  - packages
  - create
  - weapp
  - vite
  - create-weapp-vite
  - 是官方脚手架
---

# create-weapp-vite

`create-weapp-vite` 是官方脚手架，用于快速创建小程序工程，并在模板中对齐 `weapp-vite` / `wevu` 的版本组合。

> [!IMPORTANT]
> 如果你在已有项目里手动安装 `weapp-vite` 与 `wevu`，也请保持两者版本号一致（例如 `weapp-vite@x.y.z` 与 `wevu@x.y.z`）。

## 何时使用

- 你想快速初始化新项目
- 你希望通过模板统一团队目录结构与依赖版本
- 你要在 CI 或自动化脚本里做非交互创建
- 你希望项目初始化后，顺手把推荐的 AI skills 与 `AGENTS.md` 一起就位

## 快速开始

```bash
pnpm create weapp-vite
# 或 npx create-weapp-vite
```

交互模式下，脚手架会默认询问是否安装推荐的 AI skills，并提前提示将执行：

```bash
npx skills add sonofmagic/skills
```

如果你选择跳过，也可以在项目创建完成后手动执行该命令。

同时，脚手架还会在项目根目录生成 `AGENTS.md`，把当前模板推荐的 AI 工作流、命令入口与约束一起写进去。

如果你想先了解这些 AI skills 分别适合什么任务，可以阅读 [AI Skills 使用指南](/guide/skills)；如果要把 issue 修复、文档同步、DevTools e2e 或迁移任务串成流程，可以阅读 [AI 任务工作流](/guide/ai-workflows)。

### 非交互模式

```bash
pnpm create weapp-vite my-app wevu

# 原生多平台 + Web
pnpm create weapp-vite my-app multi-platform

# Vue SFC 多平台 + Web
pnpm create weapp-vite my-app multi-platform-sfc

# 显式安装推荐 skills
pnpm create weapp-vite my-app wevu --install-skills

# 显式跳过推荐 skills 安装
pnpm create weapp-vite my-app wevu --no-install-skills

# 保留内置依赖版本，跳过版本查询
pnpm create weapp-vite my-app wevu --dependency-versions=bundled
```

第二个参数是模板名，内部对应 `TemplateName` 枚举。

> **注意**：非交互模式下，如果你没有显式传 `--install-skills`，默认不会自动安装 AI skills；交互模式下默认值是“是”。

## CLI 参数

命令格式：

```bash
create-weapp-vite [targetDir] [templateName] [--dependency-versions=compatible|bundled] [--install-skills] [--no-install-skills]
```

参数说明：

| 参数                  | 说明                                   |
| --------------------- | -------------------------------------- |
| `targetDir`           | 目标目录；交互模式默认 `my-app`        |
| `templateName`        | 模板名；非交互模式缺省时默认 `default` |
| `--install-skills`    | 非交互模式下显式安装推荐的 AI skills   |
| `--no-install-skills` | 非交互模式下显式跳过 AI skills 安装    |
| `--dependency-versions=compatible\|bundled` | 依赖版本策略，默认 `compatible`；`bundled` 跳过版本查询 |

交互流程会依次处理：

1. 目标目录
2. 是否覆盖已有目录
3. 模板选择
4. 是否安装推荐的 AI skills

## 可编程 API

```ts
import { createProject, TemplateName } from 'create-weapp-vite'

await createProject('my-app', TemplateName.wevu)
await createProject('my-app', TemplateName.wevu, { installSkills: true })
await createProject('my-app', TemplateName.wevu, {
  dependencyVersionStrategy: 'bundled',
})
```

`dependencyVersionStrategy?: 'compatible' | 'bundled'` 默认使用 `compatible`，与 CLI 参数 `--dependency-versions` 一致。

## 依赖版本如何选择

默认的 `compatible` 策略会并行查询官方 npm 元数据，更新模板实际使用的核心固定版本组：`weapp-vite`、`wevu` 与 `@weapp-vite/dashboard`。选择结果必须是各包内置版本 caret 范围内共同存在的最高稳定版本，整组一起更新。例如内置 `7.1.4` 可选择 `7.2.0`，不会跨到 `8.x` 或降级，也不会向模板添加原本没有的包。

核心查询总超时为 5 秒；断网、超时、无效响应或没有共同可用的兼容版本时，脚手架会保留内置组合，并提示实际使用的版本。某个包尚未发布完成时不会生成不同版本的核心组合。内置预发布版本跳过兼容稳定版查询，创建时保留其 caret 版本范围；该范围仍可能匹配后续稳定版，实际安装的精确版本由项目 lockfile 固定。

`@weapp-vite/react`、ESLint 和其他模板依赖保持原有版本策略。`bundled` 模式跳过全部依赖版本查询，使用脚手架内置版本与模板依赖配置，适合离线生成或复现发布快照。该模式不禁止可选的 AI skills 安装；完全离线创建时同时传入 `--no-install-skills`。生成的依赖仍可能使用 caret 范围，安装后的精确版本需要由项目 lockfile 固定。

创建过程不会修改全局或项目的 registry 配置。项目生成后，进入项目目录，可临时使用官方源安装依赖：

```bash
cd my-app
pnpm --config.registry=https://registry.npmjs.org/ install
```

## 创建出的版本偏旧时

镜像同步和脚手架缓存会影响 `pnpm create weapp-vite` 实际执行的版本。框架包与脚手架包独立发布、同步：即使镜像已有 `weapp-vite@7.2.0`，仍可能只有内置 `7.1.4` 的 `create-weapp-vite@2.8.17`。pnpm 也可能继续使用缓存的脚手架；仅添加 `@latest` 不能保证刷新执行缓存。

先向官方 npm 查询脚手架版本，再使用查到的精确版本执行创建：

```bash
pnpm --config.registry=https://registry.npmjs.org/ view create-weapp-vite version
# 将下面的 2.9.0 替换为上一步查询出的版本
pnpm --config.registry=https://registry.npmjs.org/ dlx create-weapp-vite@2.9.0 my-app wevu
```

`2.9.0` 是已发布的恢复示例，内置 `weapp-vite@7.2.0`；它不包含本文新增的动态版本选择功能。旧脚手架不能执行新版中的修复，因此需要先切换到包含修复的新脚手架版本。这些命令只临时指定 registry，不改写已有配置。

## 可选模板（当前实现）

| 模板名               | 说明                             |
| -------------------- | -------------------------------- |
| `default`            | 默认原生小程序模板               |
| `multi-platform`     | 原生多平台 + Web Runtime 模板    |
| `multi-platform-sfc` | Wevu + Vue SFC 多平台 + Web 模板 |
| `plugin`             | 微信小程序插件模板               |
| `lib`                | 组件库模板（lib 模式）           |
| `wevu`               | Wevu + Vue SFC 模板              |
| `react`              | React 模板                       |
| `wevu-tdesign`       | Wevu + TDesign + TailwindCSS     |
| `tailwindcss`        | 原生小程序 + TailwindCSS         |
| `vant`               | Vant + TailwindCSS               |
| `tdesign`            | TDesign + TailwindCSS            |

`multi-platform` 不引入 Wevu 或额外 UI 依赖，使用同一份原生 Page/Component 源码覆盖微信、支付宝、抖音、百度、京东、小红书与 Web。每条 `dev:<platform>` / `build:<platform>` 命令只处理一个目标，详细目录、命令和验收边界见[多平台构建指南](/guide/multi-platform)。

`multi-platform-sfc` 使用 Wevu + Vue SFC 覆盖相同目标。Runtime API 从 `wevu` 导入，App、Page、Component 使用对应 JSON 宏；安装后由 `wv prepare -p weapp` 管理 `.weapp-vite` 类型文件。Web Runtime 只承担浏览器联调，不能替代小程序 IDE 或真机验收。

`react` 使用 React 19、`react-reconciler` 与 `@weapp-vite/react` 构建微信小程序。生成的 `AGENTS.md` 会把 React JSX/TSX、render mode、root 生命周期和原生/Wevu 组件 bridge 路由到 `$weapp-vite-react-best-practices`，并明确当前 React runtime 不以 Web、支付宝或抖音构建作为兼容结论。

## 初始化后会做什么

- 复制对应模板目录
- 自动整理 `gitignore` / `.gitignore`
- 按选定策略对齐模板使用的 `weapp-vite`、`wevu`、`@weapp-vite/dashboard`，并解析模板中的 workspace/catalog 依赖
- 在项目根目录生成 `AGENTS.md`
- 按需执行 `npx skills add sonofmagic/skills`

如果 AI skills 安装失败，脚手架不会回滚项目创建，而是输出警告，并提示你稍后手动执行推荐命令。

## 与主文档的关系

- 工程创建后，日常开发请转到 [指引](/guide/) 与 [配置](/config/)。
- AI 协作、skills 与 MCP 接入请转到 [AI 协作指南](/guide/ai)、[AI Skills 使用指南](/guide/skills) 与 [@weapp-vite/mcp](/packages/mcp)。
