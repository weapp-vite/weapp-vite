import type { MeasuredBuildOutput } from '../measuredBuild'
import type { BuildHookEvent, BuildHookOptions } from './hooks'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { parseCliBuildMs } from '../cliTiming'
import { AUTO_IMPORT_BUILD_HOOK_PREFIX, autoImportBuildHookNames, normalizeBuildDiagnosticText } from './hooks'

function isBuildHookEvent(value: unknown): value is BuildHookEvent {
  if (!value || typeof value !== 'object') {
    return false
  }
  const event = value as Record<string, unknown>
  return Number.isSafeInteger(event.id) && Number(event.id) > 0
    && Number.isSafeInteger(event.pluginIndex) && Number(event.pluginIndex) >= 0
    && typeof event.pluginName === 'string'
    && typeof event.hookName === 'string' && (autoImportBuildHookNames as readonly string[]).includes(event.hookName)
    && typeof event.status === 'string' && ['started', 'completed', 'failed'].includes(event.status)
    && Number.isFinite(event.startedAtMs) && Number(event.startedAtMs) >= 0 && Number.isFinite(event.timeOrigin)
    && (event.moduleId === undefined || typeof event.moduleId === 'string')
}

function isCompleteBoundary(started: BuildHookEvent, finished: BuildHookEvent) {
  return finished.pluginIndex === started.pluginIndex && finished.pluginName === started.pluginName
    && finished.hookName === started.hookName && finished.moduleId === started.moduleId
    && finished.startedAtMs === started.startedAtMs && finished.timeOrigin === started.timeOrigin
    && typeof finished.endedAtMs === 'number' && Number.isFinite(finished.endedAtMs) && finished.endedAtMs >= started.startedAtMs
    && finished.elapsedMs === finished.endedAtMs - started.startedAtMs
    && (finished.status !== 'failed' || typeof finished.errorName === 'string')
}

/** 使用原解析规则保留首个命中与全部时间文本，不改变原 cliBuildMs。 */
export function readBuildTimingEvidence(stdout: string, stderr: string) {
  const text = stripVTControlCharacters(`${stdout}\n${stderr}`)
  const matches = [...text.matchAll(/(?:built in|耗时：)\s*(\d+(?:\.\d+)?)\s*(ms|s)\b/g)].map(match => ({
    text: match[0],
    index: match.index,
    milliseconds: Number(match[1]) * (match[2] === 's' ? 1000 : 1),
  }))
  return { cliBuildMs: parseCliBuildMs(`${stdout}\n${stderr}`), matchedText: matches[0]?.text ?? null, matches }
}

export function readBuildHookEvidence(stdout: string) {
  const events: BuildHookEvent[] = []
  const errors: string[] = []
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith(AUTO_IMPORT_BUILD_HOOK_PREFIX)) {
      continue
    }
    try {
      const event: unknown = JSON.parse(line.slice(AUTO_IMPORT_BUILD_HOOK_PREFIX.length))
      if (!isBuildHookEvent(event)) {
        throw new Error('Invalid hook event')
      }
      events.push(event)
    }
    catch {
      errors.push('Malformed build hook diagnostic line')
    }
  }
  const started = events.filter(event => event.status === 'started')
  const finished = events.filter(event => event.status !== 'started')
  const startsById = new Map<number, BuildHookEvent>()
  const finishesById = new Map<number, BuildHookEvent[]>()
  for (const event of events) {
    if (event.status === 'started') {
      if (startsById.has(event.id)) {
        errors.push(`Duplicate hook start: ${event.id}`)
      }
      startsById.set(event.id, event)
    }
    else {
      if (!startsById.has(event.id)) {
        errors.push(`Hook finish precedes start: ${event.id}`)
      }
      const records = finishesById.get(event.id) ?? []
      records.push(event)
      finishesById.set(event.id, records)
    }
  }
  for (const event of started) {
    const matches = finishesById.get(event.id) ?? []
    if (matches.length !== 1 || !isCompleteBoundary(event, matches[0]!)) {
      errors.push(`Incomplete hook boundary: ${event.id}`)
    }
  }
  if (!started.length || finished.some(event => !startsById.has(event.id))) {
    errors.push('Missing build hook boundaries')
  }
  return { events, errors }
}

/** 调用点已经停止原进程计时；保留分离的原输出、解析文本和诊断缺口。 */
export async function saveAutoImportBuildDiagnostics(directory: string, output: MeasuredBuildOutput, roots: BuildHookOptions['roots']) {
  await mkdir(directory, { recursive: true })
  const timing = readBuildTimingEvidence(output.stdout, output.stderr)
  const hooks = readBuildHookEvidence(output.stdout)
  await Promise.all([
    writeFile(path.join(directory, 'stdout.log'), normalizeBuildDiagnosticText(output.stdout, roots)),
    writeFile(path.join(directory, 'stderr.log'), normalizeBuildDiagnosticText(output.stderr, roots)),
    writeFile(path.join(directory, 'diagnostic.json'), `${JSON.stringify({ ...output, stdout: undefined, stderr: undefined, timing, hooks, scope: 'opt-in diagnostic; not performance acceptance; hook intervals may overlap' }, null, 2)}\n`),
  ])
}
