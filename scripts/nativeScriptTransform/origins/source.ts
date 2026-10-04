import { calls, ensureAnchor, importedCall, ownedCall, ownedVariable, patch, span } from './instrumentation'

export const inlineOriginsGlobalKey = '__weappViteExperimentalInlineOrigins'
const access = `globalThis.${inlineOriginsGlobalKey}`
const compiler = 'packages-runtime/wevu-compiler/src/plugins/vue/'

/** 包住真实模板调用，保留完整输入与 descriptor，原调用参数和结果均不改变。 */
export function instrumentTemplateOwner(source: string) {
  const { call, owner } = ownedCall(calls(source, inlineOriginsGlobalKey), ['compileVueTemplateToWxml'], [['descriptor', 'template', 'content'], ['filename'], ['options']], 'compileTemplatePhase', ['descriptor', 'filename', 'source', 'templateResolvedId', 'options', 'result', 'bindingManifestSourceFile'])
  importedCall(call, 'compileVueTemplateToWxml')
  ownedVariable(call, owner, 'templateCompiled')
  ensureAnchor(call.parentPath.isVariableDeclarator() && call.parentPath.node.id.type === 'Identifier'
    && call.parentPath.node.id.name === 'templateCompiled' && call.parentPath.node.init === call.node, 'unexpected template result declaration')
  const range = span(call.node)
  return patch(source, [{ ...range, text: `${access}.template(descriptor.template, filename, source, templateResolvedId, () => ${source.slice(range.start, range.end)})` }])
}

/** 在真正的事件注册调用周围保留 Vue 节点，不能通过表达式内容搜索回填位置。 */
export function instrumentDirectiveOwner(source: string) {
  const { call, owner } = ownedCall(calls(source, inlineOriginsGlobalKey), ['registerInlineExpression'], [['inlineSource'], ['context']], 'transformOnDirective', ['node', 'context', 'options'])
  importedCall(call, 'registerInlineExpression')
  ownedVariable(call, owner, 'inlineSource')
  ownedVariable(call, owner, 'inlineExpression')
  ensureAnchor(call.parentPath.isConditionalExpression() && call.parentPath.node.consequent === call.node
    && call.parentPath.parentPath.isVariableDeclarator() && call.parentPath.parentPath.node.id.type === 'Identifier'
    && call.parentPath.parentPath.node.id.name === 'inlineExpression', 'unexpected inline registration expression')
  const range = span(call.node)
  return patch(source, [{ ...range, text: `${access}.directive(node, context, inlineSource, () => ${source.slice(range.start, range.end)})` }])
}

/** 使用现有解析结果记录改写前 callee，资产注册后再核对实际生成的根调用。 */
export function instrumentInlineOwner(source: string) {
  const all = calls(source, inlineOriginsGlobalKey)
  const parsed = ownedCall(all, ['parseBabelExpressionFile'], [['exp']], 'registerInlineExpression', ['exp', 'context'])
  importedCall(parsed.call, 'parseBabelExpressionFile')
  ownedVariable(parsed.call, parsed.owner, 'parsed')
  const declarator = parsed.call.parentPath
  ensureAnchor(declarator.isVariableDeclarator() && declarator.node.id.type === 'Identifier'
    && declarator.node.id.name === 'parsed' && declarator.node.init === parsed.call.node, 'unexpected parsed declaration')
  const declaration = declarator.parentPath
  ensureAnchor(declaration.isVariableDeclaration() && declaration.node.kind === 'const' && declaration.node.declarations.length === 1
    && declaration.parentPath.node === parsed.owner.node.body, 'parsed declaration is not a direct single const')
  const registered = ownedCall(all, ['context', 'inlineExpressions', 'push'], [['asset']], 'registerInlineExpression', ['exp', 'context'])
  ensureAnchor(registered.owner.node === parsed.owner.node, 'parse and registration owners differ')
  ownedVariable(registered.call, registered.owner, 'asset')
  ownedVariable(registered.call, registered.owner, 'updatedExpressionNode')
  const statement = registered.call.parentPath
  ensureAnchor(statement.isExpressionStatement() && statement.parentPath.node === registered.owner.node.body, 'asset registration is not a direct statement')
  const parsedEnd = span(declaration.node).end
  const registeredEnd = span(statement.node).end
  ensureAnchor(parsedEnd < span(statement.node).start, 'asset registration precedes parsing')
  return patch(source, [
    { start: parsedEnd, end: parsedEnd, text: `;${access}.parsed(exp, context, parsed);` },
    { start: registeredEnd, end: registeredEnd, text: `;${access}.registered(asset, context, updatedExpressionNode);` },
  ])
}

export const inlineOriginTargets = [
  { target: `${compiler}transform/compileVueFile/template.ts`, instrument: instrumentTemplateOwner },
  { target: `${compiler}compiler/template/directives/on.ts`, instrument: instrumentDirectiveOwner },
  { target: `${compiler}compiler/template/expression/inline.ts`, instrument: instrumentInlineOwner },
] as const
