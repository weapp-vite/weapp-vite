---
title: 平台语言配置
description: 使用 weapp.language 为小程序模板、样式和脚本模块设置共享的平台归属，统一 CLI 与 VSCode 的诊断和格式化。
keywords:
  - weapp.language
  - WXML
  - AXML
  - SJS
  - WXS
  - Oxlint
  - Oxfmt
---

# 平台语言配置

`weapp.language` 管理源码的平台归属，供组合 lint、格式化 CLI 与 VSCode 共用。常规规则与格式选项仍分别放在顶层 `lint`、`fmt`；构建目标继续使用 `weapp.platform`。

## 配置

在项目的 `vite.config.ts` 中添加，或在它显式导入的共享 `weapp-vite.config.ts` 中维护：

```ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    platform: 'weapp',
    language: {
      overrides: [
        { files: ['src/alipay/**'], platform: 'alipay' },
        { files: ['src/douyin/**'], platform: 'tt' },
        { files: ['src/qq/**'], platform: 'qq' },
      ],
    },
  },
})
```

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `platform` | `LanguagePlatform` | 显式指定当前配置范围的平台，优先于扩展名推断 |
| `overrides` | `{ files: string[], platform: LanguagePlatform }[]` | 按文件 glob 覆盖平台，后匹配项优先；路径相对被选中的配置根目录 |

`LanguagePlatform` 包含 `weapp`、`alipay`、`tt`、`swan`、`jd`、`xhs`、`qq`、`ks`、`ty`。QQ、快手和涂鸦的语言 profile 不会增加构建平台；当前构建仍只接受既有六个核心目标。

## 如何确定平台

先采用文件覆盖或显式 `language.platform`，再考虑唯一模板/样式扩展名、引用它的模板以及所属项目的 `weapp.platform`。多个平台共用 `.sjs`、`.wxs` 或 `.css`，单靠文件名不能证明宿主。无显式平台时，多个平台引用同一模块会诊断归属歧义，可通过显式配置解决；同一文件的编译阶段或方言冲突则需要统一引用来源，不能静默借用微信规则。

原生模块与编译源文件分别处理。`.wxs.ts`、`.sjs.ts`、`.ks.ts`、`.filter.ts` 和 `lang="ts/js"` 可使用编译阶段允许的语法；没有这些标记的原生脚本直接按目标平台方言检查。百度原生 filter 使用相对 `.filter.js` 文件及默认导出，快手使用 `.ks` / `<ks>`，不要把它们统一写成 WXS。

编译到 CommonJS 的模板模块会按导出形式保留公开 API：只有默认对象时，`export default { value }` 对应模板的 `tools.value`；同时包含命名与默认导出时，`tools.value` 访问命名导出，`tools.default.value` 访问默认对象成员。编辑器按这一映射补全、跳转和重命名，不会一起修改同名的两种导出。原生或 ESM 宿主尚未核实的混合导出返回歧义状态，停止不确定的跨文件重命名。

## 检查与格式化职责

| 入口 | 职责 |
| --- | --- |
| `weapp-vite-lint` | 一次标准 Oxlint 检查，加原生模板与脚本模块诊断 |
| `weapp-vite-lint --native-only` | 仅平台语言诊断，不执行 Oxlint |
| `weapp-vite-format --write` / `--check` | 同一配置下的标准文件、模板、样式及脚本模块格式化或只读检查 |
| `weapp-vite-format --check-all` | 一次 `vp check`、原生语言预检与格式检查、适用的 Vue / Stylelint 脚本 |

原生模板保留文本空白和属性原文，只编辑标签布局；模块在格式化前后检查平台方言与 AST 语义。任一候选文件校验失败时拒绝写回；预检期间源码发生变化时拒绝覆盖。标准 `vp fmt` 跳过由适配器接管的模板与模块，不能作为完整原生语言格式检查结果。

Oxlint 启用适用的 Vue 内置规则；需要 Vue parser services 的专项检查仍由 ESLint 执行，样式语义由 Stylelint 检查。语言服务提供语法、平台限制和符号服务，不新增完整模板类型检查器。

## 编辑器与 workspace

VSCode 使用同一内核和项目格式化入口。模板关联 `wxml` / `miniprogram-template`，独立模块及其编译源码关联 `miniprogram-script`；原生样式关联 CSS。生成项目已指定唯一格式化提供者，标准 JS/TS 继续使用 Oxc，不要把 WXML 改为 HTML。

扩展只在受信任工作区执行项目配置和工具。原生脚本的自定义语言提供共享语法与作用域能力，不提供完整 TypeScript 语言服务器；普通 JS/TS 仍使用原服务。

普通 lint / format 使用最近项目配置；`--check-all` 与 `vp check` 优先读取 workspace 根配置，成员预设不覆盖父级所有权。根配置需要用成员路径设置 glob。脚手架不自动改写上级配置。

本轮验收包括 TypeScript、CLI、实际 VSIX 宿主和构建；真实小程序 IDE runtime 不在本轮执行范围。支持清单的通过状态以实际执行证据为准，跳过或未执行场景不能算作通过。

相关文档：[语言内核](/packages/language-service)、[Oxlint](/packages/oxlint)、[Oxfmt](/packages/oxfmt)、[构建平台](/guide/multi-platform)。
