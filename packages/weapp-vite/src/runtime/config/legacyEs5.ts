import type { NormalizedOutputOptions, RenderedChunk, RolldownPluginOption } from 'rolldown'
import { applyOutputChunkTransform, resolveOutputChunkTransformCode, syncOutputChunkSourceMapAssets } from '../../utils/outputChunk'
import { normalizeEncodedSourceMapLike } from '../../utils/sourcemap'

interface SwcTransformResult {
  code: string
  map?: string | object
}

interface SwcTransformOptions {
  filename?: string
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

function resolveSourceMapOption(outputOptions: NormalizedOutputOptions) {
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
  outputOptions: NormalizedOutputOptions,
  importer?: SwcModuleImporter,
) {
  const swc = await loadSwcTransformModule(importer)
  const result = await swc.transform(code, {
    filename: chunk.fileName,
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
  return {
    name: 'weapp-runtime:swc-es5-transform',
    generateBundle: {
      order: 'post',
      async handler(outputOptions, bundle) {
        // 最终注入和 JS asset 同样属于降级范围；只转换最终代码，避免重复执行 SWC。
        for (const output of Object.values(bundle)) {
          if (output.type === 'chunk') {
            const code = resolveOutputChunkTransformCode(output)
            if (!code) {
              continue
            }
            const result = await transformWithSwc(code, output, { ...outputOptions, sourcemap: Boolean(output.map) || outputOptions.sourcemap })
            applyOutputChunkTransform(output, result.code, normalizeEncodedSourceMapLike(result.map))
          }
          else if (output.fileName.endsWith('.js')) {
            const code = typeof output.source === 'string' ? output.source : new TextDecoder().decode(output.source)
            if (!code) {
              continue
            }
            const result = await transformWithSwc(code, { fileName: output.fileName } as RenderedChunk, { ...outputOptions, sourcemap: false })
            output.source = result.code
          }
        }
        syncOutputChunkSourceMapAssets(bundle)
      },
    },
  }
}
