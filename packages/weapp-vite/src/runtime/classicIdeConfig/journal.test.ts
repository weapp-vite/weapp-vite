import type { ClassicLease } from './journal'
import fsNative from 'node:fs/promises'
import os from 'node:os'
import process from 'node:process'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { ClassicIdeConfigOwner } from './index'
import { readClassicLease, writeClassicIdeConfig, writeClassicLease } from './journal'
import { classicIdeConfigLeasePath } from './leases'

const cleanup: Array<() => Promise<unknown>> = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const close of cleanup.splice(0).reverse()) {
    await close().catch(() => {})
  }
})

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'classic-journal-'))
  cleanup.push(() => fs.remove(root))
  const file = path.join(root, 'project.private.config.json')
  const original = '{"setting":{"compileHotReLoad":true}}'
  const installed = '{"setting":{"compileHotReLoad":false}}'
  await fs.writeFile(file, original)
  const saved: ClassicLease = { schemaVersion: 1, pid: process.pid, owner: 'live-owner', original, installed }
  const owner = new ClassicIdeConfigOwner()
  cleanup.push(() => owner.close())
  return { root, file, original, installed, saved, owner, journal: classicIdeConfigLeasePath(file) }
}

it.each([
  '{',
  '{}',
  '{"owner":"legacy-owner","original":"{}","installed":"{}"}',
  '{"schemaVersion":1,"pid":0,"owner":"invalid"}',
  '{"schemaVersion":1,"pid":1,"owner":"invalid","original":"{","installed":"{}"}',
])('preserves an unknown journal and provides recovery guidance: %s', async (source) => {
  const { file, original, journal, owner } = await fixture()
  await fs.outputFile(journal, source)
  expect(await owner.readRequested(file)).toBe(original)
  const failure = await owner.activate(file).catch((error: unknown) => error)
  expect(failure).toMatchObject({ code: 'EEXIST', message: expect.stringMatching(/无法自动恢复.*备份.*compileHotReLoad/) })
  expect(await fs.readFile(journal, 'utf8')).toBe(source)
  expect(await fs.readFile(file, 'utf8')).toBe(original)
  await expect(owner.close()).rejects.toBe(failure)
})

it('refuses a live disk lease even when there is no in-memory owner', async () => {
  const { file, installed, saved, journal, owner } = await fixture()
  await writeClassicLease(file, saved, true)
  await fs.writeFile(file, installed)
  const before = await fs.readFile(journal, 'utf8')
  await expect(owner.activate(file)).rejects.toMatchObject({ code: 'EEXIST', message: expect.stringContaining('持有') })
  expect(await fs.readFile(journal, 'utf8')).toBe(before)
  expect(await fs.readFile(file, 'utf8')).toBe(installed)
})

it('publishes a complete journal and preserves a competing legacy wx acquisition', async () => {
  const { file, saved, journal } = await fixture()
  const competing = '{"owner":"legacy-competitor"}'
  const link = fsNative.link.bind(fsNative)
  vi.spyOn(fsNative, 'link').mockImplementation(async (source, target) => {
    if (target === journal) {
      expect(JSON.parse(await fs.readFile(source, 'utf8'))).toEqual(saved)
      await fs.writeFile(journal, competing, { flag: 'wx' })
    }
    await link(source, target)
  })
  await expect(writeClassicLease(file, saved, true)).rejects.toMatchObject({ code: 'EEXIST', message: expect.stringContaining('持有') })
  expect(await fs.readFile(journal, 'utf8')).toBe(competing)
})

it('never truncates a previous journal when replacement fails before rename', async () => {
  const { file, saved, journal } = await fixture()
  await writeClassicLease(file, saved, true)
  const before = await fs.readFile(journal, 'utf8')
  const failure = new Error('replacement interrupted')
  const rename = fsNative.rename.bind(fsNative)
  vi.spyOn(fsNative, 'rename').mockImplementation(async (source, target) => {
    if (target === journal) {
      expect(await readClassicLease(file)).toEqual(saved)
      throw failure
    }
    await rename(source, target)
  })
  await expect(writeClassicLease(file, { ...saved, original: '{}' })).rejects.toBe(failure)
  expect(await fs.readFile(journal, 'utf8')).toBe(before)
  expect((await fs.readdir(path.dirname(journal))).filter(name => name.endsWith('.tmp'))).toEqual([])
})

it('keeps complete user bytes when an installed-config rename is interrupted', async () => {
  const { file, original, installed } = await fixture()
  const failure = new Error('config publication interrupted')
  const rename = fsNative.rename.bind(fsNative)
  vi.spyOn(fsNative, 'rename').mockImplementation(async (source, target) => {
    if (target === file) {
      expect(await fs.readFile(file, 'utf8')).toBe(original)
      expect(await fs.readFile(source, 'utf8')).toBe(installed)
      throw failure
    }
    await rename(source, target)
  })
  await expect(writeClassicIdeConfig(file, installed)).rejects.toBe(failure)
  expect(await fs.readFile(file, 'utf8')).toBe(original)
})
