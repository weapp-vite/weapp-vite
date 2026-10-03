import assert from 'node:assert/strict'
import ts from 'typescript'

const sink = 'globalThis[Symbol.for("weapp-vite.ignored.native-notification")]'
const span = '__wvNotificationSpan'

export function transform(source, filename, kind) {
  assert(!source.includes(span), 'Diagnostic identifier collision')
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const nodes = []
  const visit = (node) => {
    nodes.push(node)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  const edits = []
  const inventory = []
  const text = node => node.getText(ast)
  const all = (predicate, parent) => nodes.filter(node => predicate(node) && (!parent || (node.pos >= parent.pos && node.end <= parent.end)))
  function one(predicate, parent, label) {
    const matches = all(predicate, parent)
    assert.equal(matches.length, 1, `${label}: expected one, got ${matches.length}`)
    return matches[0]
  }
  const fn = (name, parent) => one(node => (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) && node.name && text(node.name) === name, parent, `function ${name}`)
  const call = (name, parent) => one(node => ts.isCallExpression(node) && text(node.expression) === name, parent, `call ${name}`)
  const insert = (at, value, label) => {
    edits.push({ at, value })
    if (label) {
      inventory.push(label)
    }
  }
  const prepend = (body, value, label) => {
    assert(ts.isBlock(body))
    insert(body.getStart(ast) + 1, `\n${value}\n`, label)
  }
  function wrap(node, before, after, label) {
    insert(node.getStart(ast), before, label)
    insert(node.end, after)
  }
  function afterVariable(name, parent, value, label) {
    const node = one(node => ts.isVariableDeclaration(node) && text(node.name) === name, parent, `variable ${name}`)
    assert(ts.isVariableStatement(node.parent.parent))
    insert(node.parent.parent.end, `\n${value}\n`, label)
  }

  if (kind === 'core') {
    const hook = fn('watchChange', fn('createWatchChangeHook'))
    prepend(hook.body, `const ${span} = ${sink}.beginCore(id, change.event); try {`, 'core.enter')
    insert(hook.body.end - 1, `\n} catch (__wvNotificationError) { ${sink}.event(${span}, "core.error", { message: String(__wvNotificationError?.message ?? __wvNotificationError) }); throw __wvNotificationError; } finally { ${sink}.event(${span}, "core.exit"); }\n`, 'core.exit/error')
    const normalized = call('normalizeWatchEvent', hook)
    wrap(normalized, `(${sink}.event(${span}, "core.normalize.begin"), `, ')', 'core.normalize.begin')
    afterVariable('event', hook, `${sink}.event(${span}, "core.normalized", { event });`, 'core.normalized')
    const invalidate = call('processChangedFile', hook)
    wrap(invalidate, `(${sink}.event(${span}, "core.invalidate.begin"), `, ')', 'core.invalidate.begin')
    afterVariable('dirtyReasonSummary', hook, `${sink}.event(${span}, "core.invalidate.end", { dirtyReasonSummary });`, 'core.invalidate.end')
    const notify = call('state.ctx.onStatefulHmrSourceChange', hook)
    wrap(notify, `${sink}.notify(${span}, () => `, ')', 'core.notify')
    const session = fn('handleSourceUpdate')
    const sourceCall = one(node => ts.isCallExpression(node) && /^this\.profile\?\.source$/.test(text(node.expression)), session, 'profile.source')
    wrap(sourceCall, `(${sink}.sessionSource(normalizedFile), `, ')', 'session.source')
  }
  else if (kind === 'rolldown') {
    const wrapper = fn('bindingifyWatchChange')
    const handler = call('handler.call', wrapper)
    assert.equal(handler.arguments.length, 3)
    wrap(handler, `${sink}.owner("native-js", id, event, args.plugin.name, () => `, ')', 'native.callback')
  }
  else if (kind === 'vite') {
    const dispatches = []
    for (const name of ['onFileChange', 'onFileAddUnlink']) {
      const declaration = one(node => ts.isVariableDeclaration(node) && text(node.name) === name && ts.isArrowFunction(node.initializer), undefined, name)
      const dispatch = call('environment.pluginContainer.watchChange', declaration.initializer)
      assert.equal(dispatch.arguments.length, 2)
      const event = name === 'onFileChange' ? '"update"' : '(isUnlink ? "delete" : "create")'
      wrap(dispatch, `${sink}.owner("vite-container", file, ${event}, environment.name, () => `, ')', `vite.dispatch:${name}`)
      dispatches.push(dispatch)
    }
    for (const event of ['change', 'add', 'unlink']) {
      const listener = one(node => ts.isCallExpression(node) && text(node.expression) === 'watcher.on' && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === event && ts.isArrowFunction(node.arguments[1]), undefined, `watcher ${event}`)
      const callback = listener.arguments[1]
      assert.equal(text(callback.parameters[0].name), 'file')
      prepend(callback.body, `${sink}.receipt(file, ${JSON.stringify(event)});`, `vite.receipt:${event}`)
    }
  }
  else {
    throw new Error(`Unknown transform kind: ${kind}`)
  }

  let result = source
  for (const edit of edits.sort((a, b) => b.at - a.at)) {
    result = result.slice(0, edit.at) + edit.value + result.slice(edit.at)
  }
  const checked = ts.createSourceFile(filename, result, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  assert.equal(checked.parseDiagnostics.length, 0, `Instrumented syntax errors: ${checked.parseDiagnostics.map(item => item.messageText).join('; ')}`)
  return { source: result, inventory }
}
