import type {
  BuildFailure,
  BuildOptions,
  BuildResult,
  Plugin as EsbuildPlugin,
  Loader,
  TsconfigRaw,
} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  build,
  context,
} from 'esbuild'
import { getTsconfig } from 'get-tsconfig'
import { dynamicImport, getRandomId, guessFormat } from './utils'

const DIRNAME_VAR_NAME = '__injected_dirname__'
const FILENAME_VAR_NAME = '__injected_filename__'
const IMPORT_META_URL_VAR_NAME = '__injected_import_meta_url__'

export const JS_EXT_RE = /\.([mc]?[tj]s|[tj]sx)$/
const PATH_NODE_MODULES_RE = /[/\\]node_modules[/\\]/

function inferLoader(ext: string): Loader {
  if (ext === '.mjs' || ext === '.cjs') {
    return 'js'
  }
  if (ext === '.mts' || ext === '.cts') {
    return 'ts'
  }
  return ext.slice(1) as Loader
}

export { dynamicImport }

export type RequireFunction = (
  outfile: string,
  ctx: { format: 'cjs' | 'esm' },
) => any

export type GetOutputFile = (filepath: string, format: 'esm' | 'cjs') => string

export type RebuildCallback = (
  error: Pick<BuildFailure, 'errors' | 'warnings'> | null,
  result: BuildResult | null,
) => void

export type ReadFile = (filepath: string) => string

const defaultReadFile = (filepath: string) => fs.readFileSync(filepath, 'utf-8')

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
  esbuildOptions?: BuildOptions & {
    /**
     * @deprecated `esbuildOptions.watch` is deprecated, use `onRebuild` instead
     */
    watch?:
      | boolean
      | {
        onRebuild?: RebuildCallback
      }
  }
  /**
   * Get the path to the output file
   * By default we simply replace the extension with `.bundled_{randomId}.js`
   */
  getOutputFile?: GetOutputFile
  /**
   * Enable watching and call the callback after each rebuild
   */
  onRebuild?: (ctx: {
    err?: Pick<BuildFailure, 'errors' | 'warnings'>
    mod?: any
    dependencies?: string[]
  }) => void

  /** External packages */
  external?: (string | RegExp)[]

  /** Not external packages */
  notExternal?: (string | RegExp)[]

  /**
   * Automatically mark node_modules as external
   * @default true - `false` when `filepath` is in node_modules
   */
  externalNodeModules?: boolean

  /**
   * A custom tsconfig path to read `paths` option
   *
   * Set to `false` to disable tsconfig
   * Or provide a `TsconfigRaw` object
   */
  tsconfig?: string | TsconfigRaw | false

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

  readFile?: ReadFile
}

// Use a random path to avoid import cache
const defaultGetOutputFile: GetOutputFile = (filepath, format) =>
  filepath.replace(
    JS_EXT_RE,
    `.bundled_${getRandomId()}.${format === 'esm' ? 'mjs' : 'cjs'}`,
  )

export { getTsconfig }

export function tsconfigPathsToRegExp(paths: Record<string, any>) {
  return Object.keys(paths || {}).map((key) => {
    return new RegExp(`^${key.replace(/\*/, '.*')}$`)
  })
}

export function match(id: string, patterns?: (string | RegExp)[]) {
  if (!patterns) {
    return false
  }
  return patterns.some((p) => {
    if (p instanceof RegExp) {
      return p.test(id)
    }
    return id === p || id.startsWith(`${p}/`)
  })
}

/**
 * An esbuild plugin to mark node_modules as external
 */
export function externalPlugin({
  external,
  notExternal,
  externalNodeModules = true,
}: {
  external?: (string | RegExp)[]
  notExternal?: (string | RegExp)[]
  externalNodeModules?: boolean
} = {}): EsbuildPlugin {
  return {
    name: 'bundle-require:external',
    setup(ctx) {
      ctx.onResolve({ filter: /.*/ }, async (args) => {
        if (match(args.path, external)) {
          return {
            external: true,
          }
        }

        if (match(args.path, notExternal)) {
          // Should be resolved by esbuild
          return
        }

        if (externalNodeModules && args.path.match(PATH_NODE_MODULES_RE)) {
          const resolved
            = args.path[0] === '.'
              ? path.resolve(args.resolveDir, args.path)
              : args.path
          return {
            path: pathToFileURL(resolved).toString(),
            external: true,
          }
        }

        if (args.path[0] === '.' || path.isAbsolute(args.path)) {
          // Fallback to default
          return
        }

        // Most like importing from node_modules, mark external
        return {
          external: true,
        }
      })
    },
  }
}

