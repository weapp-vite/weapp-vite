import type { UploadReport } from './report'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveUploadTimeout } from './options'
import { outputUploadReport, UploadCommandError } from './report'

const previousExitCode = process.exitCode

afterEach(() => {
  vi.restoreAllMocks()
  process.exitCode = previousExitCode
})

function capture(stream: NodeJS.WriteStream) {
  const chunks: string[] = []
  vi.spyOn(stream, 'write').mockImplementation(((chunk: string | Uint8Array, encodingOrCallback?: unknown, callback?: unknown) => {
    chunks.push(String(chunk))
    const done = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback
    if (typeof done === 'function') {
      done()
    }
    return true
  }) as typeof stream.write)
  return chunks
}

describe('upload machine-readable output', () => {
  it('keeps build logs off stdout and emits one parseable partial-failure report', async () => {
    const stdout = capture(process.stdout)
    const stderr = capture(process.stderr)
    const report: UploadReport = {
      schemaVersion: 1,
      action: 'upload',
      status: 'failed',
      error: 'upload refused',
      results: [
        { platform: 'weapp', stage: 'upload', status: 'success', requestedVersion: '1.0.0' },
        { platform: 'xhs', stage: 'upload', status: 'failed', requestedVersion: '1.0.0', error: 'upload refused' },
        { platform: 'tt', stage: 'prepare', status: 'not-run' },
      ],
    }
    const originalWrite = process.stdout.write
    await outputUploadReport(true, async () => {
      process.stdout.write('build output\n')
      process.stderr.write('SDK diagnostic\n')
      throw new UploadCommandError(report)
    })
    expect(JSON.parse(stdout.join(''))).toEqual(report)
    expect(stderr.join('')).toBe('build output\nSDK diagnostic\n')
    expect(process.exitCode).toBe(1)
    expect(process.stdout.write).toBe(originalWrite)
  })

  it('reports argument validation failures without claiming any target ran', async () => {
    const stdout = capture(process.stdout)
    capture(process.stderr)
    await outputUploadReport(true, async () => {
      throw new Error('invalid timeout')
    })
    expect(JSON.parse(stdout.join(''))).toEqual({
      schemaVersion: 1,
      action: 'upload',
      status: 'failed',
      results: [],
      error: 'invalid timeout',
    })
    expect(process.exitCode).toBe(1)
  })
})

describe('upload timeout limits', () => {
  it.each([0, -1, '', ' ', 'false', 'Infinity', 'NaN', '0.0001', 2147483.648])('rejects an invalid local timeout: %j', (value) => {
    expect(() => resolveUploadTimeout(value)).toThrow()
  })

  it('accepts seconds with millisecond precision and leaves unspecified timeout disabled', () => {
    expect(resolveUploadTimeout('0.125')).toBe(125)
    expect(resolveUploadTimeout('1.001')).toBe(1001)
    expect(resolveUploadTimeout('2147483.647')).toBe(2147483647)
    expect(resolveUploadTimeout(30)).toBe(30000)
    expect(resolveUploadTimeout(undefined)).toBeUndefined()
  })
})
