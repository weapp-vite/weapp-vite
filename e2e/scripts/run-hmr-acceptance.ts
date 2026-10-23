import type { SuiteReportPayload } from './suiteReport'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { withMachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'
import { ACCEPTANCE_ROOT, DOM_ACCEPTANCE_ENV, sanitizeAcceptanceValue } from './domAcceptanceReport/helpers'
import { createPlannedTaskCaseReader } from './domAcceptanceReport/taskCases'
import { HMR_ACCEPTANCE_STAGES } from './hmr-acceptance-manifest'
import { assertHmrAcceptanceComplete, createHmrAcceptanceSummary } from './hmrAcceptance/report'
import { readHmrRuntimeReceipt } from './hmrAcceptance/runtimeEvidence'
import { runHmrUnitValidation } from './hmrAcceptance/unit'
import { runE2ESuiteCli } from './run-e2e-suite'
import { aggregateVerificationReports } from './verification/aggregate'
import { assertVerificationPlan, createVerificationIdentity, createVerificationPlan, resolveVerificationTasks } from './verification/plan'
import { currentVerificationProfile } from './verification/profile'

/** 独立验收禁止继承局部筛选；分层文件清单由版本化语义清单决定。 */
export function selectHmrAcceptanceStages(name: string, args: string[], env = process.env) {
  const selectionKeys = ['TASK_FILTER', 'TASK_FROM', 'TASK_ROLL_FROM', 'SHARD_INDEX', 'SHARD_TOTAL', 'TEMPLATE', 'ACCEPTANCE_CASES', 'COMPILER_HOST', 'CLASSIC_PROJECT', 'CLASSIC_MODE', 'STATEFUL_PROJECT']
  if (args.length || selectionKeys.some(key => env[`WEAPP_VITE_E2E_${key}`])) {
    throw new Error('HMR acceptance does not accept ad-hoc filters, shards, templates or allow-failures')
  }
  const stages = name === 'all' ? HMR_ACCEPTANCE_STAGES : HMR_ACCEPTANCE_STAGES.filter(stage => stage.name === name)
  if (!stages.length) {
    throw new Error(`Unknown HMR acceptance stage: ${name}`)
  }
  return stages
}

async function writeEvidence(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, `${JSON.stringify(sanitizeAcceptanceValue(value), null, 2)}\n`)
}

export async function runHmrAcceptanceCli(args = process.argv.slice(2)) {
  const selection = args[0] ?? 'all'
  const stages = selectHmrAcceptanceStages(selection, args.slice(1))
  const previousProvider = process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER
  const previousStrict = process.env[DOM_ACCEPTANCE_ENV]
  const identity = createVerificationIdentity()
  if (identity.workingTreeDirty !== false) {
    throw new Error('HMR acceptance requires a clean committed checkout')
  }
  const output = path.join(ACCEPTANCE_ROOT, '.tmp/e2e-hmr-acceptance', identity.runId)
  await fs.mkdir(path.dirname(output), { recursive: true })
  try {
    await fs.mkdir(output, { recursive: false })
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('HMR acceptance output directory already exists; choose a new run ID', { cause: error })
    }
    throw error
  }
  try {
    const requiredStages = await Promise.all(stages.map(async (stage) => {
      const tasks = await resolveVerificationTasks(stage.suite)
      const excluded = tasks.filter(task => task.outOfScopeReason)
      if (excluded.length) {
        throw new Error(`HMR acceptance cannot exclude required manifest tasks: ${excluded.map(task => task.label).join(', ')}`)
      }
      return { stage, tasks }
    }))
    const evidence = await withMachineE2ELease(async (lease) => {
      const unit = selection === 'all'
        ? await runHmrUnitValidation({ repositoryRoot: ACCEPTANCE_ROOT, directory: path.join(output, 'unit'), identity, environment: lease.environment })
        : undefined
      const results = []
      const readCases = createPlannedTaskCaseReader()
      for (const { stage, tasks } of requiredStages) {
        process.env[DOM_ACCEPTANCE_ENV] = stage.provider === 'none' ? '0' : '1'
        if (stage.provider === 'none') {
          delete process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER
        }
        else {
          process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER = stage.provider
        }
        const profile = currentVerificationProfile(stage.suite)
        const plan = await createVerificationPlan({ suite: stage.suite, shards: 1, profile, tasks, identity, readCases })
        const stageRoot = path.join(output, stage.name)
        const planFile = path.join(stageRoot, 'plan.json')
        await writeEvidence(planFile, plan)
        let report: SuiteReportPayload | undefined
        await runE2ESuiteCli([stage.suite, `--plan=${planFile}`, `--expected-plan-hash=${plan.planHash}`], {
          onReport: (value) => { report = value },
        })
        if (!report) {
          throw new Error(`HMR ${stage.name} did not produce a verification report`)
        }
        const files = report.tasks.flatMap(task => task.artifacts
          .filter(artifact => artifact.kind === 'dom-acceptance-report')
          .map(artifact => path.resolve(ACCEPTANCE_ROOT, artifact.indexPath)))
        const verified = await aggregateVerificationReports(plan, [report], { reportsRoot: ACCEPTANCE_ROOT, files })
        const runtime = stage.provider === 'none' ? undefined : await readHmrRuntimeReceipt(plan, files)
        assertVerificationPlan(plan, { suite: stage.suite, profile, tasks: await resolveVerificationTasks(stage.suite), identity: createVerificationIdentity() })
        await writeEvidence(path.join(stageRoot, 'aggregate.json'), verified)
        results.push({ stage, plan, report: verified, ...(runtime ? { runtime } : {}) })
      }
      return { unit, stages: results }
    })
    const current = createVerificationIdentity()
    if (current.commitSha !== identity.commitSha || current.workingTreeDirty !== false) {
      throw new Error('HMR acceptance checkout changed before resource cleanup completed')
    }
    const summary = createHmrAcceptanceSummary(stages, evidence.stages, evidence.unit)
    await writeEvidence(path.join(output, 'index.json'), summary)
    assertHmrAcceptanceComplete(summary)
    console.log(`[hmr-acceptance] scope=${summary.scope} sha=${identity.commitSha} index=${path.relative(ACCEPTANCE_ROOT, output).replaceAll('\\', '/')}/index.json`)
    return summary
  }
  catch (error) {
    await writeEvidence(path.join(output, 'failure.json'), {
      schemaVersion: 1,
      kind: 'hmr-acceptance-failure',
      ...identity,
      coverage: 'partial',
      acceptance: 'failed',
      stages: stages.map(stage => stage.name),
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
  finally {
    if (previousStrict === undefined) {
      delete process.env[DOM_ACCEPTANCE_ENV]
    }
    else {
      process.env[DOM_ACCEPTANCE_ENV] = previousStrict
    }
    if (previousProvider === undefined) {
      delete process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER
    }
    else {
      process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER = previousProvider
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await runHmrAcceptanceCli()
}
