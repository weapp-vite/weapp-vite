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

## 目标声明 {#targets}

多平台项目建议先启用多平台模式，再通过命令参数选择单个平台构建：

```ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    multiPlatform: true,
    web: {
      enable: true,
      outDir: 'dist/web',
    },
  },
})
```

`multiPlatform: true` 不会一次构建所有平台。`wv build -p weapp`、`wv build -p alipay`、`wv build -p web` 都是独立的单目标构建。`multiPlatform.targets` 仍可作为小程序平台 allowlist 使用，但普通项目不需要显式列出所有平台。

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
- 推荐使用字节小程序开发者工具导入构建产物。

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
