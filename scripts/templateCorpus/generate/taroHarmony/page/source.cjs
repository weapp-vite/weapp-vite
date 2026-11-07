const assert = require('node:assert/strict')
const { parseSync, types: t } = require('@babel/core')

module.exports = function adaptPageSource(source, name) {
  assert.equal(typeof source, 'string', 'Harmony page compatibility requires the official loader text.')
  const parsed = parseSync(source, { babelrc: false, configFile: false, sourceType: 'module', parserOpts: { errorRecovery: true } })
  assert.ok(parsed && parsed.errors && parsed.errors.length === 1 && parsed.errors[0].reasonCode === 'DuplicateDefaultExport', 'The official page module must contain only the known duplicate default export error.')
  const body = parsed.program.body
  const defaults = body.filter(node => t.isExportDefaultDeclaration(node))
  assert.equal(defaults.length, 2, 'The official page module must contain exactly two default exports.')
  const [factory, component] = defaults
  const configuration = body[2]
  assert.ok(body.length === 5 && body[3] === factory && body[4] === component && t.isVariableDeclaration(configuration, { kind: 'var' })
    && configuration.declarations.length === 1 && t.isIdentifier(configuration.declarations[0].id, { name: 'config' })
    && t.isObjectExpression(configuration.declarations[0].init), 'The frozen official page module statement protocol changed.')
  assert.ok(body[body.length - 1] === component && t.isIdentifier(component.declaration, { name: 'component' }), 'The final official page export must be the redundant component export.')
  const call = factory.declaration
  assert.ok(t.isCallExpression(call) && t.isMemberExpression(call.callee) && !call.callee.computed
    && t.isIdentifier(call.callee.object, { name: 'createPageConfig' }) && t.isIdentifier(call.callee.property, { name: 'bind' }), 'The Harmony default export must remain the official PageConfig factory.')
  const [context, input, pageName, root, config] = call.arguments
  assert.ok(call.arguments.length === 5 && t.isNullLiteral(context) && t.isIdentifier(input, { name: 'component' })
    && t.isStringLiteral(pageName, { value: name }), 'The Harmony PageConfig factory arguments changed.')
  const rootProperty = t.isObjectExpression(root) && root.properties.length === 1 && root.properties[0]
  const children = rootProperty && t.isObjectProperty(rootProperty) && !rootProperty.computed && !rootProperty.shorthand && t.isIdentifier(rootProperty.key, { name: 'root' })
    && t.isObjectExpression(rootProperty.value) && rootProperty.value.properties.length === 1 && rootProperty.value.properties[0]
  assert.ok(children && t.isObjectProperty(children) && !children.computed && !children.shorthand && t.isIdentifier(children.key, { name: 'cn' })
    && t.isArrayExpression(children.value) && children.value.elements.length === 0, 'The official PageConfig initial root changed.')
  assert.ok(t.isLogicalExpression(config, { operator: '||' }) && t.isIdentifier(config.left, { name: 'config' })
    && t.isObjectExpression(config.right) && config.right.properties.length === 0, 'The official PageConfig fallback changed.')
  const imports = body.filter(node => t.isImportDeclaration(node))
  assert.ok(imports.length === 2 && imports[0].source.value === '@tarojs/runtime'
    && imports[0].specifiers.length === 1 && t.isImportSpecifier(imports[0].specifiers[0])
    && t.isIdentifier(imports[0].specifiers[0].imported, { name: 'createPageConfig' })
    && t.isIdentifier(imports[0].specifiers[0].local, { name: 'createPageConfig' })
    && imports[1].specifiers.length === 1 && t.isImportDefaultSpecifier(imports[1].specifiers[0])
    && t.isIdentifier(imports[1].specifiers[0].local, { name: 'component' })
    && imports[1].source.value.includes(`entry-cache.js?name=${name}!`), 'The official page module imports changed.')
  assert.ok(Number.isInteger(component.start) && Number.isInteger(component.end)
    && /^export default component\s*;?$/.test(source.slice(component.start, component.end))
    && !source.slice(component.end).trim(), 'The redundant official component export source changed.')
  // 只删除已验证的模块语句，工厂、源组件、模板及官方 chunk/asset 钩子全部继续参与编译。
  const output = source.slice(0, component.start) + source.slice(component.end)
  parseSync(output, { babelrc: false, configFile: false, sourceType: 'module' })
  return output
}
