import type { ScriptBaselineFeatures } from './state'

export const scriptBaselineGlobalKey = '__weappViteExperimentalScriptBaseline'
const access = `globalThis.${scriptBaselineGlobalKey}`
const prefix = 'packages-runtime/wevu-compiler/src/plugins/vue/transform/'

export const scriptBaselineSources = [
  `${prefix}compileVueFile/index.ts`,
  `${prefix}compileVueFile/script.ts`,
  `${prefix}compileVueFile/reservedProps.ts`,
  `${prefix}transformScript/index.ts`,
  `${prefix}transformScript/macros/index.ts`,
  `${prefix}transformScript/macros/pageMeta.ts`,
] as const

function replaceOnce(source: string, anchor: string, replacement: string, label: string) {
  if (source.split(anchor).length !== 2) {
    throw new Error(`Script baseline source anchor changed: ${label}`)
  }
  return source.replace(anchor, replacement)
}

function hookEntry(source: string, features: ScriptBaselineFeatures) {
  const signature = 'async function compileVueFileInternal(source: string, filename: string, options?: CompileVueFileOptions): Promise<VueTransformResult> {'
  source = replaceOnce(source, signature, signature.replace('options?: CompileVueFileOptions)', 'options: CompileVueFileOptions | undefined, scriptBaselineSession: object)'), 'compile session parameter')
  const call = '  return measureCompilerStageAsync(\'compileVueFile\', () => compileVueFileInternal(source, filename, options))'
  source = replaceOnce(source, call, `  const scriptBaselineSession = ${access}.beginCompile()
  try {
    return await measureCompilerStageAsync('compileVueFile', () => compileVueFileInternal(source, filename, options, scriptBaselineSession))
  }
  finally {
    ${access}.endCompile(scriptBaselineSession)
  }`, 'compile lifecycle')
  if (features.astReuse) {
    const info = '      cssModules: result.cssModules,'
    source = replaceOnce(source, info, `${info}
      [${access}.transferKey]: ${access}.createTransfer(scriptBaselineSession, scriptCompiled?.content, () => {
        const existing = compiledScriptAst
        compiledScriptAst = undefined
        return existing
      }),`, 'existing AST ownership transfer')
  }
  return source
}

function hookScriptPhase(source: string, features: ScriptBaselineFeatures) {
  if (features.astReuse) {
    const call = '    const transformed = transformScript(jsxTransformed.code, {'
    source = replaceOnce(source, call, `${call}
      [${access}.transferKey]: precomputedScriptPhaseInfo?.[${access}.transferKey],`, 'transform AST token')
  }
  if (features.propsNoScope) {
    const traversal = '    const ast = getScriptAst()\n    traverse(ast, {\n      VariableDeclarator(path) {'
    source = replaceOnce(source, traversal, `    const ast = getScriptAst()
    ${access}.visitPropsWithoutScope()
    traverse(ast, {
      noScope: true,
      VariableDeclarator(path) {`, 'read-only setup return traversal')
  }
  return source
}

function hookTransform(source: string, features: ScriptBaselineFeatures) {
  if (features.astReuse) {
    const parse = 'const ast: BabelFile = measureCompilerStage(\'transformScript.parse\', () => babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS))'
    source = replaceOnce(source, parse, `const ast: BabelFile = measureCompilerStage('transformScript.parse', () => ${access}.takeAst(source, options?.[${access}.transferKey]) ?? babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS))`, 'parse after fast setup')
  }
  if (features.pageMetaGate) {
    source = replaceOnce(source, 'const macroVisitors = createMacroVisitors(ast, state)', 'const macroVisitors = createMacroVisitors(ast, state, source)', 'macro source propagation')
  }
  return source
}

function hookMacroIndex(source: string) {
  source = replaceOnce(source, 'export function createMacroVisitors(ast: t.File, state: TransformState) {', 'export function createMacroVisitors(ast: t.File, state: TransformState, source?: string) {', 'macro source parameter')
  return replaceOnce(source, 'const pageMetaVisitors = createPageMetaVisitors(ast, state)', 'const pageMetaVisitors = createPageMetaVisitors(ast, state, source)', 'page meta source propagation')
}

function hookPageMeta(source: string) {
  const imports = 'import { collectPageMetaCallsForTransform } from \'../../../../../pageDeclaration/analyze\''
  source = replaceOnce(source, imports, `import { mayContainPageMeta } from '../../../../../pageDeclaration'\n${imports}`, 'existing page meta hint')
  const signature = 'export function createPageMetaVisitors(ast: File, state: TransformState) {'
  return replaceOnce(source, signature, `export function createPageMetaVisitors(ast: File, state: TransformState, source?: string) {
  if (${access}.skipPageMeta(source, mayContainPageMeta)) {
    return {}
  }`, 'negative page meta gate')
}

function hookReservedProps(source: string) {
  const entry = `) {
  if (!scriptSetupCode) {`
  return replaceOnce(source, entry, `) {
  if (${access}.skipReservedProps(scriptSetupCode, warn)) {
    return
  }
  if (!scriptSetupCode) {`, 'reserved props guard')
}

/** 只替换声明的私有边界；其他文件和未启用优化保持原源码加载。 */
export function optimizeScriptBaselineSource(filename: string, source: string, features: ScriptBaselineFeatures) {
  if (filename === scriptBaselineSources[0]) {
    return hookEntry(source, features)
  }
  if (filename === scriptBaselineSources[1]) {
    return hookScriptPhase(source, features)
  }
  if (filename === scriptBaselineSources[2] && features.reservedPropsGate) {
    return hookReservedProps(source)
  }
  if (filename === scriptBaselineSources[3]) {
    return hookTransform(source, features)
  }
  if (filename === scriptBaselineSources[4] && features.pageMetaGate) {
    return hookMacroIndex(source)
  }
  if (filename === scriptBaselineSources[5] && features.pageMetaGate) {
    return hookPageMeta(source)
  }
  return source
}
