import { access, readFile } from 'node:fs/promises'
import { stripVTControlCharacters } from 'node:util'
import path from 'pathe'
import ts from 'typescript'

export interface BenchmarkTypeScriptProject {
  root: string
  supportFiles: string[]
}

/** 与被测 dev 命令采用相同平台，兼容必须显式选择平台的配置。 */
export function createBenchmarkPrepareArgs(projectRoot: string): string[] {
  return ['packages/weapp-vite/bin/weapp-vite.js', 'prepare', projectRoot, '--platform', 'weapp']
}

/** CLI 的准备失败会以警告形式正常退出，必须检查真实完成标记。 */
export function assertBenchmarkPrepareCompleted(projectRoot: string, result: { exitCode: number | undefined, output: string }): void {
  const output = stripVTControlCharacters(result.output)
  if (result.exitCode !== 0 || /\[prepare\]\s*(?:跳过|skipped\b)/i.test(output) || !output.includes('已生成 .weapp-vite 支持文件。')) {
    throw new Error(`TypeScript preparation did not complete: ${projectRoot}`)
  }
}

/** 沿根配置的引用闭包寻找应由正常 prepare 命令生成的支持文件。 */
export async function discoverBenchmarkTypeScriptProjects(checkoutRoot: string): Promise<BenchmarkTypeScriptProject[]> {
  const pending = [path.resolve(checkoutRoot, 'tsconfig.json')]
  const visited = new Set<string>()
  const projects = new Map<string, Set<string>>()
  while (pending.length > 0) {
    const configFile = pending.pop()!
    if (visited.has(configFile)) {
      continue
    }
    visited.add(configFile)
    const relative = path.relative(checkoutRoot, configFile)
    if (relative.startsWith('../') || path.isAbsolute(relative)) {
      throw new Error(`TypeScript reference leaves benchmark checkout: ${relative}`)
    }
    const segments = relative.split('/')
    const managedIndex = segments.indexOf('.weapp-vite')
    if (managedIndex >= 0) {
      const projectRoot = segments.slice(0, managedIndex).join('/') || '.'
      const files = projects.get(projectRoot) ?? new Set<string>()
      files.add(relative)
      projects.set(projectRoot, files)
      continue
    }
    const parsed = ts.parseConfigFileTextToJson(relative, await readFile(configFile, 'utf8'))
    if (parsed.error) {
      throw new Error(`Cannot read TypeScript configuration ${relative}: ${ts.flattenDiagnosticMessageText(parsed.error.messageText, '\n')}`)
    }
    const config: unknown = parsed.config
    if (!config || typeof config !== 'object') {
      throw new Error(`Invalid TypeScript configuration: ${relative}`)
    }
    const directory = path.dirname(configFile)
    if ('references' in config) {
      if (!Array.isArray(config.references)) {
        throw new TypeError(`Invalid TypeScript references in ${relative}`)
      }
      for (const reference of config.references as unknown[]) {
        if (!reference || typeof reference !== 'object' || !('path' in reference) || typeof reference.path !== 'string') {
          throw new Error(`Invalid TypeScript reference in ${relative}`)
        }
        const target = path.resolve(directory, reference.path)
        pending.push(target.endsWith('.json') ? target : path.join(target, 'tsconfig.json'))
      }
    }
    if ('extends' in config) {
      const bases: unknown[] = Array.isArray(config.extends) ? config.extends : [config.extends]
      for (const base of bases) {
        if (typeof base !== 'string') {
          throw new TypeError(`Invalid TypeScript extends in ${relative}`)
        }
        if (base.startsWith('.') || path.isAbsolute(base)) {
          const target = path.resolve(directory, base)
          pending.push(target.endsWith('.json') ? target : `${target}.json`)
        }
      }
    }
  }
  return [...projects].sort(([left], [right]) => left.localeCompare(right)).map(([root, files]) => ({ root, supportFiles: [...files].sort() }))
}

/** prepare 会把错误记录为警告，因此计时前还需核对引用文件已真实生成。 */
export async function assertBenchmarkTypeScriptPrepared(checkoutRoot: string, projects: BenchmarkTypeScriptProject[]): Promise<void> {
  for (const project of projects) {
    for (const file of project.supportFiles) {
      try {
        await access(path.resolve(checkoutRoot, file))
      }
      catch {
        throw new Error(`TypeScript support file missing after prepare: ${file}`)
      }
    }
  }
}
