import fs from 'node:fs/promises'
import path from 'node:path'
import { aggregateVerificationReports, jsonFiles } from './aggregate'
import { assertVerificationPlanContract } from './planContract'
import { verificationPlanSchema } from './validation'

/** 独立入口与 workspace 入口共享全部断言，不能从退出码推断完整验收。 */
export async function runStandaloneAggregate(options: { plan: string, reports: string, output: string }) {
  const plan = verificationPlanSchema.parse(JSON.parse(await fs.readFile(options.plan, 'utf8')))
  assertVerificationPlanContract(plan)
  const files = await jsonFiles(options.reports)
  const values: unknown[] = await Promise.all(files.map(async file => JSON.parse(await fs.readFile(file, 'utf8')) as unknown))
  const reports = values.filter(value => value && typeof value === 'object' && 'schemaVersion' in value && value.schemaVersion === 2 && 'execution' in value)
  await fs.mkdir(path.dirname(options.output), { recursive: true })
  try {
    const report = await aggregateVerificationReports(plan, reports, { reportsRoot: options.reports, files })
    await fs.writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`)
  }
  catch (error) {
    await fs.writeFile(options.output, `${JSON.stringify({ schemaVersion: 1, kind: 'verification-aggregate-failure', planHash: plan.planHash, runId: plan.runId, commitSha: plan.commitSha, coverage: 'partial', acceptance: 'failed', error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    throw error
  }
}
