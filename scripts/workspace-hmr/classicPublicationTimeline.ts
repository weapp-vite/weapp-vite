import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function parseRecord(source: string) {
  try {
    return record(JSON.parse(source) as unknown)
  }
  catch {
    return undefined
  }
}

function fingerprint(source: string) {
  return { bytes: Buffer.byteLength(source), sha256: createHash('sha256').update(source).digest('hex') }
}

function identity(value: Record<string, unknown>) {
  return Object.fromEntries(['timestamp', 'buildId', 'batchId', 'sessionId', 'eventId', 'pipeline', 'profileMode', 'completionBoundary', 'status', 'correlation']
    .flatMap(key => typeof value[key] === 'string' ? [[key, value[key]]] : []))
}

interface TimelineBoundary {
  line: number
  type: 'native-publication' | 'dev-lifecycle'
  sha256: string
  boundary?: string
  generation?: string
  inputCount?: number
  outputCount?: number
  sourceEventCount?: number
  message?: string
}

/** 只汇总已有记录的身份、顺序与实际数值；无效或未完成记录不会被解释为成功耗时。 */
export function summarizeWorkspaceHmrTimeline(devOutput: string, profile?: string) {
  const malformedProfileLines: number[] = []
  const samples = (profile?.split(/\r?\n/) ?? []).flatMap((line, index) => {
    if (!line.trim()) {
      return []
    }
    const value = parseRecord(line)
    if (!value) {
      malformedProfileLines.push(index + 1)
      return []
    }
    const metrics = Object.fromEntries(Object.entries(value).filter(([key, value]) => /(?:Ms|Count)$/.test(key) && typeof value === 'number' && Number.isFinite(value)))
    const sourceEvents = Array.isArray(value.sourceEvents) ? value.sourceEvents : []
    return [{ line: index + 1, sha256: fingerprint(line).sha256, ...identity(value), metrics, sourceEventCount: sourceEvents.length }]
  })
  const boundaries = devOutput.split(/\r?\n/).flatMap<TimelineBoundary>((line, index) => {
    const prefix = '[native-publication] '
    const offset = line.indexOf(prefix)
    if (offset >= 0) {
      const value = parseRecord(line.slice(offset + prefix.length))
      const cursor = record(value?.profileCursor)
      const profileIdentity = record(cursor?.identity)
      return [{
        line: index + 1,
        type: 'native-publication',
        sha256: fingerprint(line).sha256,
        boundary: typeof value?.boundary === 'string' ? value.boundary : undefined,
        generation: typeof value?.generation === 'string' ? value.generation : undefined,
        inputCount: Object.keys(record(value?.inputs) ?? {}).length,
        outputCount: Object.keys(record(value?.outputs) ?? {}).length,
        ...(profileIdentity ? identity(profileIdentity) : {}),
        sourceEventCount: Array.isArray(profileIdentity?.sourceEvents) ? profileIdentity.sourceEvents.length : undefined,
      }]
    }
    if (/HMR classic |小程序.*(?:构建完成|热更新)|\[hmr\]/.test(line)) {
      return [{ line: index + 1, type: 'dev-lifecycle', message: line, sha256: fingerprint(line).sha256 }]
    }
    return []
  })
  return { profileAvailable: profile !== undefined, malformedProfileLines, samples, boundaries }
}

/** 在既有开发进程结束后冻结原始证据，不启动额外采样，也不改变验收预算。 */
export async function writeWorkspaceHmrTimelineEvidence(directory: string, devOutput: string, profilePath: string) {
  const profile = await readFile(profilePath, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return undefined
    }
    throw error
  })
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'dev-output.log'), devOutput, 'utf8')
  const stdout = { file: 'dev-output.log', ...fingerprint(devOutput) }
  if (profile !== undefined) {
    await writeFile(path.join(directory, 'hmr-profile.jsonl'), profile, 'utf8')
  }
  else {
    await rm(path.join(directory, 'hmr-profile.jsonl'), { force: true })
  }
  return {
    stdout,
    profile: profile === undefined ? { missing: true as const } : { file: 'hmr-profile.jsonl', ...fingerprint(profile) },
    timeline: summarizeWorkspaceHmrTimeline(devOutput, profile),
  }
}
