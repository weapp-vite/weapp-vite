# rolldown-require 使用指南

> 语言： [English](/packages/rolldown-require/) | 中文

`rolldown-require` 是基于 `rolldown` 的「打包再加载」工具，帮助 CLI 或 Node 脚本安全地执行任意格式的配置文件（`ts` / `mjs` / `cjs` / JSX 等）。API 与 `bundle-require` 保持相似，却复用了 `rolldown` 的解析与插件生态，更贴近 `rolldown-vite` 的运行时行为。

## 它解决什么问题

- **跨格式加载**：自动判定入口模块类型，支持 ESM/CJS/TypeScript 等多种后缀。
- **一致的解析策略**：沿用 Vite/rolldown 的解析与外部化逻辑（含 `module-sync` 条件），避免 `require`/`import` 行为不一致。
- **源码上下文保持**：在打包后恢复 `__dirname`、`__filename`、`import.meta.url`，让临时产物与源文件路径一致。
- **依赖可观察**：返回打包时命中的依赖列表，可直接用于文件监听或缓存校验。
- **可选缓存**：内置持久化 + 进程内缓存，重复加载配置时可显著缩短启动时间。

## 安装

```sh
pnpm add rolldown-require rolldown -D
# 或 npm / yarn / bun 等等
```

> `rolldown` 是 peer 依赖，需要一同安装。

## 快速开始

```ts
import { bundleRequire } from 'rolldown-require'

const { mod, dependencies } = await bundleRequire({
  filepath: './vite.config.ts',
  cache: true, // 可选：启用缓存，重复执行更快
})

// mod 即为被加载的模块（默认导出会被解包）
// dependencies 可用于 watcher，决定何时重新 bundle
```

`bundleRequire` 会：

1. 基于入口路径推断 ESM/CJS 格式，并支持通过 `format` 手动覆盖。
2. 使用 `rolldown` 打包入口文件，排除大多数 `node_modules` 依赖，保持解析结果与 `rolldown-vite` 一致。
3. 写入临时产物后执行（ESM 用 `import()`，CJS 用 `require`），最终返回模块与依赖列表。

## 和 bundle-require 的区别

- 换用 `rolldown` 作为打包引擎，更贴合 rolldown 生态，也能利用它的条件导出、模块同步标记等能力。
- 内置文件作用域变量注入，避免因为临时产物路径改变而让 `__dirname`/`__filename` 失真。
- 支持可选的持久化/内存缓存，冷启动和多次加载都能复用同一份 bundle。

## 下一步

- 查阅 [API 与选项说明](/packages/rolldown-require/options.zh) 理解各配置项的默认值与适用场景。
- 参考 [加载流程与缓存策略](/packages/rolldown-require/cache.zh) 了解外部化、临时文件与调试技巧。
