import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../', import.meta.url))
const sourcePath = path.join(root, 'scripts/benchmark-templates-hmr.ts')
const original = await readFile(sourcePath, 'utf8')
let source = original
const ast = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
const edits = []
for (const node of ast.statements) {
  if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || !node.moduleSpecifier.text.startsWith('.')) {
    continue
  }
  edits.push({ start: node.moduleSpecifier.getStart(ast), end: node.moduleSpecifier.end, text: JSON.stringify(path.resolve(path.dirname(sourcePath), node.moduleSpecifier.text)) })
}
for (const edit of edits.sort((a, b) => b.start - a.start)) {
  source = source.slice(0, edit.start) + edit.text + source.slice(edit.end)
}
source = `import { beginMutation, observedWrite, finishMutation, finalizeScenario, recordTransport, registerDev, stoppedDev, saveLifecycle } from './driver.mjs'\n${source}`
function once(before, after) {
  assert.equal(source.split(before).length, 2, `Private driver anchor: ${before}`)
  source = source.replace(before, after)
}
once('const memoryNodeOptions = \'--expose-gc --inspect=127.0.0.1:0\'', `const memoryNodeOptions = ${JSON.stringify(`--expose-gc --inspect=127.0.0.1:0 --import=${new URL('./preload.mjs', import.meta.url).href}`)}`)
once('  try {\n    const startupStartedAt = performance.now()', '  registerDev(dev)\n  try {\n    const startupStartedAt = performance.now()')
once('    await dev.stop(5_000).catch(() => {})', '    await dev.stop(5_000)\n    stoppedDev(dev)\n    await saveLifecycle(reportRoot)')
once('      phase = \'edit\'\n      const startedAt', '      phase = \'edit\'\n      const editObservationId = await beginMutation(inspectorUrl, scenario, index, phase, updated)\n      const startedAt')
once('() => replaceFileByRename(scenario.sourceFile, updated)', '() => observedWrite(editObservationId, () => replaceFileByRename(scenario.sourceFile, updated))')
once('      const restoreLineCount = await countJsonlLines(profilePath)', '      await finishMutation(editObservationId, editSample, path.join(template.workspaceRoot, \'dist\'), readOutput)\n      const restoreLineCount = await countJsonlLines(profilePath)')
once('      phase = \'restore\'\n      const restoreStartedAt', '      phase = \'restore\'\n      const restoreObservationId = await beginMutation(inspectorUrl, scenario, index, phase, original)\n      const restoreStartedAt')
once('() => replaceFileByRename(scenario.sourceFile, original)', '() => observedWrite(restoreObservationId, () => replaceFileByRename(scenario.sourceFile, original))')
once('      cycles.push({ edit: editSample, restore: restoreSample })', '      await finishMutation(restoreObservationId, restoreSample, path.join(template.workspaceRoot, \'dist\'), readOutput)\n      cycles.push({ edit: editSample, restore: restoreSample })')
once('  if (failure) {\n    return failure', '  await finalizeScenario(scenario, inspectorUrl, reportRoot, failure)\n  if (failure) {\n    return failure')
const transportAnchor = 'transport.push({ ...event, phase })'
assert.equal(source.split(transportAnchor).length, 3)
source = source.replaceAll(transportAnchor, `${transportAnchor}\n          recordTransport(event, phase)`)
const checked = ts.createSourceFile('benchmark-private.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
assert.equal(checked.parseDiagnostics.length, 0)
await writeFile(new URL('./benchmark-private.ts', import.meta.url), source)
const hash = value => createHash('sha256').update(value).digest('hex')
await writeFile(new URL('./harness-manifest.json', import.meta.url), `${JSON.stringify({ sourcePath: 'scripts/benchmark-templates-hmr.ts', sourceHash: hash(original), privateHash: hash(source), noThresholdOrTimeoutChange: true, extraWork: ['inspector activate/finish outside sample windows', 'in-memory script/full-output snapshots after profile and acknowledgement', 'transport observation in existing callback', 'owned stop errors preserved'] }, null, 2)}\n`)
console.log(JSON.stringify({ preparationOnly: true, sourceHash: hash(original), privateHash: hash(source) }))
