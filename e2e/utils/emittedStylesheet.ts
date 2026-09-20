import { readFile } from 'node:fs/promises'
import path from 'node:path'
import postcss from 'postcss'

function importTarget(params: string): string {
  let target = postcss.list.space(params)[0] ?? ''
  if (/^url\(/i.test(target) && target.endsWith(')')) {
    target = target.slice(4, -1).trim()
  }
  if ((target.startsWith('"') && target.endsWith('"')) || (target.startsWith('\'') && target.endsWith('\''))) {
    target = target.slice(1, -1)
  }
  else if (!/^url\(/i.test(params)) {
    throw new Error('Unsupported emitted stylesheet import')
  }
  if (!target || target.includes('\\')) {
    throw new Error('Unsupported empty or escaped emitted stylesheet import')
  }
  return target
}

/** 沿真实本地 @import 图读取样式，缺失的依赖不能作为标记已消失的证据。 */
export async function readEmittedStylesheet(entryFile: string): Promise<string> {
  const rootDirectory = path.dirname(path.resolve(entryFile))
  const visited = new Set<string>()
  const sources: string[] = []
  async function visit(filename: string): Promise<void> {
    const absolute = path.resolve(filename)
    if (visited.has(absolute)) {
      return
    }
    visited.add(absolute)
    const label = path.relative(rootDirectory, absolute).replaceAll('\\', '/')
    let source: string
    try {
      source = await readFile(absolute, 'utf8')
    }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? 'unknown'
      throw new Error(`Cannot read emitted stylesheet ${label}: ${code}`)
    }
    const imports: string[] = []
    try {
      postcss.parse(source).walkAtRules('import', (rule) => {
        imports.push(importTarget(rule.params))
      })
    }
    catch {
      throw new Error(`Cannot parse emitted stylesheet imports: ${label}`)
    }
    sources.push(source)
    for (const target of imports) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) {
        continue
      }
      const localTarget = target.split(/[?#]/, 1)[0]!
      await visit(target.startsWith('/')
        ? path.resolve(rootDirectory, `.${localTarget}`)
        : path.resolve(path.dirname(absolute), localTarget))
    }
  }
  await visit(entryFile)
  return sources.join('\n')
}

/** 等待整个可达样式图满足标记条件，读取失败时保留失败原因并继续等待完整写入。 */
export async function waitForEmittedStylesheet(
  entryFile: string,
  marker: string,
  options: { absent?: boolean, timeoutMs?: number, intervalMs?: number } = {},
): Promise<string> {
  const startedAt = Date.now()
  let latestError = ''
  do {
    try {
      const content = await readEmittedStylesheet(entryFile)
      latestError = ''
      if (content.includes(marker) !== Boolean(options.absent)) {
        return content
      }
    }
    catch (error) {
      latestError = (error as Error).message
    }
    await new Promise(resolve => setTimeout(resolve, options.intervalMs ?? 25))
  } while (Date.now() - startedAt < (options.timeoutMs ?? 90_000))
  throw new Error(`Timed out waiting for stylesheet ${path.basename(entryFile)} to ${options.absent ? 'omit' : 'contain'} marker: ${marker}${latestError ? `. ${latestError}` : ''}`)
}
