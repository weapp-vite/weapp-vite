import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { collectRun } from './collect'
import { INPUTS, parseOptions } from './contract'
import { validNativeDiagnostic } from './diagnosticObservation'
import { verifyNativeBinding } from './native'
import { captureIdentity } from './stage'

/** 在正式采样前验证真实隔离工程的准备、依赖链接、构建和 native 观测，不作性能门禁。 */
async function main() {
  const output = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length)
  if (!output) {
    throw new Error('Expected --output=<new diagnostic directory>')
  }
  const options = parseOptions(['--mode=smoke', `--output=${output}`, '--native-path=packages/ast-native/index.js'])
  await mkdir(path.dirname(options.output), { recursive: true })
  await mkdir(options.output)
  const native = await verifyNativeBinding(options.nativePath)
  const identity = await captureIdentity(options)
  const input = INPUTS[0]!
  options.inputIdentities = { [input.source]: identity[input.source]! }
  const run = await collectRun(options, input, 'build', 'on', 0, 'primary', true)
  const passed = !run.error && run.samples.length === 2 && validNativeDiagnostic(run)
  await writeFile(path.join(options.output, 'stage-check.json'), `${JSON.stringify({
    schemaVersion: 1,
    scope: 'First representative template diagnostic only; not paired timings or performance acceptance.',
    platform: process.platform,
    node: process.version,
    passed,
    native,
    run,
  }, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ passed, samples: run.samples.length, nativeCoverage: run.native.coverage }))
  if (!passed) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
