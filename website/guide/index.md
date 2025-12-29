---
outline: [2, 4]
---

# 快速开始 {#getting-started}

> [!IMPORTANT]
> 在使用前，请确保安装 **Node.js ≥ 20.19.0**。推荐使用 [Node.js 官网](https://nodejs.org/) 的 LTS 版本，并全局安装 `pnpm`（`npm i -g pnpm`）。

## 0. 准备工作

1. 下载并安装最新版 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. 启动开发者工具，在「设置 > 安全设置」中勾选 **服务端口**。这是 `pnpm dev --open`、`pnpm open` 等命令能够唤起 IDE 的前提条件。
3. 初次尝试可以先手动启动一次项目，验证开发者工具路径是否正确，避免命令行提示 _“请先在微信开发者工具中开启服务端口”_ 这类错误。

## 1. 使用内置模板

### 1. 选择模板

执行以下命令，快速创建一个集成了 `weapp-vite` 的原生微信小程序项目：

::: code-group

```sh [pnpm]
pnpm create weapp-vite
```

```sh [yarn]
yarn create weapp-vite
```

```sh [npm]
npm create weapp-vite@latest
```

```sh [bun]
bun create weapp-vite
```

:::

::: details 生成的 `my-app` 项目中，默认包含以下内容:

```sh
.
├── README.md
├── package.json
├── project.config.json
├── project.private.config.json
├── src
│   ├── app.json
│   ├── app.scss
│   ├── app.ts
│   ├── components
│   │   └── HelloWorld
│   │       ├── HelloWorld.json
│   │       ├── HelloWorld.scss
│   │       ├── HelloWorld.ts
│   │       └── HelloWorld.wxml
│   ├── pages
│   │   └── index
│   │       ├── index.json
│   │       ├── index.scss
│   │       ├── index.ts
│   │       └── index.wxml
│   ├── sitemap.json
│   ├── theme.json
│   ├── utils
│   │   └── util.ts
│   └── vite-env.d.ts
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

:::

### 2. 切换到目录中，执行安装命令

::: code-group

```sh [pnpm]
pnpm i
```

```sh [yarn]
yarn
```

```sh [npm]
npm i
```

```sh [bun]
bun i
```

:::

### 3. 开始开发

#### 执行 `dev` 命令（已开启服务端口后再添加 `--open`）

::: code-group

```sh [pnpm]
pnpm dev
pnpm dev --open # 已开启服务端口时自动打开微信开发者工具
```

```sh [yarn]
yarn dev --open # 已开启服务端口时自动打开微信开发者工具
```

```sh [npm]
npm run dev -- --open # 已开启服务端口时自动打开微信开发者工具
```

```sh [bun]
bun dev --open # 已开启服务端口时自动打开微信开发者工具
```

:::

### 4. 开发者工具预览

#### 执行 `open` 命令

::: code-group

```sh [pnpm]
pnpm open
```

```sh [yarn]
yarn open
```

```sh [npm]
npm run open
```

```sh [bun]
bun open
```

:::

> [!TIP]
> 如果命令行提示 “请先在微信开发者工具中开启服务端口”，请回到「微信开发者工具 → 设置 → 安全设置」重新勾选该选项，并重启开发者工具后再次运行命令。

## 2. 手动集成

### 1. 创建项目

打开微信开发者工具, 点击 `+` 创建一个项目，依次选择 `开发模式: 小程序` , `后端服务: 不使用云服务`, `模板选择: 第二项选择 基础`, 选择 `JS` 基础模板

> 使用 `JS` 基础模板创建项目，依然可以使用 `TypeScript`

![](../images/create-project.png)

> 如果你创建的是 **TS 模板项目**，请在 `vite.config.ts` 中设置 [`weapp.srcRoot`](../config/paths.md#weapp-srcroot) 为 `'./miniprogram'`。

### 2. 手动接入 weapp-vite

如果你已经有运行中的小程序，希望在原目录上直接接入 weapp-vite，请跳转到[《手动集成》](/guide/manual-integration)查看完整步骤（依赖安装、脚本配置、目录迁移等）。这里的快速开始章节仅演示模板创建流程。

完成依赖与脚本配置后，执行一次安装命令，确保 `node_modules` 就绪：

::: code-group

```sh [pnpm]
pnpm i
```

```sh [yarn]
yarn
```

```sh [npm]
npm i
```

```sh [bun]
bun i
```

:::

这样微信开发小程序的智能提示(`types`)，也都被安装进来

> 了解更详细的文件与配置说明，可参考[《手动集成》](/guide/manual-integration)；想知道 CLI 初始化做了哪些改动，可阅读 [`weapp-vite init 做了什么?`](/deep/init)。

## 预置命令

### 开发命令

```sh
pnpm dev
pnpm dev --open # 已开启服务端口时自动打开微信开发者工具
pnpm dev -o # 已开启服务端口时自动打开微信开发者工具
```

命令会启动文件监听器，保存代码后会自动重新编译并同步到 `dist` 目录，无需手动刷新。

### 构建命令

```sh
pnpm build
pnpm build --open # 打开微信开发者工具，见下方
pnpm build -o # 打开微信开发者工具，见下方
```

此时会启用 `vite` 自带的 `build` 模式，删除整个 `dist` 目录重新生成，并进行代码压缩

### 打开微信开发者工具命令

```sh
pnpm open
```

使用这个命令直接打开微信开发者工具

> [!Warning]
> 需要打开 `微信开发者工具` 的 `服务端口` 功能，具体菜单为 `设置` > `安全设置` > 开启 `服务端口`

> [!Warning]
> Linux系统目前没有官方微信开发者工具，请安装社区版： [msojocs/wechat-web-devtools-linux](https://github.com/msojocs/wechat-web-devtools-linux)，并将 `wechat-devtools-cli`链接到系统 `PATH` 目录下，如：

```sh
sudo ln -s /opt/apps/io.github.msojocs.wechat-devtools-linux/files/bin/bin/wechat-devtools-cli /usr/local/bin/
```

### 生成组件命令

```sh
pnpm g [filename]
```

用于快速生成组件，页面和 `app`，更多查看 [生成脚手架](/guide/generate) 章节

## 简易配置项

> 假如你是用微信开发者工具创建的 `typescript` 模板项目，那么你需要设置 `srcRoot: './miniprogram'`

配置项可以与 `vite` 通用，同时加入了 `weapp-vite` 的扩展:

`vite.config.[m]ts`:

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  // 其他的配置同
  weapp: {
    // 用来配置监听 app.json 所在的目录
    // 比如默认情况下 ts 创建的项目，app.json 所在为 './miniprogram'
    srcRoot: './miniprogram',
    // other weapp-vite options
  },
})
```

你可以在 `defineConfig` 使用其他的 `vite` 插件，比如 `weapp-tailwindcss`

[查看更多的配置列表](/config/)

当然还有更多更强的功能，正在等待你的探索，让我们赶紧进入下一章吧
