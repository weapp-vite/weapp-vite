import type { VerificationTiming } from './types'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export const E2E_TIMING_FILE_ENV = 'WEAPP_VITE_E2E_TIMING_FILE'

export function recordE2ETiming(timing: VerificationTiming, sink?: (timing: VerificationTiming) => void) {
  if (sink) {
    sink(timing)
  }
  else if (process.env[E2E_TIMING_FILE_ENV]) {
    const file = process.env[E2E_TIMING_FILE_ENV]!
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.appendFileSync(file, `${JSON.stringify(timing)}\n`)
  }
}

/** 阶段耗时只用于诊断；不能用它代替 task、case 或资源释放证据。 */
export async function measureE2EPhase<T>(name: string, operation: () => Promise<T>, sink?: (timing: VerificationTiming) => void): Promise<T> {
  const startedAt = new Date().toISOString()
  const started = performance.now()
  let status: VerificationTiming['status'] = 'passed'
  let result: T
  try {
    result = await operation()
  }
  catch (error) {
    status = error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'failed'
    throw error
  }
  finally {
    const timing: VerificationTiming = { name, invocationId: randomUUID(), startedAt, durationMs: Math.max(0, performance.now() - started), status }
    try {
      recordE2ETiming(timing, sink)
    }
    catch (error) {
      process.stderr.write(`[e2e-timing] Failed to record ${name}: ${error instanceof Error ? error.message : String(error)}\n`)
    }
  }
  return result
}

export function readE2ETimings(file: string): VerificationTiming[] {
  if (!fs.existsSync(file)) {
    return []
  }
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
    const value: unknown = JSON.parse(line)
    if (!value || typeof value !== 'object' || !('durationMs' in value) || typeof value.durationMs !== 'number'
      || !Number.isFinite(value.durationMs) || value.durationMs < 0 || !('name' in value) || typeof value.name !== 'string'
      || !('invocationId' in value) || typeof value.invocationId !== 'string'
      || !('startedAt' in value) || typeof value.startedAt !== 'string' || !Number.isFinite(Date.parse(value.startedAt))
      || !('status' in value) || !['passed', 'failed', 'cancelled'].includes(String(value.status))) {
      throw new Error('Invalid E2E timing record')
    }
    return value as VerificationTiming
  })
}
