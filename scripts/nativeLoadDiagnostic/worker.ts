import { channel } from 'node:diagnostics_channel'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'

const phaseChannel = channel('weapp-vite.ast.native-load-diagnostic.phase')
const phase = (value: string) => phaseChannel.publish({ phase: value })
const output = process.argv.find(value => value.startsWith('--output='))?.slice('--output='.length)
if (!output || !phaseChannel.hasSubscribers) {
  throw new Error('Fresh worker requires output and native load diagnostic preload')
}

phase('import')
const { analyzeScript, analyzeScripts } = await import('../../packages/ast/src/operations/scriptAnalysis')
const { collectOnPageScrollPerformanceWarnings } = await import('../../packages/ast/src/operations/onPageScroll')
const featureFlags = { astEngine: 'oxc' as const, moduleId: 'wevu', hookToFeature: { onLoad: 'load', onPageScroll: 'scroll' } }
const first = 'import { onLoad } from \'wevu\'; onLoad(() => {}); const value = require(\'./data\'); wx.request({});'
const last = 'import { onPageScroll } from \'wevu\'; onPageScroll(() => { wx.getStorageSync(\'value\'); });'
const inputs = [first, last].map(code => ({ code, filename: 'inline.ts', featureFlags }))
const results: Array<{ phase: string, output: unknown }> = []
const normalize = (value: ReturnType<typeof analyzeScript>) => ({ ...value, featureFlags: [...value.featureFlags] })

phase('no-hint')
results.push({ phase: 'no-hint', output: collectOnPageScrollPerformanceWarnings('const value = 1', 'inline.ts') })
phase('batch')
results.push({ phase: 'batch', output: analyzeScripts(inputs, { engine: 'oxc' }).map(normalize) })
phase('cached-warning')
results.push({ phase: 'cached-warning', output: collectOnPageScrollPerformanceWarnings(last, 'inline.ts') })
phase('repeat-last')
results.push({ phase: 'repeat-last', output: normalize(analyzeScript(last, { engine: 'oxc', featureFlags })) })
phase('parse-failure')
results.push({ phase: 'parse-failure', output: normalize(analyzeScript('import { onLoad } from \'wevu\'; onLoad( ; wx.request({});', { engine: 'oxc', featureFlags })) })
phase('recovery')
results.push({ phase: 'recovery', output: analyzeScripts(inputs, { engine: 'oxc' }).map(normalize) })
phase('finished-workload')
await writeFile(output, `${JSON.stringify({ schemaVersion: 1, results }, null, 2)}\n`, { flag: 'wx' })
