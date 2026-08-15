---
outline:
  - 2
  - 4
title: 面向多平台构建 experimental
description: Weapp-vite 提供实验性的多端适配能力：在开发/构建命令后追加 --platform （或短写 -p ），即可输出目标平台所需的文件后缀与目录结构。
keywords:
  - 微信小程序
  - guide
  - multi
  - platform
  - experimental
  - 面向多平台构建
  - Weapp-vite
  - 内置了多端适配能力：在开发/构建命令后追加
---

# 面向多平台构建 <span class="wv-badge wv-badge--experimental">experimental</span> {#multi-platform}

`weapp-vite` 内置了多端适配能力：在开发/构建命令后追加 `--platform <id>`（或短写 `-p <id>`），即可输出目标平台所需的文件后缀与目录结构。

下面示例假设你在 `package.json` 脚本里使用的是 `wv dev` / `wv build`：

> [!WARNING]
> 多平台输出当前仍处于实验阶段（experimental）。执行命令前请先安装对应平台的 IDE；如果你需要用命令行唤起 IDE，请在 IDE 里开启“服务端口”，并务必在目标平台开发者工具里验证产物行为。

## 从多平台模板开始 {#template-quick-start}

脚手架提供两条并列路线，默认模板保持不变：

| 模板                 | 适用场景                             | 页面与组件                                |
| -------------------- | ------------------------------------ | ----------------------------------------- |
| `multi-platform`     | 保留原生小程序写法，不引入额外运行时 | 原生 `Page()` / `Component()` + WXML/WXSS |
| `multi-platform-sfc` | 用 Wevu 响应式能力编写统一的 Vue SFC | `<script setup lang="ts">` + Vue SFC      |

创建原生模板：

```sh
pnpm create weapp-vite my-app multi-platform
cd my-app
pnpm install
pnpm dev:weapp
```

创建 Vue SFC 模板：

```sh
pnpm create weapp-vite my-app multi-platform-sfc
cd my-app
pnpm install
pnpm dev:weapp
```

交互执行 `pnpm create weapp-vite` 时，也可以选择“原生多平台 + Web”或“Vue SFC 多平台 + Web 模板”。两个模板都保留一个页面和一个组件，并用同一组平台标识、ready 状态与计数交互作为各端验收契约。

模板坚持单目标构建。`pnpm build:weapp` 只构建微信，`pnpm build:web` 只构建 Web，不提供会在一次命令里隐式遍历全部平台的脚本。

## 目录与输出 {#template-directories}

```text
my-app/
├─ config/
│  ├─ weapp/project.config.json
│  ├─ alipay/mini.project.json
│  ├─ tt/project.config.json
│  ├─ swan/project.swan.json
│  ├─ jd/project.config.json
│  └─ xhs/project.config.json
├─ src/
│  ├─ app.vue                    # SFC 模板；原生模板为 app.ts/app.json/app.scss
│  ├─ components/PlatformCard/   # SFC 模板为 index.vue
│  └─ pages/index/               # SFC 模板为 index.vue
├─ index.html
└─ vite.config.ts
```

| 目标   | 开发              | 构建                | IDE 项目 / 产物                    |
| ------ | ----------------- | ------------------- | ---------------------------------- |
| 微信   | `pnpm dev:weapp`  | `pnpm build:weapp`  | `dist/weapp` / `dist/weapp/dist`   |
| 支付宝 | `pnpm dev:alipay` | `pnpm build:alipay` | `dist/alipay` / `dist/alipay/dist` |
| 抖音   | `pnpm dev:tt`     | `pnpm build:tt`     | `dist/tt` / `dist/tt/dist`         |
| 百度   | `pnpm dev:swan`   | `pnpm build:swan`   | `dist/swan` / `dist/swan/dist`     |
| 京东   | `pnpm dev:jd`     | `pnpm build:jd`     | `dist/jd` / `dist/jd/dist`         |
| 小红书 | `pnpm dev:xhs`    | `pnpm build:xhs`    | `dist/xhs` / `dist/xhs/dist`       |
| Web    | `pnpm dev:web`    | `pnpm build:web`    | `dist/web`                         |

