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

Wevu 同时根据当前目标自动裁剪运行时：六类小程序和 Web 各自保留所需的宿主注册适配，未使用的可选能力由编译器和 tree shaking 排除，无需额外配置。公开动态工厂与 API adapter 的兼容边界见 [Wevu 运行时](/wevu/runtime#按平台与使用能力裁剪)。

下面示例假设你在 `package.json` 脚本里使用的是 `wv dev` / `wv build`：

> [!WARNING]
> 多平台输出当前仍处于实验阶段（experimental）。执行命令前请先安装对应平台的 IDE；如果你需要用命令行唤起 IDE，请在 IDE 里开启“服务端口”，并务必在目标平台开发者工具里验证产物行为。

## 从多平台模板开始 {#template-quick-start}

<!-- tutorial-e2e:multi-platform:start -->

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

## 一份配置管理多个平台 {#unified-project-config}

已有可构建源码时，推荐把各端 AppID 和差异集中到 `projectConfigs`，不需要创建 `config/<平台>/`。公共字段只写一次，使用普通 JavaScript 对象展开：

```ts
import { defineConfig } from 'weapp-vite/config'

const common = { projectname: 'my-app' }

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    multiPlatform: {
      projectConfigs: {
        weapp: { ...common, appid: 'replace-with-weapp-app-id' },
        alipay: { ...common, appid: 'replace-with-alipay-app-id' },
        tt: { ...common, appid: 'replace-with-douyin-app-id' },
        xhs: { ...common, appid: 'replace-with-xhs-app-id' },
        jd: { ...common, appid: 'replace-with-jd-app-id' },
        swan: { ...common, appid: 'replace-with-swan-app-id' },
      },
    },
  },
})
```

- 保留已有框架插件；不写 `targets` 时从映射键推导允许列表。
- `wv build -p xhs` 仍只构建一个目标；多端上传使用 `wv upload -p xhs,tt`。
- 标准项目 JSON 由打包器生成在代码目录内，默认 `dist/<平台>/dist/`，与 `app.json` 同级。SDK/IDE 打开这个目录，生成配置的代码根为 `.`。
- 输入不填写 `miniprogramRoot`、`srcMiniprogramRoot`、`smartProgramRoot`，输出目录用 `build.outDir`；不手改生成文件。
- 公共对象展开没有隐式深合并；密钥不放入映射。不同环境的 AppID 通过外层配置函数和 `.env.<mode>` 选择，见[test/production 示例](./upload/environments.md#appid)。
- 原生项目文件仍受支持，但 `projectConfigs` 不能与 `projectConfigRoot` 混用。缺少选中平台时直接报错，不读取旧文件兜底。

## 模板的原生文件目录与输出 {#template-directories}

以下描述当前两个脚手架模板保留的原生文件方式；选择上面的统一配置后，无需维护 `config/` 目录，SDK/IDE 根也改为包含生成项目 JSON 的代码目录。

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

<!-- tutorial-e2e:multi-platform:end -->

## 构建并上传 {#upload}

六个小程序目标可通过统一入口构建并上传，Web 不参与：

```sh
pnpm exec wv build --upload -p xhs --dry-run
pnpm exec wv build --upload -p xhs --uv 1.2.3 --desc "更新首页"
pnpm exec wv upload -p xhs,tt --uv 1.2.3
pnpm exec wv upload -p all --dry-run
```

`build --upload` 复用本次目标构建；独立 `upload` 按目标逐一构建、校验、上传。多个小程序平台用 `upload -p xhs,tt` 或 `upload -p all`，首次失败停止；`build -p all --upload` 仍是“小程序 + Web”，不等于六端批量。请按[完整上传指南](./upload.md)及[小红书](./upload/xhs.md)、[抖音](./upload/tt.md)、[微信](./upload/weapp.md)、[支付宝](./upload/alipay.md)、[京东](./upload/jd.md)、[百度](./upload/swan.md)分篇准备项目配置、AppID 和凭据；[淘宝暂不支持](./upload/alipay.md#taobao)。`--dry-run` 只验证构建与产物目录，不代替真实上传、IDE 编译和 Runtime 验收。

预览使用相同的构建、目标选择和凭据，但调用官方 preview 接口，不上传开发版本：

```sh
pnpm exec wv preview -p tt --mode test
pnpm exec wv preview -p xhs,jd,swan --mode production
pnpm exec wv preview -p all --dry-run
```

返回各平台的二维码图片或预览链接；`preview` 不要求上传版本。具体结果形式、扫码权限和旧 IDE 命令迁移见 [CLI 预览说明](/guide/cli)。

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

## 平台环境变量与条件裁剪 {#platform-env}

weapp-vite 会把当前构建目标注入 `import.meta.env.PLATFORM`，`import.meta.env.MP_PLATFORM` 具有相同值。无需新增 `.env` 配置或裁剪开关：

| 构建目标 | `import.meta.env.PLATFORM` |
| --- | --- |
| 微信小程序 | `'weapp'` |
| 支付宝小程序 | `'alipay'` |
| 抖音小程序 | `'tt'` |
| 百度智能小程序 | `'swan'` |
| 京东小程序 | `'jd'` |
| 小红书小程序 | `'xhs'` |
| Web | `'web'` |

在源码中直接比较平台值，可以让构建器静态判断分支：

```ts
if (import.meta.env.PLATFORM === 'web') {
  console.info('Web 目标')
}
else {
  console.info('小程序目标')
}
```

执行 `wv build -p web` 时，变量替换为字面量 `'web'`，条件 `'web' === 'web'` 恒为真。生产优化后的代码等价于：

```js
console.info('Web 目标')
```

选择 `wv build -p weapp` 时则只保留小程序分支。变量表示本次构建的目标，不会随着运行设备改变；平台专属初始化也应放在对应分支内，避免无条件导入具有初始化副作用的模块。

Wevu 内部使用相同的编译期变量选择宿主实现，发布包保留判断表达式供应用构建替换；未注入目标时保留动态探测。router、JSX 等同平台内的可选能力根据实际导入与编译结果裁剪，详见 [Wevu 运行时](/wevu/runtime#按平台与使用能力裁剪)。

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

支付宝和抖音 Vue SFC 的 `<style scoped>` 使用 class 作用域标记，以兼容宿主不支持 Vue 属性选择器的限制；动态 class 和样式热更新保留相同的作用域隔离，无需改成全局样式。

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
