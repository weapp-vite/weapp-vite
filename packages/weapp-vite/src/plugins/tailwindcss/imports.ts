import type { PluginContext } from 'rolldown'
import fs from 'node:fs/promises'
import path from 'node:path'
import postcss from 'postcss'
import valueParser from 'postcss-value-parser'
import { normalizeManagedTailwindcssEntryPath } from '../tailwindcssMarker'
import { getCssRealPath, parseRequest } from '../utils/parse'

/** 只判断样式导入链的所有权；解析、条件包装与转换仍由 Tailwind 编译器负责。 */
export async function findManagedStyleImports(
  code: string,
  filename: string,
  options: { resolve: PluginContext['resolve'], isManaged: (file: string) => boolean },
) {
  const dependencies = new Set<string>()
  let managed = false
  const visit = async (source: string, importer: string) => {
    if (!source.includes('@import')) {
      return
    }
    const requests: string[] = []
    postcss.parse(source, { from: importer }).walkAtRules('import', (rule) => {
      const node = valueParser(rule.params).nodes[0]
      const value = node?.type === 'string' ? node.value : node?.type === 'function' && node.value === 'url' ? node.nodes[0]?.value : undefined
      if (value && !/^(?:[a-z]+:|\/\/|#)/i.test(value)) {
        requests.push(value)
      }
    })
    for (const request of requests) {
      const resolved = await options.resolve(request, importer, { skipSelf: true })
      if (!resolved || resolved.external) {
        continue
      }
      const sourcePath = getCssRealPath(parseRequest(resolved.id))
      const file = normalizeManagedTailwindcssEntryPath(path.resolve(path.dirname(importer), sourcePath))
      if (dependencies.has(file)) {
        continue
      }
      dependencies.add(file)
      if (options.isManaged(file)) {
        managed = true
      }
      else {
        await visit(await fs.readFile(file, 'utf8'), file)
      }
    }
  }
  await visit(code, filename)
  return { managed, dependencies }
}
