---
title: "@weapp-vite/oxfmt"
description: "@weapp-vite/oxfmt 提供 Oxfmt 格式预设与安全 WXML 格式适配器。"
keywords:
  - Weapp-vite
  - Oxfmt
  - Vite+
  - WXML
  - WXSS
  - "@weapp-vite/oxfmt"
---

# @weapp-vite/oxfmt

`@weapp-vite/oxfmt` 导出 `recommended` 格式预设，并提供 `weapp-vite-format` 命令。预设统一 TypeScript、Vue 与 WXSS 格式，并忽略 WXML；项目命令通过独立适配器处理 WXML 的标签与属性空白，保留小程序模板语义。

## 安装与配置

Vite+ 使用配套的 Oxfmt 执行器，仅需添加预设包：

```bash
pnpm add -D @weapp-vite/oxfmt
```

将 `fmt` 合并到现有 `vite.config.ts`，保留项目的构建配置：

```ts
import { recommended } from '@weapp-vite/oxfmt'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  fmt: recommended,
})
```

```bash
pnpm exec weapp-vite-format --check
pnpm exec weapp-vite-format --write
pnpm exec weapp-vite-format --check-all
```

普通 Oxfmt 项目可安装 `oxfmt`，将推荐配置保存为 `.oxfmtrc.json`：

```bash
node --input-type=module -e "import { recommended } from '@weapp-vite/oxfmt'; console.log(JSON.stringify(recommended, null, 2))" > .oxfmtrc.json
pnpm exec oxfmt --check
```

这个 JSON 文件是项目拥有的配置快照；升级预设后可重新生成并审阅差异，已有自定义配置应先合并再保存。

`weapp-vite-format` 使用当前项目安装的 Vite+，将标准文件检查与 WXML 适配器组合在同一条命令中：

| 命令 | 覆盖范围 |
| --- | --- |
| `--write` | `vp fmt --write` 与 WXML 标签格式化 |
| `--check` | `vp fmt --check` 与 WXML 只读格式检查 |
| `--check-all` | `vp check` 与 WXML 只读格式检查 |

任一检查失败，整条命令都会失败。写入模式会先验证全部待处理 WXML；无法保留文本或结构时直接报错，标准格式化失败时也不会写入 WXML。

## 格式约定

| 选项 | 默认值 |
| --- | --- |
| 缩进 | 2 空格 |
| 行尾 | LF，并保留文件末尾换行 |
| 字符串 | 单引号 |
| 分号 | 不添加 |
| 末尾逗号 | `all` |
| HTML 空白敏感度 | `strict` |
| import / Tailwind 类名排序 | 关闭 |

预设将 `.wxss` 关联为 CSS，并忽略 `.wxml`；使用该预设直接运行 `vp fmt` 或普通 Oxfmt 不会处理 WXML。生成产物、依赖目录与 `.weapp-vite` 不参与格式化。保留预设中的 WXML 忽略项，不要将 `.wxml` 重新关联为 HTML。

WXML 适配器只调整标签及属性之间的空白，逐字保留文本、插值、属性值与内联 WXS，并保持标签顺序和自闭合形式。上表的字符串、行尾等默认值不会用来重写这些受保护内容。独立 WXS 也不作为普通 JavaScript 自动改写。普通 Oxfmt 项目可以单独复用 `recommended` 的非 WXML 配置；需要上述完整命令时安装 Vite+。

若项目需要覆盖个别格式选项，保留其他默认值：

```ts
import { recommended } from '@weapp-vite/oxfmt'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  fmt: {
    ...recommended,
    printWidth: 100,
  },
})
```

适配器读取项目实际使用的 `fmt` 配置及文件 `overrides`；例如上述 `printWidth` 同样控制 WXML 标签换行。`--write` / `--check` 从当前项目查找最近的配置，也可用 `-c` / `--config` 指定 Vite 配置或 Oxfmt JSON 配置，并传入文件或目录范围：

```bash
pnpm exec weapp-vite-format --check src
pnpm exec weapp-vite-format --write --config vite.config.ts src/pages
```

生成产物和用户的忽略规则会继续生效；预设中供标准 Oxfmt 跳过 WXML 的 `**/*.wxml` 由适配器接管，不会导致项目 WXML 检查被整体跳过。

## 检查边界

Oxfmt 与 WXML 适配器负责各自支持的格式，Oxlint 负责代码规则，Stylelint 继续检查样式与 Vue SFC style。Wevu 项目的模板兼容性由 Vue 专项 ESLint 检查。不要让多个格式工具同时改写同一文件；Vite+ 脚手架已同步编辑器设置与项目脚本。

已有 workspace 中，`--check-all` 的标准检查与 WXML 适配器都优先使用根 `vite.config.ts` 的 `fmt` 块；成员预设不会覆盖根策略。团队应在根配置合并预设，将 `overrides` 与忽略路径写为相对根目录的成员路径，例如 `apps/mini/**/*.wxml`。根目录没有格式配置时，再查找成员配置。

`weapp-vite-format --check-all` 与 `vp check` 都不接受 `--config`。日常使用脚手架的 `pnpm format` / `pnpm format:check` / `pnpm check`，才能包含 WXML；单独的 `vp fmt` 结果不代表 WXML 已检查。

语义规则见 [@weapp-vite/oxlint](/packages/oxlint)，项目生成流程见 [create-weapp-vite](/packages/create-weapp-vite)。
