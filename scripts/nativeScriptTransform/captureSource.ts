export const captureGlobalKey = '__weappViteExperimentalTransformScriptCapture'
export const captureTarget = 'packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/index.ts'
const access = `globalThis.${captureGlobalKey}`

function replaceOnce(source: string, anchor: string, replacement: string) {
  if (source.split(anchor).length !== 2) {
    throw new Error(`TransformScript capture anchor changed: ${anchor}`)
  }
  return source.replace(anchor, replacement)
}

/** 只包住已由既有 owner 优化并去类型的真实入口，不改 options 或 AST 所有权。 */
export function instrumentTransformScriptCapture(source: string) {
  const entry = 'return measureCompilerStage(\'transformScript\', () => transformScriptInternal(source, options))'
  source = replaceOnce(source, entry, `return ${access}.invoke(source, options, () => measureCompilerStage('transformScript', () => transformScriptInternal(source, options)), { generate, isExpression: value => t.isExpression(value) })`)
  const fast = 'const fastResult = measureCompilerStage(\'transformScript.fastSetup\', () => tryFastTransformCompiledScriptSetup(source, options))'
  source = replaceOnce(source, fast, `${fast}\n  ${access}.fastSetup(Boolean(fastResult))`)
  const warn = 'const warn = resolveWarnHandler(options?.warn)'
  return replaceOnce(source, warn, `const warn = ${access}.warningHandler(resolveWarnHandler(options?.warn))`)
}
