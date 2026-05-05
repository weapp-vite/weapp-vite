# weapp-vite-tailwindcss-template

## 1.0.8

### Patch Changes

- 🐛 **移除 Tailwind CSS 4 模板中重复声明的业务层 autoprefixer 配置与依赖，改由 weapp-tailwindcss 的 Tailwind 4 内置 autoprefixer 后处理统一补齐小程序 WebView 兼容前缀。** [`b0aba2f`](https://github.com/weapp-vite/weapp-vite/commit/b0aba2f6f3521391452af5a800acc93b3e3db29b) by @sonofmagic

## 1.0.7

### Patch Changes

- 🐛 **将脚手架生成项目中的 `AGENTS.md` 改为由 `create-weapp-vite` 统一动态生成，不再在各模板目录中重复维护近似副本。新的 AGENTS 指引会集中补充 `weapp-vite` 的 CLI / prepare / screenshot / ide logs 用法、`wevu` 模板的运行时编写约束，以及推荐安装的 AI skills 列表，降低后续模板间文案漂移和维护成本。** [`14f3885`](https://github.com/weapp-vite/weapp-vite/commit/14f38856796ae70ccf9015b51554b6f6f0c820aa) by @sonofmagic

- 🐛 **将仓库内模板默认的 `dev`、`build`、`open`、`generate`、`prepare` 等 CLI 脚本调用从 `weapp-vite` 统一切换为 `wv`，让模板项目与当前推荐的命令别名保持一致。同时为脚手架生成的新项目默认注入根目录 `AGENTS.md`，明确告知 AI 代理安装依赖后优先阅读 `node_modules/weapp-vite/dist/docs/` 下的随包文档，并在做小程序截图验收时优先使用 `weapp-vite screenshot` / `wv screenshot`，在需要查看终端日志时优先使用 `weapp-vite ide logs --open` / `wv ide logs --open`。此外，`weapp-vite` npm 包会同步发布 `dist/docs` 本地文档目录，减少 AI 在其他仓库里依赖过时外部资料的概率。同步补充 `create-weapp-vite` 的版本变更，确保脚手架生成的新项目默认携带同一套命令与 AI 指引。** [`acf8c14`](https://github.com/weapp-vite/weapp-vite/commit/acf8c14a4657859ca305c128bc86145228f3e524) by @sonofmagic

## 1.0.6

### Patch Changes

- 🐛 **修复 `.weapp-vite/tsconfig.app.json` 的默认类型与别名生成：现在会自动注入 `weapp-vite/client`，并让 `@/*` 跟随 `weapp.srcRoot`。同时清理 templates 中仍残留在根目录和 `src/` 下的旧支持文件，统一改由 `.weapp-vite` 托管生成。** [`94320d3`](https://github.com/weapp-vite/weapp-vite/commit/94320d3ec92e3803054e4d8f7dd8e60d7c1f7e12) by @sonofmagic

## 1.0.5

### Patch Changes

- 🐛 **为其余原生基础模板补充全原生 `layouts` 能力。相关模板现在统一使用 `src/layouts/*/index.{json,ts,wxml,scss}` 作为布局实现，并提供原生页面版的布局演示页与首页入口，不再混入 Vue 布局文件。** [`3121e45`](https://github.com/weapp-vite/weapp-vite/commit/3121e4545d981e14b08352863134223c5328a757) by @sonofmagic

## 1.0.4

### Patch Changes

- 🐛 **统一脚手架模板与仓库模板的忽略规则，默认忽略项目根目录下 `.weapp-vite/` 中的所有内容，为后续沉淀更多本地构建缓存和工具状态文件预留稳定目录约定，避免生成项目后误提交内部缓存产物。** [`2eee335`](https://github.com/weapp-vite/weapp-vite/commit/2eee33515a759635285e34104912558556551690) by @sonofmagic

## 1.0.3

### Patch Changes

- [`9a0fc27`](https://github.com/weapp-vite/weapp-vite/commit/9a0fc27488d46fab165d6bb8a6a75071224921e3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: use OIDC for ci publish

## 1.0.2

### Patch Changes

- [`0ae2a53`](https://github.com/weapp-vite/weapp-vite/commit/0ae2a53198b8d3ab3e8a9ac18ee125e2017a8f51) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: change website url

## 1.0.1
