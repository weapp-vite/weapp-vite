# weapp-vite 多平台 Vue SFC + Web 模板

这个模板使用 Wevu 和 Vue SFC 编写 App、Page 与 Component，并按命令选择单个目标平台构建。当前覆盖微信、支付宝、抖音、百度、京东、小红书和 Web Runtime。

```sh
pnpm create weapp-vite my-app multi-platform-sfc
cd my-app
pnpm install
pnpm dev:weapp
```

## 开发与构建

```sh
pnpm dev:weapp
pnpm dev:alipay
pnpm dev:tt
pnpm dev:swan
pnpm dev:jd
pnpm dev:xhs
pnpm dev:web

pnpm build:weapp
pnpm build:alipay
pnpm build:tt
pnpm build:swan
pnpm build:jd
pnpm build:xhs
pnpm build:web
```

每条命令只构建一个目标。小程序产物位于 `dist/<platform>/dist`，对应的 IDE 项目位于 `dist/<platform>`；Web 产物位于 `dist/web`。

## SFC 约束

- Runtime API 从 `wevu` 导入，页面和组件默认使用 `<script setup lang="ts">`。
- App、Page、Component 分别使用 `defineAppJson`、`definePageJson`、`defineComponentJson`，一个 SFC 不混用多套 JSON 配置。
- 公共模板使用显式 props 与事件，不使用 `v-bind="object"`、不可赋值的 `v-model` 或仅适用于 Vue Web 的模板行为。
- `.weapp-vite` 是 `wv prepare` 管理的类型支持目录；类型漂移时先运行 `pnpm exec wv prepare -p weapp`。

各平台项目配置位于 `config/<platform>`。创建项目后请替换目标平台的 AppID，再导入对应的 `dist/<platform>` 目录。

Web Runtime 适合浏览器联调和兼容验证，不能替代小程序开发者工具或真机验收。微信和 Web 可以做自动化交互验收，支付宝使用官方 `minidev build` 做 IDE 编译检查，百度 Runtime 依赖可用的 WebSocket 端点，抖音、京东和小红书仍需在各自官方工具中人工复验。详细说明见 [多平台构建指南](https://vite.icebreaker.top/guide/multi-platform)。
