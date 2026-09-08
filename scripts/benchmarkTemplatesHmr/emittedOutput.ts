import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { setTimeout } from 'node:timers/promises'
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'

const traverse = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule

/** 仅沿入口实际引用的本地脚本读取，包含入口引用的 stateful HMR 载荷。 */
export function createEmittedScriptReader(entryFile: string, outputRoot: string) {
  const root = path.resolve(outputRoot)
  const importCache = new Map<string, { source: string, imports: string[] }>()

  const label = (filename: string) => path.relative(root, filename).replaceAll('\\', '/')
  const assertWithinOutput = (filename: string) => {
    const relative = path.relative(root, filename)
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('Emitted script import escapes the output root')
    }
  }

  async function readScript(filename: string) {
    assertWithinOutput(filename)
    const candidates = path.extname(filename) ? [filename] : [filename, `${filename}.js`, path.join(filename, 'index.js')]
    for (const candidate of candidates) {
      try {
        return { filename: candidate, source: await readFile(candidate, 'utf8') }
      }
      catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== 'ENOENT' && code !== 'EISDIR') {
          throw new Error(`Cannot read emitted script ${label(candidate)}: ${code ?? 'unknown'}`)
        }
      }
    }
    throw new Error(`Missing emitted script: ${label(filename)}`)
  }

  function collectImports(filename: string, source: string) {
    const cached = importCache.get(filename)
    if (cached?.source === source) {
      return cached.imports
    }
    const imports: string[] = []
    let ast: ReturnType<typeof parse>
    try {
      ast = parse(source, { sourceType: 'unambiguous', sourceFilename: label(filename) })
    }
    catch (error) {
      throw new Error(`Cannot parse emitted script ${label(filename)}: ${error instanceof Error ? error.message : 'unknown syntax error'}`)
    }
    traverse(ast, {
      CallExpression(nodePath) {
        const { callee, arguments: args } = nodePath.node
        if (callee.type === 'Identifier' && callee.name === 'require' && !nodePath.scope.hasBinding('require') && args[0]?.type === 'StringLiteral') {
          imports.push(args[0].value)
        }
      },
      ImportDeclaration(nodePath) {
        imports.push(nodePath.node.source.value)
      },
      ExportNamedDeclaration(nodePath) {
        if (nodePath.node.source) {
          imports.push(nodePath.node.source.value)
        }
      },
      ExportAllDeclaration(nodePath) {
        imports.push(nodePath.node.source.value)
      },
    })
    importCache.set(filename, { source, imports })
    return imports
  }

  return async () => {
    const visited = new Set<string>()
    const sources: string[] = []
    async function visit(filename: string): Promise<void> {
      const resolved = await readScript(filename)
      if (visited.has(resolved.filename)) {
        return
      }
      visited.add(resolved.filename)
      sources.push(resolved.source)
      for (const target of collectImports(resolved.filename, resolved.source)) {
        if (target.startsWith('./') || target.startsWith('../') || target.startsWith('/')) {
          await visit(target.startsWith('/')
            ? path.resolve(root, `.${target}`)
            : path.resolve(path.dirname(resolved.filename), target))
        }
      }
    }
    await visit(path.resolve(entryFile))
    return sources.join('\n')
  }
}

/** 编辑和恢复都要求完整可达产物满足条件，查询失败不能证明标记消失。 */
export async function waitForBenchmarkOutput(
  read: () => Promise<string>,
  marker: string,
  options: { absent?: boolean, timeoutMs: number, intervalMs?: number },
) {
  const startedAt = performance.now()
  let latestError = ''
  while (performance.now() - startedAt < options.timeoutMs) {
    try {
      const content = await read()
      latestError = ''
      if (content.includes(marker) !== Boolean(options.absent) && performance.now() - startedAt < options.timeoutMs) {
        return content
      }
    }
    catch (error) {
      latestError = error instanceof Error ? error.message : String(error)
    }
    await setTimeout(options.intervalMs ?? 25)
  }
  throw new Error(`Timed out waiting for reachable emitted output to ${options.absent ? 'omit' : 'contain'} marker: ${marker}${latestError ? `. ${latestError}` : ''}`)
}
