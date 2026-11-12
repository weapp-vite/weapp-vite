import type { NormalizedOutputOptions, OutputOptions, RenderedChunk, RolldownPluginOption } from 'rolldown'
import { applyOutputChunkTransform, resolveOutputChunkTransformCode, syncOutputChunkSourceMapAssets } from '../../utils/outputChunk'
import { normalizeEncodedSourceMapLike } from '../../utils/sourcemap'

interface SwcTransformResult {
  code: string
  map?: string | object
}

interface SwcTransformOptions {
  filename?: string
  minify?: boolean
  sourceMaps?: boolean | 'inline'
  module?: {
    type: string
  }
  jsc: {
    preserveAllComments?: boolean
    parser: {
      syntax: string
      jsx?: boolean
      dynamicImport?: boolean
    }
    target: string
  }
}

interface SwcTransformModule {
  transform: (code: string, options: SwcTransformOptions) => Promise<SwcTransformResult>
}

type SwcModuleImporter = () => Promise<unknown>

function importSwcCore() {
  return import('@swc/core') as Promise<unknown>
}

export async function loadSwcTransformModule(importer: SwcModuleImporter = importSwcCore): Promise<SwcTransformModule> {
  try {
    const module = await importer() as SwcTransformModule
    if (typeof module.transform !== 'function') {
      throw new TypeError('`@swc/core` 模块缺少 `transform` 方法。')
    }
    return module
  }
  catch (error) {
    const hint = new Error('启用了已废弃的 `weapp.es5`，但项目中未安装 `@swc/core`。请优先迁移到 `build.target >= es2020`，并在开发者工具中开启“将 JS 编译成 ES5”功能；如需临时兼容，再执行 `pnpm add -D @swc/core`。')
    ;(hint as any).cause = error
    throw hint
  }
}

type SwcOutputOptions = Pick<OutputOptions, 'minify' | 'sourcemap'>

function resolveCompactOutput(minify: OutputOptions['minify']) {
  if (!minify || minify === 'dce-only') {
    return false
  }
  if (typeof minify === 'object') {
    return minify.codegen !== false
      && (typeof minify.codegen !== 'object' || minify.codegen.removeWhitespace !== false)
  }
  return true
}

function resolveSourceMapOption(outputOptions: SwcOutputOptions) {
  const sourcemap = outputOptions.sourcemap
  if (sourcemap === false || sourcemap === undefined) {
    return false as const
  }
  if (sourcemap === 'inline') {
    return 'inline' as const
  }
  return true as const
}

export async function transformWithSwc(
  code: string,
  chunk: RenderedChunk,
  outputOptions: SwcOutputOptions,
  importer?: SwcModuleImporter,
) {
  const swc = await loadSwcTransformModule(importer)
  const result = await swc.transform(code, {
    filename: chunk.fileName,
    // 只控制本轮打印的紧凑程度；压缩与变量重命名仍由原生 bundler 负责。
    minify: resolveCompactOutput(outputOptions.minify),
    sourceMaps: resolveSourceMapOption(outputOptions),
    module: {
      type: 'commonjs',
    },
    jsc: {
      preserveAllComments: true,
      parser: {
        syntax: 'ecmascript',
        jsx: true,
        dynamicImport: true,
      },
      target: 'es5',
    },
  })

  const map = result.map
    ? (typeof result.map === 'string' ? JSON.parse(result.map) : result.map)
    : null

  return {
    code: result.code,
    map,
  }
}

export function createLegacyEs5Plugin(): RolldownPluginOption<any> {
  const outputMinification = new WeakMap<NormalizedOutputOptions, boolean>()
  return {
    name: 'weapp-runtime:swc-es5-transform',
    outputOptions: {
      order: 'post',
      handler(options) {
        // 规范化选项会省略 codegen；用每个 output 独立的 hook 传递原始打印策略。
        const compact = resolveCompactOutput(options.minify)
        return {
          ...options,
          plugins: [options.plugins, {
            name: 'weapp-runtime:swc-es5-output-options',
            renderStart(normalizedOptions) {
              outputMinification.set(normalizedOptions, compact)
            },
          }],
        }
      },
    },
    generateBundle: {
      order: 'post',
      async handler(outputOptions, bundle) {
        const minify = outputMinification.get(outputOptions) ?? resolveCompactOutput(outputOptions.minify)
        outputMinification.delete(outputOptions)
        // 最终注入和 JS asset 同样属于降级范围；只转换最终代码，避免重复执行 SWC。
        for (const output of Object.values(bundle)) {
          if (output.type === 'chunk') {
            const code = resolveOutputChunkTransformCode(output)
            if (!code) {
              continue
            }
            const result = await transformWithSwc(code, output, { minify, sourcemap: Boolean(output.map) || outputOptions.sourcemap })
            applyOutputChunkTransform(output, result.code, normalizeEncodedSourceMapLike(result.map))
          }
          else if (output.fileName.endsWith('.js')) {
            const code = typeof output.source === 'string' ? output.source : new TextDecoder().decode(output.source)
            if (!code) {
              continue
            }
            const result = await transformWithSwc(code, { fileName: output.fileName } as RenderedChunk, { minify, sourcemap: false })
            output.source = result.code
          }
        }
        syncOutputChunkSourceMapAssets(bundle)
      },
    },
  }
}
