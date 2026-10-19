import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'
import { collectCiEvidence } from '../ci.mjs'
import { fixture, time } from './fixture.mjs'
import { withCiRun } from './github.mjs'

it('isolates same-name artifacts by current attempt and downloads the verified exact ID', async () => {
  const value = fixture()
  value.artifacts.unshift({ ...value.artifacts[0], id: 99, created_at: time(-10), expired: true })
  const ids = []
  const execute = async (command, args, options) => {
    if (args[1].endsWith('/zip')) {
      ids.push(args[1])
    }
    return value.execute(command, args, options)
  }
  const result = await collectCiEvidence(value.repository, 123, value.configuration, execute)
  expect(result.sample.complete).toBe(true)
  expect(result.evidence.artifactInventory).toHaveLength(5)
  expect(result.evidence.artifacts.map(artifact => artifact.id)).not.toContain(99)
  expect(ids[0]).toBe(`repos/${value.repository}/actions/artifacts/10/zip`)
  expect(value.downloads.every(filename => !existsSync(path.dirname(filename)))).toBe(true)
  const names = await withCiRun(value.repository, 123, value.execute, async ({ artifacts }) => artifacts.map(artifact => artifact.name))
  expect(names).toHaveLength(4)
  expect(new Set(names).size).toBe(4)
})

it.each([
  ['future creation', value => value.created_at = time(31)],
  ['malformed creation', value => value.created_at = 'invalid'],
  ['foreign run', value => value.workflow_run = { ...value.workflow_run, id: 999 }],
])('rejects %s on an old same-name artifact before choosing a current one', async (_, mutate) => {
  const value = fixture()
  const old = { ...value.artifacts[0], id: 99, created_at: time(-1) }
  mutate(old)
  value.artifacts.push(old)
  await expect(collectCiEvidence(value.repository, 123, value.configuration, value.execute)).rejects.toThrow(/artifact/iu)
})

it.each([
  ['foreign job run', value => value.jobs[0].run_id++],
  ['foreign job attempt', value => value.jobs[0].run_attempt++],
  ['reused successful job', value => value.jobs[0].started_at = time(-1)],
  ['inverted job interval', value => value.jobs[0].completed_at = time(9)],
  ['future job interval', value => value.jobs[0].completed_at = time(31)],
])('rejects %s even when the overall run is successful', async (_, mutate) => {
  const value = fixture()
  mutate(value)
  await expect(collectCiEvidence(value.repository, 123, value.configuration, value.execute)).rejects.toThrow(/current-attempt execution/iu)
})

it('shares one in-flight download when concurrent consumers reference the same archive', async () => {
  const value = fixture()
  const results = await withCiRun(value.repository, 123, value.execute, async ({ download }) => Promise.all([
    download('coverage-plan'),
    download('coverage-plan'),
    download('coverage-plan'),
  ]))
  expect(results[0]).toBe(results[1])
  expect(results[1]).toBe(results[2])
  expect(value.downloads).toHaveLength(1)
  expect(value.downloads.every(filename => !existsSync(path.dirname(filename)))).toBe(true)
})

it('drains an in-flight download before cleaning up a failed operation', async () => {
  const value = fixture()
  let release
  let signalStarted
  const started = new Promise(resolve => signalStarted = resolve)
  const execute = async (command, args, options) => {
    if (args[1].endsWith('/zip')) {
      signalStarted()
      await new Promise(resolve => release = resolve)
    }
    return value.execute(command, args, options)
  }
  await expect(withCiRun(value.repository, 123, execute, async ({ download }) => {
    void download('coverage-plan')
    await started
    queueMicrotask(() => release())
    throw new Error('operation failed')
  })).rejects.toThrow('operation failed')
  expect(value.downloads).toHaveLength(1)
  expect(value.downloads.every(filename => !existsSync(path.dirname(filename)))).toBe(true)
})

it('accepts a fully fresh second attempt and retains the same committed source identity', async () => {
  const value = fixture()
  const first = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
  value.run.run_attempt = 2
  value.configuration.identity.runAttempt = 2
  value.context.runAttempt = 2
  for (const job of value.jobs) {
    job.run_attempt = 2
  }
  const second = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
  expect(second.sample.sourceFingerprint).toBe(first.sample.sourceFingerprint)
  expect(second.sample.revision).toBe(first.sample.revision)
  expect(second.evidence.context.runAttempt).toBe(2)
})

it('removes partial binary downloads when the exact-ID HTTP request fails', async () => {
  const value = fixture()
  const archives = []
  const execute = async (command, args, options) => {
    if (args[1].endsWith('/zip')) {
      archives.push(options.stdout.file)
      await writeFile(options.stdout.file, 'partial binary download')
      throw new Error('artifact HTTP request failed')
    }
    return value.execute(command, args, options)
  }
  await expect(collectCiEvidence(value.repository, 123, value.configuration, execute)).rejects.toThrow('artifact HTTP request failed')
  expect(archives).toHaveLength(1)
  expect(archives.every(filename => !existsSync(path.dirname(filename)))).toBe(true)
})

it('cleans all task-owned download state after a corrupt binary archive', async () => {
  const value = fixture()
  const execute = async (command, args, options) => {
    const result = await value.execute(command, args, options)
    if (args[1].endsWith('/zip')) {
      await writeFile(options.stdout.file, 'corrupt binary archive')
    }
    return result
  }
  await expect(collectCiEvidence(value.repository, 123, value.configuration, execute)).rejects.toThrow(/size|digest/u)
  expect(value.downloads.every(filename => !existsSync(path.dirname(filename)))).toBe(true)
})
