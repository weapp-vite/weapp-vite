---
outline: [2, 3]
---

# 组件库构建（lib 模式）

`weapp-vite` 的 **lib 模式** 用于打包小程序组件库或业务模块。它和应用模式的最大区别是：

- 只构建你声明的入口（组件/模块），不会生成 `app.json` 与页面路由。
- 输出目录默认保持源码相对路径，方便复用现有结构。
- 可以自动补全组件 JSON，适合批量产出可直接引用的组件库产物。

## 适用场景

- 组件库/模块库（希望被多个小程序复用）
- 多个业务包共享的 UI 或逻辑模块
- 希望把源码路径直接映射到产物路径的输出方式

## 快速开始（官方模板）

1. 生成项目（选择 **组件库模板 (lib 模式)**）：

```sh
pnpm create weapp-vite
```

2. 安装依赖：

```sh
pnpm i
```

3. 本地调试组件（会自动打开微信开发者工具）：

```sh
pnpm dev
```

4. 输出组件库产物：

```sh
pnpm build:lib
```

> [!TIP]
> 模板会提供 `vite.config.ts`（用于本地调试）与 `weapp-vite.lib.config.ts`（用于库构建）。
> 你可以将应用调试与库构建拆成两个配置文件，互不影响。

## 基础配置

在 `weapp.lib` 中声明入口，即会进入 lib 模式：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    lib: {
      root: 'src',
      outDir: 'dist-lib',
      entry: [
        'components/HelloWorld/HelloWorld.ts',
        'components/sfc-script/index.vue',
        'components/sfc-setup/index.vue',
      ],
      preservePath: true,
      componentJson: 'auto',
    },
  },
})
```

### 核心字段说明

- `entry`：入口配置，支持 `string | string[] | Record<string, string>`。
- `root`：库源码根目录，默认沿用 `weapp.srcRoot`。
- `outDir`：lib 产物输出目录，默认沿用 `build.outDir`。
- `preservePath`：是否保持输出路径与源码路径一致（默认 `true`）。
- `fileName`：自定义 JS 产物路径（不含扩展名）。多入口时必须包含 `[name]`。
- `componentJson`：自动生成组件 JSON 配置（`true | 'auto' | (ctx) => object`）。

### 自定义输出路径

```ts
export default defineConfig({
  weapp: {
    lib: {
      entry: {
        button: 'components/button/index.vue',
        card: 'components/card/index.vue',
      },
      fileName: '[name]/index',
      outDir: 'dist-lib',
    },
  },
})
```

### 自动生成组件 JSON

```ts
export default defineConfig({
  weapp: {
    lib: {
      entry: ['components/button/index.vue'],
      componentJson: ctx => ({
        component: true,
        styleIsolation: 'shared',
        usingComponents: {},
      }),
    },
  },
})
```

`componentJson: 'auto'` 会在入口存在模板/样式但缺少 JSON 时自动生成 `{"component": true}`。

## 产物结构示例

假设入口为 `src/components/button/index.vue`，默认 `preservePath: true`：

```text
dist-lib/
  components/button/index.js
  components/button/index.wxml
  components/button/index.wxss
  components/button/index.json
```

如果入口只是纯 JS/TS 文件，则只会输出 `*.js`。

## 与 `weapp.chunks` 联动

lib 模式同样会应用 `weapp.chunks` 配置。若多个入口复用同一模块：

- `sharedMode: 'common'`（默认）会生成 `common.js`
- `sharedMode: 'path'` 会按源码路径输出共享模块（无 `common.js`）
- `sharedMode: 'inline'` 会直接内联到引用方

详见：[共享 Chunk 策略](/guide/chunks)。

## 常见问题

### 为什么没有 `app.json` 与页面产物？

lib 模式只输出你声明的入口及其依赖，不会生成应用页面与路由。

### 输出路径冲突怎么办？

当多个入口计算出同一路径时会报错。检查：

- 是否开启了 `preservePath` 并使用相同的入口目录
- `fileName` 是否在多入口模式下缺少 `[name]`

### 既要调试又要发组件库怎么办？

推荐使用 **两份配置**：

- `vite.config.ts`：本地调试（`pnpm dev`）
- `weapp-vite.lib.config.ts`：组件库构建（`pnpm build:lib`）

这样不会互相影响，也更容易维护。