微信和支付宝还提供 `pnpm open:weapp` 与 `pnpm open:alipay`。命令会打开对应 IDE 项目根，而不是内部的小程序产物目录。

## 便携源码规则 {#portable-source}

- 原生模板使用 `Page()` / `Component()` 和 WXML/WXSS 作为便携输入；构建器会按目标生成 AXML/ACSS、TTML/TTSS、Swan/CSS、JXML/JXSS 或 XHSML/CSS。
- SFC 模板从 `wevu` 导入 `ref`、`computed` 等 Runtime API，页面和组件使用 `<script setup lang="ts">`，不要从 Vue Web Runtime 导入运行时 API。
- SFC 的 App、Page、Component 分别使用 `defineAppJson`、`definePageJson`、`defineComponentJson`。一个 SFC 只使用对应的单一 JSON 宏体系，不同时维护另一套 JSON 配置来源。
- 跨平台 SFC 使用显式 props 与事件；不要使用 `v-bind="object"`、不可赋值表达式上的 `v-model`，也不要假设 DOM、Vue Router 或其他 Web-only Vue 行为存在。
- 两种模板都不要在共享源码中依赖某个宿主独有的 TypeScript 类型。
- 公共运行时 API 可以保留 `wx` 调用，模板启用的 `injectWeapi.replaceWx` 会按目标替换为 `my`、`tt`、`swan`、`jd` 或 `xhs`。
- WXS 会按平台转换为对应脚本模块和标签语法。平台专属能力应隔离在独立模块或条件入口中，不要把宿主差异散落进公共页面。
- Web Runtime 复用公共源码，但浏览器兼容不代表小程序宿主兼容；涉及授权、支付、插件、云服务和真机 API 时仍需平台侧验收。

SFC 模板在安装后通过 `wv prepare -p weapp` 生成 `.weapp-vite` 受管类型文件。不要手工维护该目录；类型漂移时重新执行 `pnpm exec wv prepare -p weapp`，再运行 `pnpm typecheck`。

## Web 联调 {#template-web-runtime}

```sh
pnpm dev:web
pnpm build:web
```

两个模板都使用 history 路由并输出到 `dist/web`。Web 适合快速检查路由、`MP_PLATFORM=web`、ready 状态、响应式更新、浏览器错误和样式兼容；发布前仍应回到目标小程序 IDE 或真机验证宿主行为。Web Runtime 不能替代小程序 IDE 或真机验收。更多可调字段见 [Web 运行时配置](/config/web)。

## AppID 配置 {#template-appid}

仓库中的模板源文件为真实 DevTools E2E 保留可用的微信 AppID。通过 `create-weapp-vite` 生成项目时，脚手架会把 `config/weapp/project.config.json` 中的 AppID 改写为 `touristappid`，避免把仓库验收身份带入用户项目。

开始平台联调前，请在 `config/<platform>` 中填写自己项目的 AppID 或平台标识，然后重新执行对应的 `dev:<platform>` / `build:<platform>`。不要把私有密钥或 CI 凭据写入模板配置。

## 分层验收 {#template-verification}

构建成功、官方 IDE 编译成功和 Runtime 自动化成功是三种不同的信号：

| 目标   | 无凭据构建门禁 | 官方 IDE / Runtime 自动化                             | 能力边界                                        |
| ------ | -------------- | ----------------------------------------------------- | ----------------------------------------------- |
| 微信   | 必过           | DevTools Runtime 必过                                 | 验证页面数据、渲染与点击计数                    |
| 支付宝 | 必过           | `minidev build --machine-output`，本机工具就绪时执行  | 官方 IDE 编译 smoke，不描述为模拟器 Runtime E2E |
| 抖音   | 必过           | 无稳定公开 automator                                  | 在官方开发者工具中人工复验 Runtime              |
| 百度   | 必过           | 提供 `WEAPP_VITE_SWAN_WS_ENDPOINT` 时执行可选 Runtime | 端点缺失不降低构建门禁                          |
| 京东   | 必过           | 无稳定公开 automator                                  | 在官方开发者工具中人工复验 Runtime              |
| 小红书 | 必过           | 无稳定公开 automator                                  | 在官方开发者工具中人工复验 Runtime              |
| Web    | 必过           | 浏览器 Runtime 必过                                   | 验证路由、平台标识、点击状态与浏览器错误        |

