import type { SelectionMode, VerificationMode } from './types.ts'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { assertCommittedSnapshot, assertCurrentPlan, prepareVerificationPlan } from './prepare.ts'
import { formatPlan, formatReport, saveReport } from './report.ts'
import { createTaskExecutor, runVerification } from './run.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export async function main(args = process.argv.slice(2), root = ROOT): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      base: { type: 'string' },
      head: { type: 'string' },
      mode: { type: 'string', default: 'quick' },
      selection: { type: 'string' },
      topology: { type: 'string' },
      file: { type: 'string', multiple: true },
      jobs: { type: 'string' },
      output: { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  })
  if (values.help) {
    process.stdout.write('verify <plan|run> [--base REF] [--head COMMIT] [--mode quick|review|full] [--selection shadow|affected] [--topology legacy-v1|optimized-v1|optimized-v2] [--file PATH] [--jobs N] [--output DIR] [--json]\n')
    return 0
  }
  const command = positionals[0] ?? 'plan'
  if (!['plan', 'run'].includes(command) || positionals.length > 1) {
    throw new Error('仅支持 plan 或 run 子命令')
  }
  if (!['quick', 'review', 'full'].includes(values.mode!)) {
    throw new Error('未知验证模式')
  }
  if (values.selection && !['shadow', 'affected'].includes(values.selection)) {
    throw new Error('未知范围选择策略')
  }
  if (values.mode === 'full' && values.file?.length) {
    throw new Error('full 模式不能同时指定局部文件')
  }
  const options = {
    base: values.base,
    head: values.head,
    files: values.file,
    jobs: values.jobs,
    mode: values.mode as VerificationMode,
    selection: values.selection as SelectionMode | undefined,
    topology: values.topology,
  }
  const plan = await prepareVerificationPlan(root, options)
  const directory = path.resolve(root, values.output ?? `.tmp/verification/${new Date().toISOString().replaceAll(':', '-')}`)
  if (command === 'plan') {
    process.stdout.write(`${values.json ? JSON.stringify(plan, null, 2) : formatPlan(plan)}\n`)
    if (values.output) {
      await saveReport(root, directory, plan)
    }
    return 0
  }
  if (!values.json) {
    process.stdout.write(`${formatPlan(plan)}\n`)
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  process.once('SIGINT', abort)
  process.once('SIGTERM', abort)
  try {
    await assertCurrentPlan(root, plan, options)
    const report = await runVerification(plan, createTaskExecutor(root, values.json), { signal: controller.signal })
    if (values.head) {
      await assertCommittedSnapshot(root, plan, options)
    }
    await saveReport(root, directory, plan, report)
    process.stdout.write(`${values.json ? JSON.stringify(report, null, 2) : formatReport(report)}\n`)
    return controller.signal.aborted ? 130 : ['failed', 'blocked'].includes(report.status) ? 1 : 0
  }
  finally {
    process.removeListener('SIGINT', abort)
    process.removeListener('SIGTERM', abort)
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().then(code => process.exitCode = code).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
