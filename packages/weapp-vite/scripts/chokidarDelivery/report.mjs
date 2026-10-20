import assert from 'node:assert/strict'
import path from 'node:path'

export const invocation = 'node --import tsx e2e/scripts/run-e2e-commands.ts node --import tsx packages/weapp-vite/scripts/chokidarDelivery/index.mjs --report .tmp/chokidar-delivery.json'

export function parseArguments(args) {
  const result = {}
  const names = new Map([['--report', 'reportFile'], ['--tarballs', 'tarballs'], ['--baseline-tarballs', 'baselineTarballs']])
  for (let index = 0; index < args.length; index += 2) {
    const name = names.get(args[index])
    assert(name && args[index + 1] && !args[index + 1].startsWith('--'), `Usage: ${invocation} [--tarballs directory] [--baseline-tarballs directory]`)
    assert.equal(result[name], undefined, `Duplicate argument: ${args[index]}`)
    result[name] = path.resolve(args[index + 1])
  }
  assert(result.reportFile, `A report path is required: ${invocation}`)
  return result
}

/** 报告保留完整诊断，但路径统一为逻辑根，避免发布机器私有目录。 */
export function normalizeReport(value, roots) {
  if (typeof value === 'string') {
    const replacements = roots.flatMap(([source, replacement]) => [[source, replacement], [source.replaceAll('\\', '/'), replacement]])
      .sort((left, right) => right[0].length - left[0].length)
    for (const [source, replacement] of replacements) {
      value = value.replaceAll(source, replacement)
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map(item => normalizeReport(item, roots))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeReport(item, roots)]))
  }
  return value
}
