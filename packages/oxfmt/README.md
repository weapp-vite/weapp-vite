# @weapp-vite/oxfmt

小程序项目的共享 Oxfmt 格式预设和安全 WXML 格式化入口，适用于 Vite+ 1.2.0 内置的 Oxfmt 0.73.0 及其配置接口。

```ts
import { recommended } from '@weapp-vite/oxfmt'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  fmt: recommended,
})
```

默认使用两空格、单引号、无分号、LF、末尾换行和多行尾逗号。关闭 import、`package.json` 字段与 Tailwind class 自动排序，保留代码和依赖声明的既有顺序。

预设将 `*.wxss` 关联为 CSS。直接运行 `vp fmt` 时会跳过 WXML，因为 Oxfmt 的 HTML 格式化即使使用 `htmlWhitespaceSensitivity: 'strict'`，也可能合并文本中的连续空格。

忽略 `dist`、`dist-*`、`.weapp-vite`、`node_modules`、`miniprogram_npm`、`generated` 目录及包管理器锁文件。WXSS 中的 `rpx`、选择器、属性和 Vue `<style>` 的语义仍由 Stylelint 检查。

```sh
pnpm exec weapp-vite-format --check
pnpm exec weapp-vite-format --write
pnpm exec weapp-vite-format --check-all
```

`weapp-vite-format` 使用项目中的同一套 Vite+：`--check` 和 `--write` 分别运行 `vp fmt --check` 和 `vp fmt --write`，再检查或写入安全格式化的 WXML；`--check-all` 运行 `vp check`，并检查 WXML。CLI 与 WXML API 需要项目安装 Vite+ `>=1.2.0 <2`；只使用预设时不会强制安装它。

WXML 适配器只调整标签和属性之间的布局，逐字保留文本、标签之间的空白、插值、属性值、注释、CDATA 和 WXS 内容，不自动插入文本换行或调整文本缩进。它一次性把受保护的标签交给 Oxfmt，并校验恢复后的结构；遇到无法安全解析或校验的内容会报错。写入前会预检所有目标 WXML，文件在格式化期间发生变化时拒绝覆盖。

默认读取当前目录到工作区根目录之间最近的 `vite.config.*` 中的 `fmt`，或 `.oxfmtrc.json`。`--check-all` 与 Vite+ 一致，优先使用工作区根配置。WXML 适配器遵循配置中的 `printWidth`、`overrides`、生成目录忽略规则、`.gitignore` 和项目根 `.prettierignore`；预设用于阻止原生 Oxfmt 处理 WXML 的 `**/*.wxml` 忽略项由适配器单独接管。

可以指定文件、目录、glob 和 JSON 配置。路径相对命令执行目录解析；`--check-all` 不接受 `--config`。

```sh
pnpm exec weapp-vite-format --write src/pages
pnpm exec weapp-vite-format --check -c .oxfmtrc.json 'src/**/*.wxml'
```

程序调用入口同样保留 WXML 的文本语义：

```ts
import { formatWxml } from '@weapp-vite/oxfmt/wxml'

const formatted = await formatWxml(source, 'src/pages/index/index.wxml', {
  printWidth: 100,
})
```

需要调整普通文件的格式时展开 `recommended`，覆盖 Oxfmt 的公开配置项即可。此包不替代 Oxlint、Stylelint 或小程序编译器的语义检查。
