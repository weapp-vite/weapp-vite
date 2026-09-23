# create-weapp-vite

## 简介

`create-weapp-vite` 是 weapp-vite 的官方脚手架，用于快速创建小程序项目。它提供交互式模板选择，也支持命令行参数方式使用；同时导出可编程 API 方便二次封装。

## 特性

- 交互式创建或非交互式参数创建
- 内置多种模板（默认、原生多平台 + Web、Vue SFC 多平台 + Web、Wevu、Wevu + TDesign、Tailwindcss、TDesign、Vant、插件、组件库）
- 从官方 npm 选择兼容的最新稳定版，自动对齐模板使用的 `weapp-vite`、`wevu` 与 `@weapp-vite/dashboard`
- 自动处理 `.gitignore` 写入
- 可选安装推荐的 AI skills（`sonofmagic/skills`）
- 生成带来源标记的项目级 `AGENTS.md`，并保留用户维护的 `AGENTS.local.md`

## 安装

推荐直接使用包管理器的 create 命令：

> 说明：推荐使用 `Node.js 22+`，再执行 `pnpm create weapp-vite`、`yarn create weapp-vite` 或 `npm create weapp-vite@latest`。

```bash
pnpm create weapp-vite
# 或
npx create-weapp-vite
```

## 使用

交互式创建：

```bash
pnpm create weapp-vite
```

交互流程会默认询问是否安装推荐的 AI skills，并提示将执行：

```bash
npx skills add sonofmagic/skills
```

如果你暂时不想安装，也可以先跳过，后面再手动执行上面的命令。

非交互式创建：

```bash
pnpm create weapp-vite my-app wevu

# 原生多平台 + Web 模板
pnpm create weapp-vite my-app multi-platform

# Vue SFC 多平台 + Web 模板
pnpm create weapp-vite my-app multi-platform-sfc

# 显式安装推荐 skills
pnpm create weapp-vite my-app wevu --install-skills

# 显式跳过推荐 skills 安装
pnpm create weapp-vite my-app wevu --no-install-skills

# 使用脚手架内置依赖版本，跳过版本查询
pnpm create weapp-vite my-app wevu --dependency-versions=bundled
```

在代码中使用：

```ts
import { createProject, TemplateName } from 'create-weapp-vite'

await createProject('my-app', TemplateName.wevu)
await createProject('my-app', TemplateName.wevu, { installSkills: true })
await createProject('my-app', TemplateName.wevu, {
  dependencyVersionStrategy: 'bundled',
})
```

## 依赖版本策略

CLI 参数 `--dependency-versions=compatible|bundled` 对应 API 选项 `dependencyVersionStrategy?: 'compatible' | 'bundled'`，默认值为 `compatible`。

- `compatible`：并行查询官方 npm，仅更新模板已经使用的 `weapp-vite`、`wevu`、`@weapp-vite/dashboard`。在各包内置版本的 caret 范围中，选择所有成员共同存在的最高稳定版本并一起更新。例如内置 `7.1.4` 可更新至 `7.2.0`，不会更新至 `8.x`，也不会降级。内置预发布版本跳过兼容稳定版查询，创建时保留其 caret 版本范围；该范围仍可能匹配后续稳定版，实际安装的精确版本由项目 lockfile 固定。
- 核心版本查询总超时为 5 秒。断网、超时、响应无效或没有共同可用的兼容版本时，整组保留内置版本，并提示实际采用的版本组合；发布尚未完成时不会混用不同版本。
- `bundled`：不进行依赖版本联网查询，使用脚手架内置版本与模板目录中的依赖配置，适合离线生成或复现发布快照。可选的 AI skills 安装仍会联网；完全离线创建时请同时指定 `--no-install-skills`。

`@weapp-vite/react`、ESLint 和其他模板依赖保持原有版本策略。`bundled` 只固定生成时的选择；生成的依赖仍可能是 caret 范围，安装后的精确版本应由项目 lockfile 固定。

脚手架不会改写全局或项目 registry 配置。创建完成后，进入项目目录，可临时从官方源安装依赖，避免镜像同步延迟：

```bash
cd my-app
pnpm --config.registry=https://registry.npmjs.org/ install
```

## 创建出的版本偏旧时

`pnpm create weapp-vite` 先获取并运行 `create-weapp-vite`。镜像中的框架包和脚手架包可能不同步：例如镜像已有 `weapp-vite@7.2.0`，但脚手架仍停在 `create-weapp-vite@2.8.17`，后者内置的是 `weapp-vite@7.1.4`。pnpm 执行缓存也可能让旧脚手架继续被使用，仅添加 `@latest` 不能保证刷新缓存。

先向官方源查询脚手架版本，再将查询结果填入精确版本命令：

```bash
pnpm --config.registry=https://registry.npmjs.org/ view create-weapp-vite version
# 将下面的 2.9.0 替换为上一步查询出的版本
pnpm --config.registry=https://registry.npmjs.org/ dlx create-weapp-vite@2.9.0 my-app wevu
```

已发布的 `2.9.0` 内置 `weapp-vite@7.2.0`，可用于恢复到该版本；它本身不含本文新增的动态版本选择功能。旧脚手架无法获得新版代码中的修复，需先通过官方源切换到包含修复的新脚手架版本。以上命令只对本次执行指定 registry，不改写已有配置。

## 配置

`TemplateName` 支持以下模板：

- `default`
- `multi-platform`
- `multi-platform-sfc`
- `wevu`
- `react`
- `wevu-tdesign`
- `tailwindcss`
- `tdesign`
- `vant`
- `plugin`
- `lib`

`multi-platform` 使用原生 Page/Component，覆盖微信、支付宝、抖音、百度、京东、小红书与 Web Runtime。它按命令构建单个目标，不会隐式生成全部平台产物；创建后请使用 `dev:<platform>` / `build:<platform>` 脚本。

`multi-platform-sfc` 使用 Wevu + Vue SFC 覆盖相同目标，并提供 `defineAppJson` / `definePageJson` / `defineComponentJson`、受管类型文件和稳定响应式交互示例。Web Runtime 用于浏览器联调，不能替代目标小程序 IDE 或真机验收。

## 相关链接

- weapp-vite 文档：https://vite.weapp.dev/
- 仓库：https://github.com/weapp-vite/weapp-vite
