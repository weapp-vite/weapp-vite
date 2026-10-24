import type { CompilerGenerateRequest, CompilerGenerateResult } from 'weapp-tailwindcss/core'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import postcss from 'postcss'

type Sources = CompilerGenerateResult['sources']
type ResolvedRequest = Extract<CompilerGenerateRequest, { source: unknown }>

interface Plan {
  source: string
  dependencies: string[]
  fingerprint: string
  sources: Sources
  topology: string
}

interface Root {
  revision: number
  pending: number
  latest?: symbol
  preprocessing: string[]
  plan?: Plan
}

/** 仅复用已解析的扫描规则；候选与最终 CSS 始终由当前 core 生成。 */
export class TailwindScanPlanSession {
  private readonly roots = new Map<string, Root>()
  private closed = false

  constructor(private readonly sourceId: (file: string) => string) {}

  private root(id: string): Root {
    let root = this.roots.get(id)
    if (!root) {
      root = { revision: 0, pending: 0, preprocessing: [] }
      this.roots.set(id, root)
    }
    return root
  }

  private dependencies(files: Iterable<string>): string[] {
    return [...new Set([...files].map(this.sourceId))].sort()
  }

  private fingerprint(files: readonly string[]): string {
    const hash = createHash('sha256')
    for (const file of files) {
      hash.update(JSON.stringify(file))
      try {
        const content = readFileSync(file)
        hash.update('present\0')
        hash.update(content)
      }
      catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || !['ENOENT', 'ENOTDIR'].includes(String(error.code))) {
          throw error
        }
        hash.update('missing')
      }
      hash.update('\0')
    }
    return hash.digest('hex')
  }

  private topology(sources: Sources): string | undefined {
    try {
      const paths = new Set(sources.flatMap((source) => {
        const pathApi = /^[a-z]:[\\/]/i.test(source.base) || source.base.startsWith('\\\\') ? path.win32 : path
        return [source.base, pathApi.resolve(source.base, source.pattern)]
      }))
      return JSON.stringify([...paths].map((file) => {
        let directory = false
        try {
          directory = statSync(file).isDirectory()
        }
        catch (error) {
          if (!error || typeof error !== 'object' || !('code' in error) || !['ENOENT', 'ENOTDIR'].includes(String(error.code))) {
            throw error
          }
        }
        return [this.sourceId(file), directory]
      }))
    }
    catch {
      // 无法确认路径类型时交还 core，不能把一次失败固定成长期扫描范围。
      return undefined
    }
  }

  private hasTrackedConfigs(source: ResolvedRequest['source'], dependencies: readonly string[]): boolean {
    const definitions = [{ css: source.css, base: source.base }]
    // core 的普通扫描器也会读取附加 CSS 依赖；其中的配置未必参与实际 CSS 编译。
    for (const file of source.dependencies.slice(1)) {
      try {
        definitions.push({ css: readFileSync(file, 'utf8'), base: path.dirname(file) })
      }
      catch {
        return false
      }
    }
    try {
      for (const { css, base } of definitions) {
        if (!css.includes('@config')) {
          continue
        }
        let tracked = true
        postcss.parse(css).walkAtRules('config', (rule) => {
          const request = /^(['"])(.+)\1$/.exec(rule.params.trim())?.[2]
          if (!request) {
            tracked = false
            return
          }
          const file = createRequire(path.join(base, 'package.json')).resolve(request)
          tracked &&= dependencies.includes(this.sourceId(file))
        })
        if (!tracked) {
          return false
        }
      }
      return true
    }
    catch {
      return false
    }
  }

  rememberDependencies(id: string, files: Iterable<string>) {
    if (this.closed) {
      return
    }
    const root = this.root(id)
    const dependencies = this.dependencies(files)
    if (JSON.stringify(dependencies) !== JSON.stringify(root.preprocessing)) {
      root.preprocessing = dependencies
      root.revision += 1
      root.plan = undefined
    }
  }

  invalidate(file: string) {
    const id = this.sourceId(file)
    for (const root of this.roots.values()) {
      const dependencyChanged = root.preprocessing.includes(id) || root.plan?.dependencies.includes(id)
      // 首次生成尚未返回完整依赖图，期间的任何保存都不能让旧结果登记规则。
      if (dependencyChanged || root.pending) {
        root.revision += 1
      }
      if (dependencyChanged) {
        root.plan = undefined
      }
    }
  }

  async generate(request: ResolvedRequest, generate: (request: CompilerGenerateRequest) => Promise<CompilerGenerateResult>): Promise<CompilerGenerateResult> {
    // core 保留关闭后的错误语义，规则会话只停止复用与登记。
    if (this.closed || request.scanSources !== true || request.scanMode === 'compiled') {
      return generate(request)
    }
    const root = this.root(request.id)
    const source = JSON.stringify(request.source)
    const knownDependencies = this.dependencies([...request.source.dependencies, ...root.preprocessing, ...root.plan?.dependencies ?? []])
    const before = this.fingerprint(knownDependencies)
    const plan = root.plan
    const topology = plan && this.topology(plan.sources)
    const reusable = plan?.source === source && topology !== undefined && plan.topology === topology
      && plan.fingerprint === this.fingerprint(plan.dependencies)
    if (!reusable) {
      root.plan = undefined
    }
    const revision = root.revision
    const generation = root.latest = Symbol('tailwind-scan-plan-generation')
    root.pending += 1
    try {
      const result = await generate(reusable ? { ...request, scanSources: plan.sources.map(source => ({ ...source })) } : request)
      if (!this.closed && this.roots.get(request.id) === root && root.revision === revision && root.latest === generation
        && this.fingerprint(knownDependencies) === before && (!reusable || this.topology(plan.sources) === topology)) {
        const dependencies = this.dependencies([...request.source.dependencies, ...root.preprocessing, ...reusable ? plan.dependencies : [], ...result.dependencies])
        const topology = this.topology(result.sources)
        if (topology !== undefined && (reusable || this.hasTrackedConfigs(request.source, dependencies))) {
          root.plan = { source, dependencies, fingerprint: this.fingerprint(dependencies), sources: result.sources.map(source => ({ ...source })), topology }
        }
      }
      return result
    }
    catch (error) {
      if (root.latest === generation) {
        root.plan = undefined
      }
      throw error
    }
    finally {
      root.pending -= 1
    }
  }

  remove(id: string) {
    this.roots.delete(id)
  }

  close() {
    this.closed = true
    this.roots.clear()
  }
}
