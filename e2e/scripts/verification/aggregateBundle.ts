import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { rolldown } from 'rolldown'
import { assertVerificationPlanContract } from './planContract'
import { VERIFICATION_TOOL_VERSION } from './types'
import { verificationPlanSchema } from './validation'

/** 由计划生产者生成自包含执行包，产物仅由 Rolldown 原生 write 持久化。 */
export async function buildAggregateBundle(planFile: string, directory: string) {
  const plan = verificationPlanSchema.parse(JSON.parse(await fs.readFile(planFile, 'utf8')))
  assertVerificationPlanContract(plan)
  await fs.mkdir(directory, { recursive: true })
  const filename = path.join(directory, 'aggregate.mjs')
  const bundle = await rolldown({ input: fileURLToPath(new URL('./aggregateEntry.ts', import.meta.url)), platform: 'node', external: /^node:/ })
  try {
    await bundle.write({ file: filename, format: 'esm', codeSplitting: false })
  }
  finally {
    await bundle.close()
  }
  const manifest = {
    schemaVersion: 1,
    toolVersion: VERIFICATION_TOOL_VERSION,
    entry: 'aggregate.mjs',
    sha256: createHash('sha256').update(await fs.readFile(filename)).digest('hex'),
    planHash: plan.planHash,
    runId: plan.runId,
    commitSha: plan.commitSha,
    profile: plan.profile,
    executionTopology: plan.executionTopology,
  }
  await fs.writeFile(path.join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const option = (key: string) => process.argv.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3)
  const plan = option('plan')
  const output = option('output')
  if (!plan || !output) {
    throw new Error('Expected --plan=<file> --output=<directory>')
  }
  await buildAggregateBundle(plan, output)
}
