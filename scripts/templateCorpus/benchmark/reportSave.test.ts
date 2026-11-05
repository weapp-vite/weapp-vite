import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { atomicReport, saveFinalReport } from './reportSave'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function output() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'regression-report-save-'))
  directories.push(directory)
  return { directory, file: path.join(directory, 'report.json') }
}

describe('atomic regression report saving', () => {
  it('replaces the previous complete report only after the new JSON is complete', async () => {
    const { directory, file } = await output()
    await writeFile(file, '{"status":"running"}\n')
    const report = { status: 'failed', firstFailure: { operation: 'parse', group: 'shared' }, samples: Array.from({ length: 500 }, (_, index) => ({ index })) }
    await atomicReport(file, report)
    const saved: unknown = JSON.parse(await readFile(file, 'utf8'))
    expect(saved).toEqual(report)
    expect(await readdir(directory)).toEqual(['report.json'])
    await expect(saveFinalReport(file, { status: 'complete' })).resolves.toEqual({ saved: true })
  })

  it('preserves the last complete report on serialization or temporary-file failure', async () => {
    const { file } = await output()
    const previous = '{"status":"running","samples":[1,2,3]}\n'
    await writeFile(file, previous)
    await expect(atomicReport(file, { invalid: 1n })).rejects.toThrow()
    expect(await readFile(file, 'utf8')).toBe(previous)
    await mkdir(`${file}.next`)
    await expect(atomicReport(file, { status: 'failed' })).rejects.toThrow()
    expect(await readFile(file, 'utf8')).toBe(previous)
  })

  it('leaves a complete temporary report and original destination when atomic rename fails', async () => {
    const { file } = await output()
    await mkdir(file)
    await writeFile(path.join(file, 'keep'), 'original destination')
    await expect(atomicReport(file, { status: 'failed' })).rejects.toThrow()
    expect(await readFile(path.join(file, 'keep'), 'utf8')).toBe('original destination')
    const temporary: unknown = JSON.parse(await readFile(`${file}.next`, 'utf8'))
    expect(temporary).toEqual({ status: 'failed' })
  })

  it('returns a failure and saves small independent evidence if the final full report cannot be written', async () => {
    const { directory, file } = await output()
    const previous = '{"status":"running"}\n'
    await writeFile(file, previous)
    await mkdir(`${file}.next`)
    const saved = await saveFinalReport(file, { status: 'regression' }, () => 'controlled temporary write failure')
    expect(saved).toEqual({ saved: false, error: 'controlled temporary write failure', evidence: path.join(directory, 'report-save-error.json') })
    const evidence: unknown = JSON.parse(await readFile(path.join(directory, 'report-save-error.json'), 'utf8'))
    expect(evidence).toEqual({ schemaVersion: 1, status: 'failed', phase: 'final-report-save', report: 'report.json', error: 'controlled temporary write failure' })
    expect(await readFile(file, 'utf8')).toBe(previous)
  })

  it('retains the original report and reports both failures if even the small fallback cannot be saved', async () => {
    const { directory, file } = await output()
    await writeFile(file, '{"status":"running"}\n')
    await mkdir(`${file}.next`)
    await mkdir(path.join(directory, 'report-save-error.json.next'))
    await expect(saveFinalReport(file, {}, () => 'controlled write failure')).resolves.toMatchObject({ saved: false, error: 'controlled write failure', evidenceError: 'controlled write failure' })
    expect(await readFile(file, 'utf8')).toBe('{"status":"running"}\n')
  })
})