仓库维护者可以使用 `pnpm e2e:platform:build` 运行六端构建矩阵；真实 IDE E2E 必须全局串行，不能和其他 DevTools、E2E、dev server 或 watcher 重叠。

## 目标声明 {#targets}

多平台项目建议先启用多平台模式，再通过命令参数选择单个平台构建：

```ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    multiPlatform: {
      enabled: true,
      targets: ['weapp', 'alipay', 'tt', 'swan', 'jd', 'xhs'],
    },
    injectWeapi: {
      enabled: true,
      replaceWx: true,
    },
    web: {
      enable: true,
      outDir: 'dist/web',
    },
  },
})
```

`multiPlatform` 不会一次构建所有平台。`wv build -p weapp`、`wv build -p alipay`、`wv build -p web` 都是独立的单目标构建。`multiPlatform.targets` 是小程序平台 allowlist；上面的显式声明与 `multi-platform`、`multi-platform-sfc` 两个模板一致。

## 支付宝小程序 {#platform-alipay}

```sh
pnpm dev -- --platform alipay
pnpm build -- --platform alipay
pnpm open -- --platform alipay
# 也可以直接调用 CLI，省去额外的 --
pnpm exec wv dev --platform alipay
pnpm exec wv build --platform alipay
pnpm exec wv open --platform alipay
```

- 产物扩展名自动变更为 `axml` / `acss` / `sjs`。
- 原生支付宝源码可以直接使用 `.axml` / `.acss`，不需要先改写成微信后缀，也不要求引入 wevu。
- 同一个项目可以保留原生 `Page()` / `Component()` 页面、组件和分包，同时逐页加入 Vue SFC。
- 在支付宝 IDE 中导入 `dist/` 目录即可预览。
- `open --platform alipay` 会自动通过 `minidev ide` 打开支付宝开发者工具（需先安装 `minidev`）。

支付宝构建会按平台选择同名 sidecar。模板优先级为 `.axml`、`.wxml`、`.html`，样式优先级为 `.acss`、`.wxss`、`.css` 和预处理器。因此迁移现有支付宝项目时，可以保留原生目录：

```text
src/
├─ app.ts
├─ app.json
├─ app.acss
├─ pages/index/
│  ├─ index.ts
│  ├─ index.json
│  ├─ index.axml
│  ├─ index.acss
│  └─ utils.sjs
├─ components/native-counter/
│  ├─ index.ts
│  ├─ index.json
│  ├─ index.axml
│  └─ index.acss
└─ pages/profile/index.vue
```

原生 `.axml` 输入会保留支付宝自身的 `onTap`、`a:if`、`import-sjs from/name` 等语法。使用便携 `.wxml` 或 Vue SFC 时，编译器仍会按支付宝目标进行模板归一化。这让两种迁移路线都成立：项目可以停留在 `weapp-vite + 原生支付宝`，也可以在构建稳定后逐步迁移到 Vue SFC。

> [!NOTE]
> 当前自动化覆盖 App、Page、Component、分包、SJS、npm 组件、原生 layout 和 Vue SFC 共存。支付、授权、云服务、插件和真机专属 API 仍应由业务项目在支付宝开发者工具和真机中单独验收。

## 字节系（抖音 / 今日头条）小程序 {#platform-tt}

```sh
pnpm dev -- --platform tt
pnpm build -- --platform tt
pnpm exec wv dev --platform tt
pnpm exec wv build --platform tt
```

