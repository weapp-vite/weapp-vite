import type { BindingAnalysis, BindingInput } from './source'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createVueSfcFixture } from '../astMigrationProfile/fixtures'
import { loadProductionBindingAnalysis } from './source'

const output = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length)
const sourceFile = process.argv.find(arg => arg.startsWith('--source='))?.slice('--source='.length)
if (!output) {
  throw new Error('Expected --output=<new capture.json>')
}
if (process.env.WEAPP_VITE_NATIVE === '1') {
  throw new Error('Run with WEAPP_VITE_NATIVE unset/0 to capture the independent JS baseline')
}
const source = await loadProductionBindingAnalysis({ capture: true })
try {
  const { compileVueFile } = await import('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile')
  const repository = fileURLToPath(new URL('../../', import.meta.url))
  const filename = sourceFile ? path.relative(repository, path.resolve(sourceFile)).split(path.sep).join('/') : 'src/pages/profile/index.vue'
  if (filename.startsWith('../') || path.isAbsolute(filename) || !filename.endsWith('.vue')) {
    throw new Error('Expected --source=<repository-relative Vue SFC>')
  }
  const fixture = sourceFile ? await readFile(sourceFile, 'utf8') : createVueSfcFixture()
  const options = { isPage: true, wevuDefaults: { component: { options: { virtualHost: false } } } }
  for (let index = 0; index < 5; index++) {
    await compileVueFile(fixture, filename, options)
  }
  const inputs: BindingInput[] = []
  const expected: Array<BindingAnalysis | null> = []
  source.setRecorder((input) => {
    const index = inputs.length
    inputs.push(input)
    expected.push(null)
    return (analysis) => {
      expected[index] = analysis
    }
  })
  const warnings: string[] = []
  const result = await compileVueFile(fixture, filename, { ...options, warn: warning => warnings.push(warning) })
  source.setRecorder()
  const report = {
    schemaVersion: 1,
    boundary: 'collectDependencies:normalized-before-parse',
    fixture: sourceFile ? filename : 'scripts/astMigrationProfile/fixtures.ts:createVueSfcFixture',
    compileOptions: options,
    sourceSha256: source.sourceSha256,
    inputSha256: createHash('sha256').update(fixture).digest('hex'),
    outputSha256: createHash('sha256').update(JSON.stringify({ value: result, warnings })).digest('hex'),
    inputs,
    expected,
    counts: {
      calls: inputs.length,
      uniqueExpressions: new Set(inputs.map(input => input.expression)).size,
      uniqueRequests: new Set(inputs.map(input => JSON.stringify(input))).size,
    },
  }
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(report.counts)
}
finally {
  source.dispose()
}
