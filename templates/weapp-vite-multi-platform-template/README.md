# weapp-vite 原生多平台 + Web 模板

这个模板使用同一份原生小程序源码，按命令选择单个目标平台构建。当前覆盖微信、支付宝、抖音、百度、京东、小红书和 Web Runtime。

```sh
pnpm create weapp-vite my-app multi-platform
cd my-app
pnpm install
pnpm dev:weapp
```

## 开发

```sh
pnpm dev:weapp
pnpm dev:alipay
pnpm dev:tt
pnpm dev:swan
pnpm dev:jd
pnpm dev:xhs
pnpm dev:web
```

`pnpm dev` 默认等价于 `pnpm dev:weapp`。需要打开开发者工具时使用 `pnpm dev:open`、`pnpm open:weapp` 或 `pnpm open:alipay`。

## 构建

```sh
pnpm build:weapp
pnpm build:alipay
pnpm build:tt
pnpm build:swan
pnpm build:jd
pnpm build:xhs
pnpm build:web
```

每条命令只构建一个目标。小程序产物位于 `dist/<platform>/dist`，对应的 IDE 项目位于 `dist/<platform>`；Web 产物位于 `dist/web`。

## 平台配置

各平台项目配置位于 `config/<platform>`。创建项目后请先替换目标平台的 AppID，再导入对应的 `dist/<platform>` 目录。

便携源码使用原生 `Page()` / `Component()`，公共模板采用 WXML 语法，并通过 `wx` API 编写平台无关逻辑。构建时 `injectWeapi.replaceWx` 会替换运行时 API，模板、样式、事件和脚本模块后缀会按目标平台转换。平台专属能力应隔离在独立模块或条件入口中，避免让公共页面直接依赖某个宿主的 TypeScript 类型。

Web Runtime 适合浏览器联调和兼容验证，不能替代小程序开发者工具或真机验收。构建通过也不等于官方 IDE 编译或 Runtime 交互通过：微信和 Web 可以做自动化交互验收，支付宝使用官方 `minidev build` 做 IDE 编译检查，百度 Runtime 依赖可用的 WebSocket 端点，抖音、京东和小红书仍需在各自官方工具中人工复验。详细说明见 [多平台构建指南](https://vite.icebreaker.top/guide/multi-platform)。
