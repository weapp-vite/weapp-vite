# rolldown-require

[English](./README.md) | [中文](./README-cn.md)

[![npm version](https://badgen.net/npm/v/rolldown-require)](https://npm.im/rolldown-require) [![npm downloads](https://badgen.net/npm/dm/rolldown-require)](https://npm.im/rolldown-require) [![jsDocs.io](https://img.shields.io/badge/jsDocs.io-reference-blue)](https://www.jsdocs.io/package/rolldown-require)

## [HomePage](https://github.com/weapp-vite/weapp-vite/tree/main/packages/rolldown-require)

## Use Case

Recently, the [rolldown-vite](https://github.com/vite/rolldown-vite) project needed to load user-provided configuration files. However, simply using `require()` was not sufficient, because the configuration files might not be `CommonJS` modules—they could be in `.mjs` format or even written in `TypeScript`. That’s where the `rolldown-require` package comes in, enabling you to load configuration files of any format.

Previously, [vite](https://vitejs.dev/) introduced the [bundle-require](https://www.npmjs.com/package/bundle-require) solution based on `esbuild`. Meanwhile, `rolldown-require` is an implementation based on [rolldown](https://rolldown.rs/), providing a similar API but with a significantly different implementation.

## How it works

- Bundles your file using `rolldown`, excluding `node_modules` (since bundling those can cause problems)

  - `__filename`, `__dirname`, and `import.meta.url` are replaced with the source file’s value rather than the temporary output file’s value.

- Outputs the file in `esm` format if possible (for `.ts` and `.js` inputs).
- Loads the output file using `import()` when possible.
- Returns the loaded module and its dependencies (imported files).

## Install

```bash
npm i rolldown-require rolldown
```

Note: `rolldown` is a peer dependency.

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

[https://www.jsdocs.io/package/rolldown-require](https://www.jsdocs.io/package/rolldown-require)

## Inspirations

- Thanks to [rolldown](https://rolldown.rs/) for providing an excellent bundling experience.
- Thanks to [rolldown-vite](https://github.com/vite/rolldown-vite) for offering a direct file loading solution.
- Thanks to [bundle-require](https://www.npmjs.com/package/bundle-require) for providing inspiration for the API design and configuration options.

## Contributing

This library is published as part of [weapp-vite](https://github.com/weapp-vite/weapp-vite).

The library is under active development. If you encounter any issues or have suggestions, please feel free to open an issue on [GitHub Issues](https://github.com/weapp-vite/weapp-vite/issues).

## License

MIT © [sonofmagic](https://github.com/sonofmagic)
