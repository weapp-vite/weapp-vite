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

交互模式下，脚手架询问是否安装推荐的 AI skills，默认选择“否”。显式安装时执行：

```bash
npx --yes skills add sonofmagic/skills
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

> **注意**：非交互模式下，如果你没有显式传 `--install-skills`，默认不会自动安装 AI skills；交互模式下默认值也是“否”。

## CLI 参数

命令格式：

```bash
create-weapp-vite [targetDir] [templateName] [--dependency-versions=compatible|bundled] [--registry=<url>] [--install-skills] [--no-install-skills]
```

参数说明：

| 参数                  | 说明                                   |
| --------------------- | -------------------------------------- |
| `targetDir`           | 目标目录；交互模式默认 `my-app`        |
| `templateName`        | 模板名；非交互模式缺省时默认 `default` |
| `--install-skills`    | 非交互模式下显式安装推荐的 AI skills   |
| `--no-install-skills` | 非交互模式下显式跳过 AI skills 安装    |
| `--dependency-versions=compatible\|bundled` | 依赖版本策略，默认 `bundled`；`compatible` 显式联网查询 |
| `--registry=<url>` | 本次查询与建议安装命令的普通 registry，不写入配置 |

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
  dependencyVersionStrategy: 'compatible',
  registry: 'https://registry.npmmirror.com/',
})
```

## 依赖版本策略

CLI 的 `--dependency-versions=compatible|bundled` 对应 API 的 `dependencyVersionStrategy`，默认 `bundled`。

- `bundled`：不发起任何依赖版本查询，使用随脚手架发布的框架版本和模板依赖。生成的 semver 范围仍可能接受更新，安装后的精确版本由 lockfile 固定。
- `compatible`：按用户实际安装源查询模板使用的 `weapp-vite`、`wevu`、`@weapp-vite/dashboard`，选择每个包基线 caret 范围内共同存在的最高稳定版本，不跨大版本、不降级、不混用不同来源的版本列表。预发布基线保留随包组合。Tailwind 与核心查询并行，共享预算，只在模板原有兼容范围内更新；精确版本保持不变。
- 主查询最多 4 秒，失败后最多再用 1 秒探测一个公共备用源，全部网络等待最多 5 秒。失败保留随包组合；备用源结果仅提供恢复提示，不能证明用户当前源可安装的新版不会写入项目。企业私有源不自动切换公共源。

AI skills 是独立的可选联网步骤，需要 npm 和 GitHub 可达。交互默认跳过，也可用 `--no-install-skills` 明确禁用；显式安装最长等待 60 秒，超时清理进程，保留已经生成的项目并提示手动重试。

## Registry 与代理

新增 CLI 参数 `--registry=<url>` 和 API 选项 `registry?: string`。普通 registry 的优先级为：显式参数 → `CREATE_WEAPP_VITE_REGISTRY` → `npm_config_registry` / `NPM_CONFIG_REGISTRY` / `pnpm_config_registry` → 目标项目 `.npmrc` → 用户 `.npmrc` → npm 默认源。

作用域配置（如 `@weapp-vite:registry`）继续遵循 npm 规则；普通 `--registry` 不覆盖作用域源。代理、`HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`、npm 的 `proxy` / `https-proxy`、`cafile` 与认证配置交给 npm 的网络栈处理。保持证书校验，不通过关闭 TLS 校验解决网络问题。诊断不会打印 token 或代理凭据。携带认证或客户端证书的 registry 必须直接返回元数据；重定向会触发随包版本回退，避免凭据被转发。

脚手架按生成项目的安装边界读取 `.npmrc`：处于已有 pnpm workspace 时使用最近 workspace 根目录的配置；独立项目使用目标目录配置，不继承普通父项目中无法被后续安装继承的配置。脚手架不改写项目或全局 `.npmrc`。通常创建后执行：

```bash
cd my-app
pnpm install
pnpm build
pnpm dev
```

独立新项目会生成 `pnpm-workspace.yaml`，明确声明模板依赖的构建脚本审批策略，避免 pnpm 12 因未审批的依赖脚本中止安装；项目自身的 `wv prepare` 仍正常执行。已有项目或父级 `pnpm-workspace.yaml` 会保留，已有项目遇到 `ERR_PNPM_IGNORED_BUILDS` 时，可按团队策略执行 `pnpm approve-builds`。

