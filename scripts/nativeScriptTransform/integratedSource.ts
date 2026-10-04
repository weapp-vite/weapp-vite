export const integratedGlobalKey = '__weappViteExperimentalIntegratedScriptTransform'
const access = `globalThis.${integratedGlobalKey}`

function replaceOnce(source: string, anchor: string, replacement: string) {
  if (source.split(anchor).length !== 2) {
    throw new Error(`Integrated transformScript anchor changed: ${anchor}`)
  }
  return source.replace(anchor, replacement)
}

/** 在真实完整阶段内选择 native 或原闭包；不读取、消费或替换原 AST token。 */
export function instrumentIntegratedTransform(source: string) {
  const entry = 'return measureCompilerStage(\'transformScript\', () => transformScriptInternal(source, options))'
  source = replaceOnce(source, entry, `return measureCompilerStage('transformScript', () => ${access}.invoke(source, options, () => transformScriptInternal(source, options), { generate, isExpression: value => t.isExpression(value) }, () => resolveWarnHandler(options?.warn)))`)
  return replaceOnce(source, 'const warn = resolveWarnHandler(options?.warn)', `const warn = ${access}.warningHandler(resolveWarnHandler(options?.warn))`)
}
