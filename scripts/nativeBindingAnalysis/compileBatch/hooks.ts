export const batchGlobalKey = '__weappViteExperimentalCompileBindingBatch'
const access = `globalThis.${batchGlobalKey}`

function replaceOnce(source: string, anchor: string, replacement: string, name: string) {
  if (source.split(anchor).length !== 2) {
    throw new Error(`Compile batch source anchor changed: ${name}`)
  }
  return source.replace(anchor, replacement)
}

/** 仅诊断进程替换私有函数；保留生产 visitor、loop 合并与 manifest 生成代码。 */
export function hookBindingSource(source: string) {
  const normalize = `const normalized = context
    ? normalizeWxmlExpressionWithContext(expression, context)
    : expression`
  source = replaceOnce(source, normalize, `const normalized = ${access}.skipNormalization()
    ? expression
    : (context ? normalizeWxmlExpressionWithContext(expression, context) : expression)`, 'normalization')
  const parse = `const parsed = parseBabelExpressionFile(normalized)
  if (!parsed) {`
  source = replaceOnce(source, parse, `const experimentalAnalysis = ${access}.resolveAnalysis(normalized, context, additionalLocals)
  const parsed = experimentalAnalysis ? null : parseBabelExpressionFile(normalized)
  if (experimentalAnalysis?.analysis === null || (!experimentalAnalysis && !parsed)) {`, 'base parse')
  source = replaceOnce(source, '  traverse(parsed.ast, {', `  if (experimentalAnalysis) {
    experimentalAnalysis.analysis.dependencies.forEach(addDependency)
    snapshotFallback = experimentalAnalysis.analysis.snapshotFallback
  }
  else {
  traverse(parsed.ast, {`, 'base traversal')
  source = replaceOnce(source, '\n\n  if (localNames.size && context) {', '\n  }\n\n  if (localNames.size && context) {', 'loop merge')
  const record = '  const initialAnalysis = collectDependencies(options.expression, context, additionalLocals)'
  source = replaceOnce(source, record, `  if (${access}.defer(manifest, options, context, additionalLocals, recordBindingManifestExpression, normalizeWxmlExpressionWithContext)) {
    return
  }
${record}`, 'record binding')
  return `${source}\nexport { collectDependencies as experimentalCompileBatchCollectDependencies };\n`
}

export function hookTemplateSource(source: string) {
  const start = '  const diagnostics: CompilerDiagnostic[] = []'
  source = replaceOnce(source, start, `  const experimentalBatchToken = ${access}.beginTemplate()\n${start}`, 'template begin')
  const retain = '    retainScopedSlotOwnerBindings(context.bindingManifest, context.scopedSlotComponents)'
  source = replaceOnce(source, retain, `    ${access}.flush(context.bindingManifest)\n${retain}`, 'root consume')
  source = replaceOnce(source, '    return result\n  }\n  catch (error) {', `    ${access}.finishTemplate(experimentalBatchToken)
    return result
  }
  catch (error) {
    ${access}.abortTemplate(experimentalBatchToken)`, 'template finish')
  return source
}

export function hookSlotSource(source: string) {
  const direct = '    context.bindingManifest.bindings.push({'
  source = replaceOnce(source, direct, `    ${access}.direct(context.bindingManifest, () => {\n${direct}`, 'slot owner enqueue')
  source = replaceOnce(source, '\n    })\n  }\n  const scopedContext: TransformContext = {', '\n    })\n    })\n  }\n  const scopedContext: TransformContext = {', 'slot owner closure')
  const consume = '  asset.script = buildScopedSlotComponentScript({'
  source = replaceOnce(source, consume, `  ${access}.flush(bindingManifest)\n${consume}`, 'slot child consume')
  return source
}
