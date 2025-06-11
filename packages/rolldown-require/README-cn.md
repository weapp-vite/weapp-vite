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

```bash
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

## License

MIT &copy; [sonofmagic](https://github.com/sonofmagic)