通过 `--registry` 或 registry 环境变量临时选源时，安装提示会显式保留该源，避免 pnpm 原生入口忽略临时环境配置。按创建完成后打印的命令安装，例如：

```bash
pnpm --config.registry=https://registry.npmmirror.com/ install
```

`pnpm --config.registry=... create` 中的临时配置不一定传给脚手架子进程；启用 `compatible` 时，请同时传 `--registry=...`，或设置 `CREATE_WEAPP_VITE_REGISTRY`。仅设置脚手架参数不能改变 pnpm 下载脚手架本身使用的源。

## 国内镜像、缓存与故障恢复

首次 `pnpm create weapp-vite` 下载由 pnpm 负责；包尚未下载时，脚手架的容错逻辑无法执行。镜像中的框架包、脚手架包和 tarball 可能不同步。完全离线也只有在脚手架及其依赖已经缓存后，才可能进入本地模板生成。

### pnpm 12 的发布冷却期 {#pnpm-release-age}

pnpm 12.5.1 默认启用 `minimumReleaseAge=1440`（分钟，即 24 小时），未显式配置时采用非严格模式。新版本发布后的冷却期内，`pnpm create weapp-vite` 或 `pnpm create weapp-vite@latest` 可能选择已经满足发布年龄的旧版；即使使用官方源和全新缓存，也可能出现这种结果。`pnpm view ... version` 显示的是源中的最新版本，不代表 `create` 一定会执行它。

可以等待目标版本满足当前发布年龄策略；需要提前使用某个已核对的版本时，按下文指定精确版本。默认非严格模式会为明确指定的包版本自动记录精确的 `minimumReleaseAgeExclude` 例外；`create` / `dlx` 的例外记录在其临时工作区，不会全局关闭发布年龄检查，也不代表后续项目安装中的其他依赖获得豁免。

若用户或团队启用了 `minimumReleaseAgeStrict`，应等待配置的冷却期结束，或根据 pnpm 的交互提示和团队流程审批该精确版本；非交互 / CI 环境可能直接拒绝安装。显式设置发布年龄时，pnpm 12.5.1 默认转为严格模式。精确版本、换源和清缓存都不能保证绕过用户的严格策略或其他安全检查，不建议为运行脚手架全局关闭这些检查。

### 确认版本并重试

先向当前可达的源查询版本；需要核对冷却期时，也可查看发布时间：

```bash
pnpm --config.registry=https://registry.npmmirror.com/ view create-weapp-vite version
pnpm --config.registry=https://registry.npmjs.org/ view create-weapp-vite version
pnpm --config.registry=https://registry.npmjs.org/ view create-weapp-vite time --json
```

选择包含所需修复、该源已同步且符合你的安全策略的精确版本，将下面的 `<version>` 替换为已核对的版本号（例如 `2.9.1`），再运行：

```bash
pnpm --config.registry=https://registry.npmmirror.com/ dlx create-weapp-vite@<version> my-app wevu
```

如果当前镜像尚未同步且官方源可达，可将命令中的 registry 改为官方源；官方源不可达时使用可用镜像或已配置的代理，不必强制直连。指定精确版本可避免复用旧 `latest` 的执行缓存，并明确请求哪个版本；它对发布冷却期的处理仍受上述严格 / 非严格模式约束。旧脚手架本身不会获得新版代码中的修复。历史 `2.9.0` 及更早发布版本不包含本文的默认离线、代理与超时改造。

安装时报 DNS、超时或连接错误时先检查 registry/代理；证书错误应配置正确 CA，401/403 应修正该源认证。包或版本 404 通常需要检查镜像同步、作用域源和 tarball 是否齐全。生成成功只说明模板完整，仍须以正常 `pnpm install`（包含 `wv prepare`）、`pnpm build` 和 `pnpm dev` 验证安装与构建。

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
- 按需执行 `npx --yes skills add sonofmagic/skills`

AI skills 安装失败或超过 60 秒时会清理进程、保留项目，并提示稍后手动重试。

## 与主文档的关系

- 工程创建后，日常开发请转到 [指引](/guide/) 与 [配置](/config/)。
- AI 协作、skills 与 MCP 接入请转到 [AI 协作指南](/guide/ai)、[AI Skills 使用指南](/guide/skills) 与 [@weapp-vite/mcp](/packages/mcp)。
