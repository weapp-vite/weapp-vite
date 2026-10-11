import type { Compiler, CompilerGenerateRequest, CompilerGenerateResult } from 'weapp-tailwindcss/core'

interface Root {
  id: string
  dependencies: Set<string>
  matches?: (file: string) => boolean
}

/** 普通候选只延迟磁盘生成的失效；CSS 与依赖仍由宿主即时交给 core。 */
export class TailwindContentInvalidation {
  private readonly roots = new Map<number, Root>()
  private readonly preprocessing = new Map<number, Set<string>>()
  private readonly pending = new Set<string>()

  constructor(private readonly host: {
    sourceId: (file: string) => string
    readSource: (file: string) => string | null | undefined
  }) {}

  rememberRoot(index: number, request: CompilerGenerateRequest, result: CompilerGenerateResult, matches?: Root['matches']) {
    const inputs = request.sourceOptions
    this.roots.set(index, {
      id: request.id,
      matches: inputs ? matches : undefined,
      dependencies: new Set([
        ...result.dependencies,
        ...inputs?.cssEntries ?? [],
        ...inputs?.cssSources?.flatMap(source => [...source.file ? [source.file] : [], ...source.dependencies ?? []]) ?? [],
      ].map(this.host.sourceId)),
    })
  }

  rememberDependencies(index: number, files: readonly string[]) {
    this.preprocessing.set(index, new Set(files.map(this.host.sourceId)))
  }

  observeDependencies(index: number, dependencies: readonly string[]) {
    const root = this.roots.get(index)
    for (const file of dependencies) {
      root?.dependencies.add(this.host.sourceId(file))
    }
  }

  defer(file: string): boolean {
    const id = this.host.sourceId(file)
    if (!this.roots.size || this.host.readSource(id) === undefined
      || [...this.preprocessing.values()].some(dependencies => dependencies.has(id))
      || [...this.roots.values()].some(root => !root.matches || root.dependencies.has(id))) {
      return false
    }
    const roots = [...this.roots.values()].filter(root => root.matches?.(id))
    if (!roots.length) {
      return false
    }
    for (const root of roots) {
      this.pending.add(root.id)
    }
    return true
  }

  generateDisk(compiler: Compiler, request: CompilerGenerateRequest): Promise<CompilerGenerateResult> {
    if (this.pending.size) {
      // 同一同步段失效并提交生成，不能让新的保存插入二者之间。
      compiler.invalidate([...this.pending])
      this.pending.clear()
    }
    return compiler.generate(request)
  }

  removeRoot(index: number) {
    const root = this.roots.get(index)
    if (root) {
      this.pending.delete(root.id)
    }
    this.roots.delete(index)
    this.preprocessing.delete(index)
  }

  clear() {
    this.pending.clear()
    this.roots.clear()
    this.preprocessing.clear()
  }
}
