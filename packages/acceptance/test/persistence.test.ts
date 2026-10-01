import { mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { atomicJson } from '../src/persistence'

vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>()
  return { ...fs, rename: vi.fn(fs.rename) }
})
vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn() }))

let root: string
let file: string
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'acceptance-persistence-'))
  file = path.join(root, 'report.json')
  await writeFile(file, '{"status":"running"}')
})
afterEach(async () => {
  vi.mocked(rename).mockReset()
  vi.mocked(setTimeout).mockReset()
  await rm(root, { recursive: true, force: true })
})

it.each(['EPERM', 'EACCES', 'EBUSY'])('retries Windows %s with the same complete temporary report', async (code) => {
  const failure = Object.assign(new Error('temporary report lock'), { code })
  vi.mocked(rename).mockRejectedValueOnce(failure).mockRejectedValueOnce(failure)
  vi.mocked(setTimeout).mockImplementation(async () => {
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ status: 'running' })
    const [source] = vi.mocked(rename).mock.calls[0]!
    expect(JSON.parse(await readFile(source, 'utf8'))).toEqual({ status: 'passed' })
  })
  await atomicJson(file, { status: 'passed' }, 'win32')
  expect(rename).toHaveBeenCalledTimes(3)
  expect(vi.mocked(rename).mock.calls.every(call => call[0] === vi.mocked(rename).mock.calls[0]![0] && call[1] === file)).toBe(true)
  expect(vi.mocked(setTimeout).mock.calls).toEqual([[10], [20]])
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ status: 'passed' })
  expect(await readdir(root)).toEqual(['report.json'])
})

it('bounds persistent Windows locks without deleting the previous report', async () => {
  const failure = Object.assign(new Error('persistent lock'), { code: 'EPERM' })
  vi.mocked(rename).mockRejectedValue(failure)
  await expect(atomicJson(file, { status: 'passed' }, 'win32')).rejects.toBe(failure)
  expect(rename).toHaveBeenCalledTimes(21)
  expect(vi.mocked(setTimeout).mock.calls.reduce((total, [delay]) => total + (delay ?? 0), 0)).toBe(1550)
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ status: 'running' })
  const [source] = vi.mocked(rename).mock.calls[0]!
  expect(JSON.parse(await readFile(source, 'utf8'))).toEqual({ status: 'passed' })
})

it.each([['linux', 'EPERM'], ['darwin', 'EBUSY'], ['win32', 'ENOENT'], ['win32', 'EIO']] as const)(
  'does not retry %s %s',
  async (platform, code) => {
    const failure = Object.assign(new Error('publication failure'), { code })
    vi.mocked(rename).mockRejectedValue(failure)
    await expect(atomicJson(file, { status: 'passed' }, platform)).rejects.toBe(failure)
    expect(rename).toHaveBeenCalledTimes(1)
    expect(setTimeout).not.toHaveBeenCalled()
  },
)
