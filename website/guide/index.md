---
outline: [2, 4]
---

# 快速开始 {#getting-started}

> [!IMPORTANT]
> 在使用前，请确保你安装了 `Nodejs` 且版本 `>=20.5.0 || >=18.18.0`
>
> 推荐使用 [Nodejs 官网](https://nodejs.org/) 上的 `LTS` 版本
>
> 另外也推荐使用 `pnpm` 安装方式 `npm i -g pnpm`

## 1. 使用内置模板

### 1. 选择模板

使用下方的命令，创建一个 `weapp-vite` 集成的原生微信小程序项目。

::: code-group

```bash [pnpm]
pnpm create weapp-vite@latest
```

```bash [yarn]
yarn create weapp-vite@latest
```

```bash [npm]
npm create weapp-vite@latest
```

:::

::: details 生成的 `my-app` 项目中，默认包含以下内容:

```bash
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
│   │   └── Navbar
│   │       ├── Navbar.json
│   │       ├── Navbar.scss
│   │       ├── Navbar.ts
│   │       └── Navbar.wxml
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

```bash [pnpm]
pnpm i
```

```bash [yarn]
yarn
```

```bash [npm]
npm i
```

:::

### 3. 开始开发

#### 执行 `dev` 命令

::: code-group

```bash [pnpm]
pnpm dev
pnpm dev -o # 打开微信开发者工具
```

```bash [yarn]
yarn dev -o # 打开微信开发者工具
```

```bash [npm]
npm run dev -o # 打开微信开发者工具
```

:::

### 4. 开发者工具预览

#### 执行 `open` 命令

::: code-group

```bash [pnpm]
pnpm open
```

```bash [yarn]
yarn open
```

```bash [npm]
npm run open
```

:::

## 2. 手动安装

### 1. 创建项目

打开微信开发者工具, 点击 `+` 创建一个项目，依次选择 `开发模式: 小程序` , `后端服务: 不使用云服务`, `模板选择: 第二项选择 基础`, 选择 `JS` 基础模板

> 使用 `JS` 基础模板创建项目，依然可以使用 `TypeScript`

![](../images/create-project.png)

> 假如你创建的是一个 `TS` 模板项目，你需要在 `vite.config.ts` 里的 `weapp.srcRoot` 配置项，指明使用的是 `'./miniprogram'` 目录，详见本页下方

### 2. 初始化安装

然后在项目根目录，执行初始化命令：

```sh
# 执行初始化命令
npx weapp-vite init
```

于是就初始化成功了！然后再执行一下安装包的命令

::: code-group

```bash [pnpm]
pnpm i
```

```bash [yarn]
yarn
```

```bash [npm]
npm i
```

:::

这样微信开发小程序的智能提示(`types`)，也都被安装进来

> 了解更多请查看 [`weapp-vite init 做了什么?`](/deep/init) 章节

## 预置命令

### 开发命令

```sh
pnpm dev
pnpm dev --open # 打开微信开发者工具，见下方
pnpm dev -o # 打开微信开发者工具，见下方
```

此时会启动 **1到多个** `fs.watcher` 对项目进行监听，发生更改就重新打包编译，并输出到 `dist` 目录

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