- 支持字节全家桶（抖音 / 今日头条 / 番茄小说等）所需的 `ttml` / `ttss` 扩展名。
- 原生抖音源码可以直接使用 `.ttml` / `.ttss`，不需要先改写成微信后缀，也不要求引入 wevu。
- 同一个项目可以保留原生 `App()` / `Page()` / `Component()`、分包和 npm 原生组件，同时逐页加入 Vue SFC。
- 推荐使用抖音开发者工具导入构建产物并完成模拟器复验。

抖音构建会按平台选择同名 sidecar。模板优先级为 `.ttml`、`.wxml`、`.html`，样式优先级为 `.ttss`、`.wxss`、`.css` 和预处理器。迁移现有项目时可以保留原生目录：

```text
src/
├─ app.ts
├─ app.json
├─ app.ttss
├─ pages/index/
│  ├─ index.ts
│  ├─ index.json
│  ├─ index.ttml
│  ├─ index.ttss
│  └─ utils.wxs
├─ components/native-counter/
│  ├─ index.ts
│  ├─ index.json
│  ├─ index.ttml
│  └─ index.ttss
└─ pages/profile/index.vue
```

原生 `.ttml` 输入会保留 `tt:*`、`bind:tap` / `catch:tap`、`wxs` 标签、原生组件标签和宿主表达式。使用便携 `.wxml` 或 Vue SFC 时，编译器仍会按抖音目标生成 TTML。原生页面、WXS、原生分包和 npm 原生组件可以留在原生区，新页面则可以渐进进入 Vue/wevu 区。

本仓库提供确定性的构建门禁和本机工具诊断：

```sh
pnpm e2e:platform:doctor:tt
pnpm e2e:platform:open:tt
```

`doctor:tt` 检测 macOS 上的抖音开发者工具和版本；`open:tt` 构建 `apps/douyin-native-demo` 并打开可导入的项目根。抖音开发者工具目前没有纳入本项目的稳定公开 CLI 或 automator，因此该入口只负责启动官方工具，模拟器交互仍需在本机完成，不会被描述为 `wv open -p tt` 的公开自动化能力。

> [!NOTE]
> 当前自动化构建覆盖原生 App、Page、Component、分包、layout、WXS、本地 npm 原生组件和 Vue SFC 共存；本机模拟器复验覆盖渲染、事件、路由、响应式状态与 `tt` runtime marker。支付、授权、直播、广告、云服务、插件、真机专属 API 和业务域能力不在本次兼容声明内。

## 百度智能小程序 {#platform-swan}

```sh
pnpm dev -- --platform swan
pnpm build -- --platform swan
pnpm exec wv dev --platform swan
pnpm exec wv build --platform swan
```

- 输出 `swan` / `css` / `sjs` 等百度专用格式。
- 在百度智能小程序开发者工具中选择 `dist/` 目录。

## 京东小程序 {#platform-jd}

```sh
pnpm dev -- --platform jd
pnpm build -- --platform jd
pnpm exec wv dev --platform jd
pnpm exec wv build --platform jd
```

- 自动转换为 `jxml` / `jxss` 等京东特有的扩展名。
- 构建完成后可直接导入京东小程序 IDE。

## 小红书小程序 {#platform-xhs}

```sh
pnpm dev -- --platform xhs
pnpm build -- --platform xhs
pnpm exec wv dev --platform xhs
pnpm exec wv build --platform xhs
```

- 生成 `xhsml` / `css` 等小红书小程序所需格式。
- 结合小红书开发者中心提供的工具进行预览 / 上传。

> [!TIP]
> 需要同时输出 Web 版本时，可以在另一个终端运行 `pnpm dev -- --platform web` 或 `pnpm exec wv dev --platform web`。
> 也可以在 `package.json` 里写专用脚本（例如 `"dev:alipay": "wv dev --platform alipay"`），之后直接运行 `pnpm dev:alipay`，避免每次手动输入 `-- --platform ...`。
