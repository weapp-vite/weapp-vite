# rolldown-require

[English](./README.md) | [中文](./README-cn.md)

[![npm version](https://badgen.net/npm/v/rolldown-require)](https://npm.im/rolldown-require) [![npm downloads](https://badgen.net/npm/dm/rolldown-require)](https://npm.im/rolldown-require) [![jsDocs.io](https://img.shields.io/badge/jsDocs.io-reference-blue)](https://www.jsdocs.io/package/rolldown-require)

## [主页](https://github.com/weapp-vite/weapp-vite/tree/main/packages/rolldown-require)

## 编写目的

最近 [rolldown-vite](https://github.com/vite/rolldown-vite) 项目需要加载用户提供的配置文件，但仅使用 `require()` 无法满足需求，因为配置文件不一定是 `CommonJS` 模块，它可能是 `.mjs` 格式，甚至可能是 `TypeScript` 编写的。这就是 `rolldown-require` 包的用武之地，它可以加载任何格式的配置文件。

之前的 `vite` 中已经诞生了基于 `esbuild` 的 [bundle-require](https://www.npmjs.com/package/bundle-require)，而 `rolldown-require` 则是基于 [rolldown](https://rolldown.rs/) 的实现，提供了相似的API，但是实现有极大的不同。

## How it works

- Bundle your file with `rolldown`, `node_modules` are excluded because it's problematic to try to bundle it
  - `__filename`, `__dirname` and `import.meta.url` are replaced with source file's value instead of the one from the temporary output file
- Output file in `esm` format if possible (for `.ts`, `.js` input files)
- Load output file with `import()` if possible
- Return the loaded module and its dependencies (imported files)

## 安装

```sh
npm i rolldown-require rolldown
```

`rolldown` is a peer dependency.

## Usage

```ts
import { bundleRequire } from 'rolldown-require'

const { mod } = await bundleRequire({
  filepath: './project/vite.config.ts',
})
```

## Options

```ts
import type { ExternalOption, InputOptions, OutputOptions } from 'rolldown'

export type RequireFunction = (
  outfile: string,
  ctx: { format: 'cjs' | 'esm' },
) => any

export type GetOutputFile = (filepath: string, format: 'esm' | 'cjs') => string

export interface Options {
  cwd?: string
  /**
   * The filepath to bundle and require
   */
  filepath: string
  /**
   * The `require` function that is used to load the output file
   * Default to the global `require` function
   * This function can be asynchronous, i.e. returns a Promise
   */
  require?: RequireFunction
  /**
   * esbuild options
   *
   */
  rolldownOptions?: {
    input?: InputOptions
    output?: OutputOptions
  }

  /**
   * Get the path to the output file
   * By default we simply replace the extension with `.bundled_{randomId}.js`
   */
  getOutputFile?: GetOutputFile

  /** External packages */
  external?: ExternalOption

  /**
   * A custom tsconfig path to read `paths` option
   *
   * Set to `false` to disable tsconfig
   */
  tsconfig?: string | false

  /**
   * Preserve compiled temporary file for debugging
   * Default to `process.env.BUNDLE_REQUIRE_PRESERVE`
   */
  preserveTemporaryFile?: boolean

  /**
   * Provide bundle format explicitly
   * to skip the default format inference
   */
  format?: 'cjs' | 'esm'

}
```

## API

https://www.jsdocs.io/package/rolldown-require

## 灵感来源

- 感谢 [rolldown](https://rolldown.rs/) 提供了优秀的打包体验
- 感谢 [rolldown-vite](https://github.com/vite/rolldown-vite) 提供了直接加载文件配置的方案
- 感谢 [bundle-require](https://www.npmjs.com/package/bundle-require) 提供了 API 名称和配置项方面的参考

## 参与贡献

本库是作为 [weapp-vite](https://github.com/weapp-vite/weapp-vite) 的一部分进行发布的

同时本库还在快速的开发中，你遇到什么问题或有任何建议，欢迎在 [GitHub Issues](https://github.com/weapp-vite/weapp-vite/issues) 提出

## 基准数据

本地（M3，Node 22.21.1），`pnpm --filter rolldown-require-bench benchmark`，冷启动 10 次：

```text
场景：tiny-static（25 modules）
rolldown-require  | avg 60.52ms | median 58.36ms | deps 26 | rssΔ 中位 1.02 MB
unrun             | avg 61.16ms | median 61.32ms | deps 26 | rssΔ 中位 0.64 MB

场景：medium-mixed（100 modules，动态每 10 个）
rolldown-require  | avg 49.85ms | median 46.38ms | deps 102 | rssΔ 中位 2.29 MB
unrun             | avg 52.30ms | median 30.49ms | deps 101 | rssΔ 中位 1.44 MB

场景：large-static（200 modules）
rolldown-require  | avg 55.47ms | median 45.89ms | deps 201 | rssΔ 中位 2.86 MB
unrun             | avg 64.54ms | median 50.02ms | deps 201 | rssΔ 中位 1.33 MB
```

说明：

- 用例是 `packages/rolldown-require-bench/benchmark/index.mjs` 生成的合成 TS 模块图（静态与包含动态 import）。
- 每轮都会清理 unrun 的 `.unrun` 缓存以保证冷启动，可用 `BENCH_ITERATIONS` 调整迭代次数。

### 结论

- 在 10 次冷启动平均值下，rolldown-require 在三组场景总体更快（avg/median），unrun 的 RSS 增量略低。
- 依赖数量一致或接近，表明覆盖的模块图相当。
- 数据来自 `packages/rolldown-require-bench/benchmark/index.mjs` 的合成样本（M3/Node 22.21.1）；正式选型请按真实工作负载复验。

### 缓存

- 通过 `cache: true` 或 `{ enabled: true, dir?, reset?, onEvent? }` 开启持久缓存（默认目录优先 `node_modules/.rolldown-require-cache`，否则 OS tmp）。会校验入口与依赖的 mtime/size，过期则重建。

## License

MIT &copy; [sonofmagic](https://github.com/sonofmagic)
