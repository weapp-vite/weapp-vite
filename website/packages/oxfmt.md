---
title: "@weapp-vite/oxfmt"
description: "@weapp-vite/oxfmt 提供 Oxfmt 格式预设、多平台模板及脚本模块的安全格式化。"
keywords:
  - Weapp-vite
  - Oxfmt
  - Vite+
  - WXML
  - WXSS
  - "@weapp-vite/oxfmt"
---

# @weapp-vite/oxfmt

小程序共享格式预设与安全格式化入口。配套 Vite+ 1.2.0 / Oxfmt 0.73.0，CLI 与 VSCode 共用 `@weapp-vite/language-service`。

```ts
import { recommended } from '@weapp-vite/oxfmt'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  fmt: recommended,
})
```

默认两空格、单引号、无分号、LF、末尾换行和多行尾逗号。不排序 import、`package.json` 字段或 Tailwind class。

## 项目命令

```sh
pnpm exec weapp-vite-format --write
pnpm exec weapp-vite-format --check
pnpm exec weapp-vite-format --check-all
```

| 命令 | 处理范围 |
| --- | --- |
| `--write` | 在内存完成全部候选文件的格式与语义预检，通过后写入 |
| `--check` | 使用相同格式入口只读检查，任何文件需要格式化时失败 |
| `--check-all` | 一次 `vp check`、原生语言预检与格式检查，以及项目存在的 `lint:vue`、`stylelint` 脚本 |

标准文件使用项目安装的 Oxfmt API，原生模板、脚本模块和样式进入对应适配器。`--check-all` 不替代项目独立的 TypeScript 类型检查。原生语言诊断也可通过 `weapp-vite-lint --native-only` 单独执行。

## 语言范围与语义保护

| 文件 | 处理方式 |
| --- | --- |
| `.wxml`、`.axml`、`.ttml`、`.swan`、`.jxml`、`.qml`、`.ksml`、`.xhsml`、`.tyml` | 共享 TS scanner 与源码片段编辑，仅调整标签和属性布局 |
| `.wxss`、`.acss`、`.ttss`、`.qss`、`.jxss`、`.tyss` 和原生 `.css` | CSS 格式化，保留 `rpx`、Tailwind 指令、条件注释和声明顺序；Stylelint 负责样式语义 |
| 独立/内联 WXS、SJS、KS、filter | 平台方言预检、词法兼容处理、Oxfmt、格式化后 AST 与方言复验 |
| `.wxs.ts`、`.sjs.ts`、`.ks.ts`、`.filter.ts` 及 `lang="ts/js"` | 按待编译源码处理，不把合法源码提前限制为宿主原生语法 |

模板逐字保留文本空白、实体、插值、属性值及引号、属性顺序、重复属性和显式闭合形式，不经过 DOM 序列化。内联脚本由模块适配器独立处理；`formatWxml` 兼容 API 仍保持内联脚本原文。

脚本模块按实际平台检查模块系统和内建能力，不把所有 `.sjs` 解释成微信 WXS。百度原生 filter 使用相对 `.filter.js` 引用并通过默认导出暴露函数。方言、词法、结构或 AST 语义校验失败时拒绝写回；文件在预检期间被修改时拒绝覆盖。

预设排除依赖、构建产物、`.weapp-vite`、受管生成目录与锁文件。供标准 `vp fmt` 跳过原生模板和模块的忽略项由组合 CLI 接管，不会因此跳过普通源码。不要把原生模板重新关联为 HTML；单独的 `vp fmt` 不包含完整原生语言检查。

## 配置与 workspace

`lint` / `fmt` 继续位于 `vite.config.ts`。平台选择放在 `weapp.language`，支持 `platform` 与 `overrides: [{ files: string[], platform }]`；配置影响 CLI 和 VSCode。存在歧义或互相冲突的模块引用时给出诊断，需显式配置归属。

`--write` / `--check` 使用最近的项目配置，也可通过 `--config` 指定 Vite 配置或 `.oxfmtrc.json`。格式遵循实际 `fmt`、文件 `overrides`、忽略路径和 `.gitignore`；不通过忽略普通源码消除格式失败。

```sh
pnpm exec weapp-vite-format --write src/pages
pnpm exec weapp-vite-format --check -c .oxfmtrc.json 'src/**/*.wxml'
```

`--check-all` 与 `vp check` 优先使用 workspace 根配置，不接受 `--config`；成员预设不覆盖父工作区的 `lint` / `fmt` 所有权。根配置的 glob 和忽略路径需相对根目录定位到成员项目。

## 程序接口与编辑器

```ts
import { formatDocument } from '@weapp-vite/oxfmt/languages'
import { formatWxml } from '@weapp-vite/oxfmt/wxml'

const template = await formatDocument(source, 'src/page.axml')
const compatible = await formatWxml(source, 'src/page.wxml', { printWidth: 100 })
```

`formatDocument` 支持全部登记语言与内联模块。`@weapp-vite/oxfmt/project` 导出项目配置解析、文档归属解析和 `prepareProjectFormatting`，供 CLI 与编辑器适配层复用。显式传入格式选项时采用该配置；需要固定风格时提供完整所需选项。

VSCode 扩展使用项目安装的工具，仅在受信任工作区加载项目配置与格式化器。模板及原生模块使用扩展的唯一格式化提供者，标准 JS/TS 使用 Oxc；错误输入显示诊断并返回零修改。此包不新增完整模板类型检查器，不替代 Vue 专项 ESLint、Stylelint 或平台编译器。本轮验收覆盖 TS、CLI、VSCode 和构建，不代表真实小程序 IDE runtime 验收。

相关文档：[平台语言配置](/config/language)、[语言内核](/packages/language-service)、[创建项目](/packages/create-weapp-vite)。
