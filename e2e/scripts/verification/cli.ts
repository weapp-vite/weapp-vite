import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { aggregateVerificationReports, jsonFiles } from './aggregate'
import { collectDurationHistory } from './history'
import { assertVerificationPlan, createVerificationPlan } from './plan'
import { currentVerificationProfile, verificationProfileSchema } from './profile'
import { durationHistorySchema, verificationPlanSchema } from './validation'

function option(args: string[], name: string, required = false) {
  const value = args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  if (required && !value) {
    throw new Error(`Missing --${name}=<value>`)
  }
  return value
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function writeJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`)
}

export async function runVerificationCli(args = process.argv.slice(2)) {
  const [command] = args
  const output = option(args, 'output', true)!
  const suite = option(args, 'suite') ?? 'ci-full'
  const profileFile = option(args, 'profile')
  const suppliedProfile = profileFile ? verificationProfileSchema.parse(await readJson(profileFile)) : currentVerificationProfile(suite)
  const profile = { ...suppliedProfile, arch: suppliedProfile.arch ?? process.arch }
  if (command === 'plan') {
    const historyFile = option(args, 'history')
    const plan = await createVerificationPlan({ suite, topology: option(args, 'topology'), shards: Number(option(args, 'shards') ?? 1), profile, history: historyFile ? durationHistorySchema.parse(await readJson(historyFile)) : undefined })
    await writeJson(output, plan)
    console.log(JSON.stringify({ planHash: plan.planHash, runId: plan.runId, tasks: plan.tasks.length, shardTotal: plan.shardTotal }))
    return
  }
  if (command === 'history') {
    const input = option(args, 'input', true)!
    const files = await jsonFiles(input)
    const receipts = files.filter(file => path.basename(file) === 'receipt.json')
    const inputs = await Promise.all(receipts.map(async file => ({
      receipt: await readJson(file),
      reports: await Promise.all((await jsonFiles(path.dirname(file))).filter(candidate => path.basename(candidate) !== 'receipt.json').map(readJson)),
    })))
    const history = collectDurationHistory(inputs, { profile, repository: option(args, 'repository', true)!, workflow: option(args, 'workflow', true)! })
    await writeJson(output, history)
    console.log(JSON.stringify({ historyTasks: Object.keys(history.tasks).length }))
    return
  }
  if (command === 'aggregate') {
    const plan = verificationPlanSchema.parse(await readJson(option(args, 'plan', true)!))
    assertVerificationPlan(plan)
    const reportsRoot = option(args, 'reports', true)!
    const files = await jsonFiles(reportsRoot)
    const values = (await Promise.all(files.map(readJson))).filter(value => value && typeof value === 'object' && 'schemaVersion' in value && value.schemaVersion === 2 && 'execution' in value)
    try {
      const report = await aggregateVerificationReports(plan, values, { reportsRoot, files })
      await writeJson(output, report)
      console.log(JSON.stringify({ coverage: report.coverage, acceptance: report.acceptance, tasks: report.summary.executedCount }))
    }
    catch (error) {
      await writeJson(output, { schemaVersion: 1, kind: 'verification-aggregate-failure', planHash: plan.planHash, runId: plan.runId, commitSha: plan.commitSha, coverage: 'partial', acceptance: 'failed', error: error instanceof Error ? error.message : String(error) })
      throw error
    }
    return
  }
  throw new Error(`Unknown verification command: ${command}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await runVerificationCli()
}
