---
title: 手动集成 Weapp-vite
description: 已经有运行中的微信小程序？可以按下面步骤在不依赖脚手架的情况下把 Weapp-vite 接进来。整体思路就三步：补齐配置文件 → 安装依赖 → 调整目录。
keywords:
  - Weapp-vite
  - 配置
  - guide
  - manual
  - integration
  - 手动集成
  - 接进来。整体思路就三步：补齐配置文件
  - →
---

# 手动集成 Weapp-vite

已经有运行中的微信小程序？可以按下面步骤在不依赖脚手架的情况下把 `weapp-vite` 接进来。整体思路就三步：补齐配置文件 → 安装依赖 → 调整目录。

> 以下命令示例使用 `pnpm`，切换为 `npm`/`yarn`/`bun` 时语法相同。

## 1. 安装依赖

在项目根目录执行：

```sh
pnpm add -D weapp-vite vite typescript @types/node sass
```

如果你计划使用 Tailwind、Less、Vue Runtime 等，可以一并安装，但这里保持最小化。

> [!IMPORTANT]
> 如果项目会同时使用 `weapp-vite` 与 `wevu`（例如启用 Vue SFC），请保持两者版本号一致，避免编译期与运行期组合不一致导致的问题。推荐写法如下：
>
> ```sh
> pnpm add -D weapp-vite@x.y.z wevu@x.y.z
> ```

## 2. 初始化必需文件

### package.json

确认 `package.json` 中存在以下脚本（没有就添加）：

```json
{
  "scripts": {
    "dev": "weapp-vite dev",
    "build": "weapp-vite build",
    "open": "weapp-vite open",
    "analyze": "weapp-vite analyze"
  }
}
```

后续运行时只需执行 `pnpm run dev` / `pnpm run build` 等常规命令。

### tsconfig

如果项目还没有 TS 配置，创建 `tsconfig.json` 与 `tsconfig.node.json`：

```json
// tsconfig.json
{
  "extends": "@tsconfig/recommended/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowJs": true,
    "types": ["miniprogram-api-typings"]
  },
  "include": ["src/**/*", "typed-router.d.ts", "typed-components.d.ts"]
}
```

```json
// tsconfig.node.json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node"
  },
  "include": ["vite.config.ts"]
}
```

### vite.config.ts

在项目根目录创建 `vite.config.ts`：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src', // 若原项目位于 miniprogram，可改为 './miniprogram'
    autoRoutes: true,
    chunks: {
      sharedStrategy: 'duplicate',
    },
  },
})
```

`srcRoot` 指向你存放 `app.*`、`pages/` 的目录；如果想继续在根目录开发，可以把 `srcRoot` 改成 `'.'`。

### 项目配置

确保 `project.config.json` 中的 `miniprogramRoot` 指向打包目录（默认 `dist`）：

```json
{
  "miniprogramRoot": "dist/",
  "compileType": "miniprogram",
  "appid": "tour-app-id",
  "setting": {
    "es6": true,
    "minified": true
  }
}
```

## 3. 调整目录

1. 新建 `src/`（或 `srcRoot` 对应目录），并把原项目的 `app.*`、`pages/`、`packages/` 等文件全部移动到该目录。
2. 如果存在 `sitemap.json`、`theme.json` 等静态文件，可放在 `src/` 或 `public/`，`weapp-vite` 都会自动处理。
3. 若项目包含分包，把每个分包放在 `src/packages/<name>/`，再在 `app.json` 中保持原本定义即可。

建议同步创建以下结构（可参考 [目录结构](/guide/directory-structure)）：

```text
src/
├─ app.ts / app.json / app.scss
├─ pages/
├─ packages/
├─ components/
├─ config/
└─ utils/
```

## 4. 验证运行

1. 在命令行执行 `pnpm run dev`，等待 `dist/` 生成。
2. 打开微信开发者工具，导入当前项目，勾选「服务端口」后可选用 `pnpm run dev -- --open` 自动唤起 IDE。
3. 构建上传使用 `pnpm run build`，需要分析分包时执行 `pnpm run analyze`。

## 5. 可选增强

- **自动导入组件**：默认扫描 `components/**` 与各分包 `components/**`；如需扩展，配置 [`weapp.autoImportComponents`](/guide/auto-import)。
- **自动路由**：在 `vite.config.ts` 中开启 `weapp.autoRoutes: true` 后，会生成路由清单与类型；如需同步到 `app.json`，请改用 `app.json.ts` 读取 `weapp-vite/auto-routes`。
- **脚手架生成**：可在 `package.json` 中增加 `"g": "weapp-vite generate"`，之后执行 `pnpm run g pages/dashboard` 快速生成页面文件夹。

这样就完成了在现有小程序中的手动集成，无需依赖 `create` 或 `init` 脚本。
