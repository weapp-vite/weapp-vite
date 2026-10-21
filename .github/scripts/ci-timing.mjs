import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/** 记录各阶段耗时，失败仍保留原始退出码，取消时不另起报告任务。 */
export async function recordTiming(action, phase, exitCode = 0, root = process.cwd(), now = Date.now()) {
  if (!['start', 'finish'].includes(action) || !/^[\w-]+$/u.test(phase)) {
    throw new Error('Usage: ci-timing.mjs <start|finish> <phase> [exitCode]')
  }
  if (!Number.isFinite(now) || !Number.isSafeInteger(Number(exitCode)) || Number(exitCode) < 0 || Number(exitCode) > 255) {
    throw new Error('Invalid timing clock or exit code')
  }
  const filename = path.join(root, '.tmp/ci-timings.json')
  let report = { schemaVersion: 1, phases: {} }
  try {
    report = JSON.parse(await readFile(filename, 'utf8'))
  }
  catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
  if (action === 'start') {
    if (report.phases[phase]) {
      throw new Error(`Duplicate timing phase: ${phase}`)
    }
    report.phases[phase] = { startedAt: now }
  }
  else {
    const entry = report.phases[phase]
    if (!entry || !Number.isFinite(entry.startedAt)) {
      throw new Error(`Missing timing start: ${phase}`)
    }
    if (entry.completedAt !== undefined || now < entry.startedAt) {
      throw new Error(`Duplicate finish or negative timing interval: ${phase}`)
    }
    Object.assign(entry, { completedAt: now, durationMs: now - entry.startedAt, exitCode: Number(exitCode) })
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `| ${phase} | ${(entry.durationMs / 1000).toFixed(2)} s | ${entry.exitCode} |\n`)
    }
  }
  await mkdir(path.dirname(filename), { recursive: true })
  await writeFile(filename, `${JSON.stringify(report, null, 2)}\n`)
  return report
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await recordTiming(process.argv[2], process.argv[3], process.argv[4])
}
