import type { NormalizedOutputOptions, RenderedChunk, RolldownPluginOption } from 'rolldown'

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

async function loadSwcTransformModule(): Promise<SwcTransformModule> {
  try {
    const module = await import('@swc/core') as SwcTransformModule
    if (typeof module.transform !== 'function') {
      throw new TypeError('`@swc/core` 模块缺少 `transform` 方法。')
    }
    return module
  }
  catch (error) {
    const hint = new Error('启用了 `weapp.es5`，但项目中未安装 `@swc/core`。请执行 `pnpm add -D @swc/core` 后重试。')
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

export async function transformWithSwc(code: string, chunk: RenderedChunk, outputOptions: NormalizedOutputOptions) {
  const swc = await loadSwcTransformModule()
  const result = await swc.transform(code, {
    filename: chunk.fileName,
    sourceMaps: resolveSourceMapOption(outputOptions),
    module: {
      type: 'commonjs',
    },
    jsc: {
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
    async renderChunk(code, chunk, outputOptions) {
      if (!code) {
        return null
      }
      return await transformWithSwc(code, chunk, outputOptions)
    },
  }
}
