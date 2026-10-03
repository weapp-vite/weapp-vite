import type { AcceptanceOptions, AcceptanceRun, HmrInput } from './acceptanceContract'
import { createHash } from 'node:crypto'
import { mkdir, realpath, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { evaluateGate } from '../performanceGate/evaluate'
import { renderGate } from '../performanceGate/report'
import { acceptanceOrder, HMR_ACCEPTANCE_BASELINE, HMR_ACCEPTANCE_CONTRACT, HMR_ACCEPTANCE_PAIRS, HMR_INPUTS, pairAcceptanceRuns, parseAcceptanceArgs } from './acceptanceContract'
import { acceptanceInputManifest, collectAcceptanceRun, rebuildAcceptanceCheckouts, sanitizeAcceptanceText, verifyAcceptanceCheckout } from './acceptanceRunner'

/** 固定完整样本政策；超阈值配置只进行一次等量确认，不接受缩减轮次。 */
export async function collectAcceptanceBatch(options: AcceptanceOptions, inputs: readonly HmrInput[], batch: string, deadline: number, collect = collectAcceptanceRun) {
  const runs: AcceptanceRun[] = []
  for (const input of inputs) {
    for (let round = 0; round < HMR_ACCEPTANCE_PAIRS; round++) {
      for (const side of acceptanceOrder(round)) {
        if (Date.now() >= deadline) {
          throw new Error('HMR attribution acceptance deadline exceeded')
        }
        process.stdout.write(`[hmr-attribution] ${options.runtime} ${input.id} ${batch} ${round + 1}/${HMR_ACCEPTANCE_PAIRS} ${side}\n`)
        const run = await collect(options, side, input, round, batch, deadline).catch((error: unknown): AcceptanceRun => ({
          input: input.id,
          round,
          side,
          markerSeed: `hmr-attribution-${batch}-${round}`,
          samples: [],
          error: sanitizeAcceptanceText(String(error), [options.baseline, options.candidate, options.output]),
        }))
        runs.push(run)
        await writeFile(path.join(options.output, `${batch}.json`), `${JSON.stringify(runs, null, 2)}\n`)
        if (run.error) {
          // 基础设施或产物失败保留原始证据，不自动重试成较快/通过样本。
          break
        }
      }
      if (runs.at(-1)?.error) {
        break
      }
    }
  }
  return runs
}

export async function runHmrAttributionAcceptance(options: AcceptanceOptions) {
  const driverRoot = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'))
  if (driverRoot !== await realpath(options.candidate)) {
    throw new Error('The fixed candidate checkout must own the collector and acceptance driver')
  }
  for (const root of [options.baseline, options.candidate]) {
    const relative = path.relative(root, options.output)
    if (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) {
      throw new Error('Acceptance output must be outside both source checkouts')
    }
  }
  await verifyAcceptanceCheckout(options.candidate, options.candidateSha)
  await verifyAcceptanceCheckout(options.baseline, HMR_ACCEPTANCE_BASELINE)
  // 使用新目录防止覆盖一次确认记录；复验需要显式保留上一轮结果。
  await mkdir(options.output, { recursive: false })
  const deadline = Date.now() + 165 * 60_000
  const report = {
    schemaVersion: 1,
    kind: 'hmr-attribution-acceptance',
    samplingContract: HMR_ACCEPTANCE_CONTRACT,
    issues: [1133, 1134],
    baselineSha: HMR_ACCEPTANCE_BASELINE,
    candidateSha: options.candidateSha,
    collectorSha: options.candidateSha,
    runtime: options.runtime,
    policy: { pairs: HMR_ACCEPTANCE_PAIRS, cycles: 2, sampleMode: 'edit-only', thresholdPercent: 5, maxConfirmationBatches: 1, profileTimeoutMs: 15_000, source: 'performanceGate/evaluate.ts; #1082 approved baseline unchanged' },
    environment: { platform: process.platform, arch: process.arch, node: process.version, release: os.release(), cpus: os.cpus().length, order: 'alternating-by-pair; both checkouts on this runner' },
    historicalProfile: options.runtime === 'stateful-experimental' ? { status: 'unavailable', phases: 'unknown', evidence: 'Fixed baseline statefulHmr has no HMR profile producer; no baseline source instrumentation was added.' } : { status: 'observed-only' },
    rawEvidence: 'Each side retains path-redacted producer JSONL, collector report, input manifest and output scopes; numeric samples are unchanged.',
    stableDevtoolsValidation: 'not-run-final-runtime-acceptance-incomplete',
    status: 'incomplete',
    preparation: {} as Record<string, unknown>,
    inputs: [] as Array<{ id: string, scenarios: readonly string[], digest: string, files: Record<string, string> }>,
    primary: [] as AcceptanceRun[],
    confirmation: [] as AcceptanceRun[],
    confirmationInputs: [] as string[],
    gate: evaluateGate([]),
    errors: [] as string[],
  }
  const checkpoint = async () => {
    await writeFile(path.join(options.output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
    await writeFile(path.join(options.output, 'report.md'), `${renderGate(report.gate)}\n\n此入口只提供 HMR 性能与阶段证据；真实 Stable DevTools 最终验收另行执行。历史 stateful 阶段不可用时为 unknown，未补造历史数据。\n`)
  }
  await checkpoint()
  try {
    report.preparation = await rebuildAcceptanceCheckouts(options)
    for (const input of HMR_INPUTS) {
      const files = await acceptanceInputManifest(path.join(options.candidate, input.source))
      report.inputs.push({ id: input.id, scenarios: input.scenarios, digest: createHash('sha256').update(JSON.stringify(files)).digest('hex'), files })
    }
    await checkpoint()
    process.stdout.write('dist sync: rebuilt weapp-vite before downstream validation\n')
    report.primary = await collectAcceptanceBatch(options, HMR_INPUTS, 'primary', deadline)
    for (const run of report.primary) {
      if (run.inputDigest !== report.inputs.find(input => input.id === run.input)?.digest) {
        run.error = 'Fixture bytes changed after the input manifest was frozen'
      }
    }
    const primary = pairAcceptanceRuns(report.primary, HMR_INPUTS)
    report.gate = evaluateGate(primary)
    const exceeded = report.gate.scenarios.filter(row => row.primary.count === HMR_ACCEPTANCE_PAIRS && (row.primary.changePercent ?? 0) > 5).map(row => row.id)
    const confirmationInputs = HMR_INPUTS.filter(input => exceeded.some(id => id.startsWith(`${input.id}:`)))
    report.confirmationInputs = confirmationInputs.map(input => input.id)
    // 在启动唯一确认前保存固定计划，不用首轮较快值覆盖首轮样本。
    await checkpoint()
    if (confirmationInputs.length) {
      report.confirmation = await collectAcceptanceBatch(options, confirmationInputs, 'confirmation', deadline)
      for (const run of report.confirmation) {
        if (run.inputDigest !== report.inputs.find(input => input.id === run.input)?.digest) {
          run.error = 'Fixture bytes changed after the input manifest was frozen'
        }
      }
    }
    report.gate = evaluateGate(primary, pairAcceptanceRuns(report.confirmation, confirmationInputs))
    await verifyAcceptanceCheckout(options.baseline, HMR_ACCEPTANCE_BASELINE)
    await verifyAcceptanceCheckout(options.candidate, options.candidateSha)
    report.errors.push(...[...report.primary, ...report.confirmation].flatMap(run => run.error ? [`${run.input}/${run.side}/${run.round}: ${run.error}`] : []))
    report.status = report.errors.length ? 'incomplete' : report.gate.status
  }
  catch (error) {
    report.errors.push(sanitizeAcceptanceText(String(error), [options.baseline, options.candidate, options.output]))
  }
  finally {
    await checkpoint()
  }
  if (report.status !== 'passed') {
    throw new Error(`HMR attribution acceptance ${report.status}; see report.json`)
  }
  return report
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runHmrAttributionAcceptance(parseAcceptanceArgs(process.argv.slice(2))).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
