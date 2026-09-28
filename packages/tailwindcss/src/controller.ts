import type { HmrCompilerPreparation, HmrSourceMap } from '@weapp-vite/hmr'
import type { Compiler, CompilerSnapshot, CreateCompilerOptions } from 'weapp-tailwindcss/core'
import { normalizeHmrSourceMap } from '@weapp-vite/hmr'

export interface TailwindControllerOptions {
  compiler?: CreateCompilerOptions
  loadCore?: () => Promise<Pick<typeof import('weapp-tailwindcss/core'), 'createCompiler'>>
}

/** 编译器按宿主生命周期惰性创建；不创建 Vite、DevEngine、watcher 或输出写入者。 */
export class TailwindController {
  private instance?: Promise<Compiler>
  private closed = false
  private disposal?: Promise<void>

  constructor(private readonly options: TailwindControllerOptions = {}) {}

  getCompiler(): Promise<Compiler> {
    if (this.closed) {
      return Promise.reject(new Error('Tailwind controller is disposed'))
    }
    this.instance ??= (this.options.loadCore?.() ?? import('weapp-tailwindcss/core'))
      .then(core => core.createCompiler(this.options.compiler))
    return this.instance
  }

  /** 空控制器的失效不启动 Tailwind；实际编译根由 core 统一失效。 */
  async invalidate(files: Iterable<string>): Promise<readonly string[]> {
    return this.instance ? (await this.instance).invalidate(files) : []
  }

  async remove(id: string): Promise<void> {
    if (this.instance) {
      await (await this.instance).remove(id)
    }
  }

  dispose(): Promise<void> {
    this.closed = true
    this.disposal ??= this.instance?.then(compiler => compiler.dispose()) ?? Promise.resolve()
    return this.disposal
  }
}

export function createTailwindController(options: TailwindControllerOptions = {}): TailwindController {
  return new TailwindController(options)
}

function labelMap(value: unknown, fileName: string, code: string): HmrSourceMap | null {
  const map = normalizeHmrSourceMap(value)
  if (!map?.sources.includes('')) {
    return map
  }
  return {
    ...map,
    sources: map.sources.map(source => source || fileName),
    sourcesContent: map.sources.map((source, index) => map.sourcesContent?.[index] ?? (source === '' ? code : null)),
  }
}

/** 同一份 core 快照用于所有转换；宿主提供最终资产，公共层不推断框架输出归属。 */
export function createTailwindPreparation(
  compiler: Compiler,
  snapshot: CompilerSnapshot,
  assets: NonNullable<HmrCompilerPreparation['assets']> = [],
): HmrCompilerPreparation {
  return {
    assets,
    dependencies: snapshot.dependencies,
    transformTemplate: async ({ code, fileName }) => ({ code: await compiler.transformTemplate(code, snapshot, { filename: fileName }) }),
    transformJavaScript: async ({ code, fileName }) => {
      const result = await compiler.transformJavaScript(code, snapshot, { filename: fileName, generateMap: true })
      if (result.error) {
        throw result.error
      }
      return { code: result.code, map: labelMap(result.map, fileName, code) }
    },
  }
}
