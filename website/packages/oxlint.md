---
title: "@weapp-vite/oxlint"
description: "@weapp-vite/oxlint 为 Oxlint 与 Vite+ 提供小程序运行时、Wevu API 兼容性规则和推荐配置。"
keywords:
  - Weapp-vite
  - Wevu
  - Oxlint
  - Vite+
  - "@weapp-vite/oxlint"
---

# @weapp-vite/oxlint

`@weapp-vite/oxlint` 提供小程序源码的 Oxlint 推荐配置，以及可单独接入的 JS 插件。Vite+ 脚手架默认接入；普通 Oxlint 项目也能使用相同规则。

## 安装与配置

Vite+ 项目安装规则包即可，执行器使用 Vite+ 配套的 Oxlint：

```bash
pnpm add -D @weapp-vite/oxlint
```

在现有 `vite.config.ts` 中合并 `lint` 配置，保留项目的构建插件与其他配置：

```ts
import { miniProgramRecommended } from '@weapp-vite/oxlint'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  lint: miniProgramRecommended,
})
```

Wevu 项目改用 `wevuRecommended`，其中已经包含小程序 runtime 规则：

```ts
import { wevuRecommended } from '@weapp-vite/oxlint'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  lint: wevuRecommended,
})
```

```bash
pnpm exec vp lint
pnpm exec vp lint --fix
```

普通 Oxlint 项目可安装 `oxlint`，在 `oxlint.config.ts` 中默认导出同一预设，然后执行 `pnpm exec oxlint`。Vite+ 以脚手架固定配对的版本为兼容基线，避免额外安装另一套执行器。

## 规则与检查范围

| 规则 | 级别 | 检查内容 |
| --- | --- | --- |
| `weapp-vite/no-unsupported-runtime-api` | error | 小程序 AppService 不支持的 DOM、Node 全局与现代内建 |
| `weapp-vite/no-implicit-runtime-polyfill` | warn | 需要 weapp-vite 注入或显式兼容层的宿主能力 |
| `weapp-vite/no-unsupported-api` | error | Wevu 不支持的 Vue 生态 API，仅 Wevu 预设启用 |
| `weapp-vite/no-risky-api` | warn | 参数、时序或宿主语义不同的 API，仅 Wevu 预设启用 |

默认只在 `src/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}` 中启用小程序 runtime 规则；配置、脚本、测试、Node-only、Web-only 与生成产物不属于小程序 AppService。`dist`、`dist-*`、`.weapp-vite` 和依赖目录会被排除。

`.vue` 中的 script 由 Oxlint 检查；模板指令及 `RouterLink` 等模板兼容性继续由 Vue 专项 ESLint 检查。脚手架生成的 Wevu Vite+ 项目提供 `lint:vue` / `lint:vue:fix`；样式仍使用 Stylelint。静态检查不能代替目标平台的真实 IDE runtime 验证。

## 单独使用插件

`@weapp-vite/oxlint/plugin` 默认导出 Oxlint JS 插件，可用于自定义 `jsPlugins` 与规则开关。推荐配置已包含插件注册，无需再次添加。

通过插件入口接入时，规则只对执行它的 Oxlint 配置生效；文件范围应限制在小程序运行时代码，不要将 Node 构建脚本混入同一范围。

## 已有 workspace

`vp check` 优先采用 workspace 根 `vite.config.ts` 中已有的 `lint` 块，成员配置不会覆盖根规则。根配置使用预设时，需要将 `overrides[].files` 与忽略路径改为相对于根目录的成员路径，例如 `apps/mini/src/**/*.ts`；保留团队其他成员的现有配置。

`vp lint --config <path>` 可显式选择配置，`vp check` 不支持该参数。先在根配置合并预设，再通过一段应报错的小程序代码确认实际规则来源，避免把成员文件中存在预设误认为根检查已经启用。

格式配置见 [@weapp-vite/oxfmt](/packages/oxfmt)，项目生成流程见 [create-weapp-vite](/packages/create-weapp-vite)。
