import type { MeasuredBuildOutput } from '../measuredBuild'
import type { BuildDiagnosticTerminal, BuildHookEvent, BuildHookOptions } from './hooks'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { parseCliBuildMs } from '../cliTiming'
import { AUTO_IMPORT_BUILD_HOOK_PREFIX, autoImportBuildHookNames } from './hooks'

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

function isBuildDiagnosticTerminal(value: unknown): value is BuildDiagnosticTerminal {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Record<string, unknown>
  return record.kind === 'producer-end' && record.schemaVersion === 2
    && Number.isSafeInteger(record.lastAssignedId) && Number(record.lastAssignedId) >= 0
    && Array.isArray(record.pendingIds) && record.pendingIds.every(id => Number.isSafeInteger(id) && id > 0)
    && Number.isFinite(record.timeOrigin) && Number.isFinite(record.endedAtMs) && Number(record.endedAtMs) >= 0
    && typeof record.drained === 'boolean'
    && typeof record.finalCloseHook === 'boolean'
}

function missingInvocationRanges(ids: number[], lastAssignedId: number) {
  const errors: string[] = []
  let next = 1
  for (const id of [...new Set(ids)].sort((a, b) => a - b)) {
    if (id > next) {
      errors.push(`Missing hook invocation IDs: ${next}-${id - 1}`)
    }
    next = id + 1
  }
  if (next <= lastAssignedId) {
    errors.push(`Missing hook invocation IDs: ${next}-${lastAssignedId}`)
  }
  return errors
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
  let terminal: BuildDiagnosticTerminal | null = null
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith(AUTO_IMPORT_BUILD_HOOK_PREFIX)) {
      continue
    }
    try {
      const event: unknown = JSON.parse(line.slice(AUTO_IMPORT_BUILD_HOOK_PREFIX.length))
      if (isBuildDiagnosticTerminal(event)) {
        if (terminal) {
          errors.push('Duplicate producer terminal record')
        }
        terminal = event
        continue
      }
      if (!isBuildHookEvent(event)) {
        throw new Error('Invalid hook event')
      }
      if (terminal) {
        errors.push(`Hook event follows producer terminal: ${event.id}`)
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
  const maxId = events.reduce((max, event) => Math.max(max, event.id), 0)
  errors.push(...missingInvocationRanges(events.map(event => event.id), terminal?.lastAssignedId ?? maxId))
  if (!terminal) {
    errors.push('Missing producer terminal record')
  }
  else if (!terminal.drained || !terminal.finalCloseHook || terminal.pendingIds.length || terminal.lastAssignedId !== maxId
    || events.some(event => event.timeOrigin !== terminal.timeOrigin || event.startedAtMs > terminal.endedAtMs || (event.endedAtMs ?? event.startedAtMs) > terminal.endedAtMs)) {
    errors.push('Incomplete producer terminal boundary')
  }
  return { events, terminal, errors }
}

function redactCapturedBuildText(value: string, roots: BuildHookOptions['roots']) {
  let redacted = value
  for (const root of [...roots].sort((a, b) => b.path.length - a.path.length)) {
    const paths = [root.path.replace(/[\\/]+$/, ''), root.path.replaceAll('\\', '/').replace(/\/+$/, '')]
    const representations = [...new Set(paths.flatMap(rootPath => [
      rootPath,
      JSON.stringify(rootPath).slice(1, -1),
      encodeURIComponent(rootPath),
      encodeURI(rootPath),
    ]))].sort((a, b) => b.length - a.length)
    for (const rootPath of representations) {
      redacted = redacted.replaceAll(rootPath, root.label)
    }
  }
  return redacted
}

/** 调用点已经停止原进程计时；保留分离的原输出、解析文本和诊断缺口。 */
export async function saveAutoImportBuildDiagnostics(directory: string, output: MeasuredBuildOutput, roots: BuildHookOptions['roots']) {
  await mkdir(directory, { recursive: true })
  const timing = readBuildTimingEvidence(output.stdout, output.stderr)
  const stdout = redactCapturedBuildText(output.stdout, roots)
  const stderr = redactCapturedBuildText(output.stderr, roots)
  const hooks = readBuildHookEvidence(stdout)
  await Promise.all([
    writeFile(path.join(directory, 'stdout.log'), stdout),
    writeFile(path.join(directory, 'stderr.log'), stderr),
    writeFile(path.join(directory, 'diagnostic.json'), `${redactCapturedBuildText(JSON.stringify({ ...output, stdout: undefined, stderr: undefined, timing, hooks, scope: 'opt-in diagnostic; not performance acceptance; hook intervals may overlap' }, null, 2), roots)}\n`),
  ])
}