export function injectFileScopePlugin({
  readFile = defaultReadFile,
}: { readFile?: ReadFile } = {}): EsbuildPlugin {
  return {
    name: 'bundle-require:inject-file-scope',
    setup(ctx) {
      ctx.initialOptions.define = {
        ...ctx.initialOptions.define,
        '__dirname': DIRNAME_VAR_NAME,
        '__filename': FILENAME_VAR_NAME,
        'import.meta.url': IMPORT_META_URL_VAR_NAME,
      }

      ctx.onLoad({ filter: JS_EXT_RE }, (args) => {
        const contents = readFile(args.path)
        const injectLines = [
          `const ${FILENAME_VAR_NAME} = ${JSON.stringify(args.path)};`,
          `const ${DIRNAME_VAR_NAME} = ${JSON.stringify(
            path.dirname(args.path),
          )};`,
          `const ${IMPORT_META_URL_VAR_NAME} = ${JSON.stringify(
            pathToFileURL(args.path).href,
          )};`,
        ]
        return {
          contents: injectLines.join('') + contents,
          loader: inferLoader(path.extname(args.path)),
        }
      })
    },
  }
}

export function bundleRequire<T = any>(
  options: Options,
): Promise<{
    mod: T
    dependencies: string[]
  }> {
  return new Promise((resolve, reject) => {
    if (!JS_EXT_RE.test(options.filepath)) {
      throw new Error(`${options.filepath} is not a valid JS file`)
    }

    const preserveTemporaryFile
      = options.preserveTemporaryFile ?? !!process.env.BUNDLE_REQUIRE_PRESERVE
    const cwd = options.cwd || process.cwd()
    const format = options.format ?? guessFormat(options.filepath)
    const tsconfig
      = options.tsconfig === false
        ? undefined
        : typeof options.tsconfig === 'string' || !options.tsconfig
          ? getTsconfig(cwd, options.tsconfig)
          : {
              config: options.tsconfig,
              path: undefined,
            }

    const resolvePaths = tsconfigPathsToRegExp(
      tsconfig?.config.compilerOptions?.paths || {},
    )

    const extractResult = async (result: BuildResult) => {
      if (!result.outputFiles) {
        throw new Error(`[bundle-require] no output files`)
      }

      const { text } = result.outputFiles[0]

      const getOutputFile = options.getOutputFile || defaultGetOutputFile
      const outfile = getOutputFile(options.filepath, format)

      await fs.promises.writeFile(outfile, text, 'utf8')

      let mod: any
      const req: RequireFunction = options.require || dynamicImport
      try {
        mod = await req(
          format === 'esm' ? pathToFileURL(outfile).href : outfile,
          { format },
        )
      }
      finally {
        if (!preserveTemporaryFile) {
          // Remove the outfile after executed
          await fs.promises.unlink(outfile)
        }
      }

      return {
        mod,
        dependencies: result.metafile
          ? Object.keys(result.metafile.inputs)
          : [],
      }
    }

    const { watch: watchMode, ...restEsbuildOptions }
      = options.esbuildOptions || {}

    const esbuildOptions = {
      ...restEsbuildOptions,
      entryPoints: [options.filepath],
      absWorkingDir: cwd,
      outfile: 'out.js',
      format,
      platform: 'node',
      sourcemap: 'inline',
      bundle: true,
      metafile: true,
      write: false,
      ...(tsconfig?.path
        ? { tsconfig: tsconfig.path }
        : { tsconfigRaw: tsconfig?.config || {} }),
      plugins: [
        ...(options.esbuildOptions?.plugins || []),
        externalPlugin({
          external: options.external,
          notExternal: [...(options.notExternal || []), ...resolvePaths],
          // When `filepath` is in node_modules, this is default to false
          externalNodeModules:
            options.externalNodeModules
            ?? !options.filepath.match(PATH_NODE_MODULES_RE),
        }),
        injectFileScopePlugin({
          readFile: options.readFile,
        }),
      ],
    } satisfies BuildOptions

    const run = async () => {
      if (!(watchMode || options.onRebuild)) {
        const result = await build(esbuildOptions)
        resolve(await extractResult(result))
      }
      else {
        const rebuildCallback: RebuildCallback
          = typeof watchMode === 'object'
            && typeof watchMode.onRebuild === 'function'
            ? watchMode.onRebuild
            : async (error, result) => {
              if (error) {
                options.onRebuild?.({ err: error })
              }
              if (result) {
                options.onRebuild?.(await extractResult(result))
              }
            }

        const onRebuildPlugin = (): EsbuildPlugin => {
          return {
            name: 'bundle-require:on-rebuild',
            setup(ctx) {
              let count = 0
              ctx.onEnd(async (result) => {
                if (count++ === 0) {
                  if (result.errors.length === 0) {
                    resolve(await extractResult(result))
                  }
                }
                else {
                  if (result.errors.length > 0) {
                    return rebuildCallback(
                      { errors: result.errors, warnings: result.warnings },
                      null,
                    )
                  }
                  if (result) {
                    rebuildCallback(null, result)
                  }
                }
              })
            },
          }
        }

        esbuildOptions.plugins.push(onRebuildPlugin())
        const ctx = await context(esbuildOptions)
        await ctx.watch()
      }
    }

    run().catch(reject)
  })
}
