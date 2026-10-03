import ts from 'typescript'

/** 只展开可静态证明的 each 行；未知格式交回清单的不完整门禁。 */
export function expandSuiteParameters(
  node: ts.CallExpression,
  title: string,
  read: (value: ts.Expression | undefined) => unknown,
) {
  let tableCall: ts.Expression = node.expression
  while (ts.isPropertyAccessExpression(tableCall)) {
    tableCall = tableCall.expression
  }
  if (!ts.isCallExpression(tableCall) || !ts.isPropertyAccessExpression(tableCall.expression)
    || tableCall.expression.name.text !== 'each') {
    return undefined
  }
  const table = read(tableCall.arguments[0])
  const callback = node.arguments.find(argument => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))
  if (!Array.isArray(table) || !callback || (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))) {
    return undefined
  }
  const rows = []
  for (const [index, item] of table.entries()) {
    const values = Array.isArray(item) ? item : [item]
    let offset = 0
    let unresolved = false
    const name = title.replace(/%[%#s]|%[a-z$]/gi, (placeholder) => {
      if (placeholder === '%%') {
        return '%'
      }
      if (placeholder === '%#') {
        return String(index)
      }
      const value = values[offset++]
      if (placeholder !== '%s' || !['string', 'number', 'boolean'].includes(typeof value)) {
        unresolved = true
        return placeholder
      }
      return String(value)
    })
    if (unresolved || /\$[a-z_]/i.test(title)) {
      return undefined
    }
    rows.push({ name, values, callback })
  }
  return rows
}
