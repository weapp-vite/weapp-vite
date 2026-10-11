import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { setImmediate } from 'node:timers/promises'
import path from 'pathe'
import { beforeEach, expect, it, vi } from 'vitest'
import { captureSnapshotInputs } from './snapshotInputs'

const filesystem = vi.hoisted(() => ({
  lstat: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
  realpath: vi.fn(),
}))

vi.mock('node:fs/promises', () => filesystem)

const root = path.join(tmpdir(), `snapshot-input-concurrency-${randomUUID()}`)
const source = path.join(root, 'index.js')
const scope = { roots: [root], files: [source], excluded: [] }

beforeEach(() => {
  vi.resetAllMocks()
  filesystem.realpath.mockImplementation(async file => file)
  filesystem.lstat.mockImplementation(async file => ({
    isDirectory: () => file === root,
    isSymbolicLink: () => false,
  }))
  filesystem.readdir.mockResolvedValue(['index.js'])
  filesystem.readFile.mockResolvedValue(Buffer.from('before'))
})

it('shares an in-flight file visit between a source root and explicit dependencies', async () => {
  const reading = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  filesystem.readdir.mockImplementation(async () => {
    await reading.promise
    return ['index.js']
  })
  filesystem.readFile.mockImplementation(async () => {
    reading.resolve()
    await release.promise
    return Buffer.from('before')
  })
  const capture = captureSnapshotInputs(scope)
  await reading.promise
  // 所有目录访问均为内存中的已完成 Promise；推进一轮事件循环让递归访问抵达同一文件。
  await setImmediate()
  release.resolve()
  const inputs = await capture

  expect(filesystem.readFile).toHaveBeenCalledOnce()
  expect(filesystem.lstat.mock.calls.filter(([file]) => file === source)).toHaveLength(1)
  expect(inputs.versions.has(source)).toBe(true)
  expect(inputs.versions.get(root)).toBe('directory:["index.js"]')
})

it('shares file content through aliases only within one capture', async () => {
  const alias = path.join(root, 'alias.js')
  filesystem.realpath.mockImplementation(async file => file === alias ? source : file)
  filesystem.lstat.mockImplementation(async file => ({
    isDirectory: () => false,
    isSymbolicLink: () => file === alias,
  }))
  const aliasScope = { roots: [], files: [source, alias], excluded: [] }
  const initial = await captureSnapshotInputs(aliasScope)
  expect(filesystem.readFile).toHaveBeenCalledOnce()
  expect(initial.versions.get(alias)).toBe(initial.versions.get(source))

  filesystem.readFile.mockResolvedValue(Buffer.from('after'))
  const updated = await captureSnapshotInputs(aliasScope)
  expect(filesystem.readFile).toHaveBeenCalledTimes(2)
  expect(updated.versions.get(alias)).toBe(updated.versions.get(source))
  expect(updated.versions.get(source)).not.toBe(initial.versions.get(source))
})

it('releases failed reads so the next capture can observe repaired inputs', async () => {
  const alias = path.join(root, 'alias.js')
  filesystem.realpath.mockImplementation(async file => file === alias ? source : file)
  filesystem.lstat.mockImplementation(async file => ({
    isDirectory: () => false,
    isSymbolicLink: () => file === alias,
  }))
  const failure = Object.assign(new Error('input read failed'), { code: 'EIO' })
  const aliasScope = { roots: [], files: [source, alias], excluded: [] }
  filesystem.readFile.mockRejectedValue(failure)
  await expect(captureSnapshotInputs(aliasScope)).rejects.toBe(failure)
  // 失败采集的其余并行分支也必须完成，不能把它们算到下一次读取。
  await setImmediate()
  expect(filesystem.readFile).toHaveBeenCalledOnce()

  filesystem.readFile.mockResolvedValue(Buffer.from('repaired'))
  const repaired = await captureSnapshotInputs(aliasScope)
  expect(filesystem.readFile).toHaveBeenCalledTimes(2)
  expect(repaired.versions.get(alias)).toBe(repaired.versions.get(source))
})

it('keeps recursive directory cycles finite while explicit dependencies overlap', async () => {
  const loop = path.join(root, 'loop')
  filesystem.realpath.mockImplementation(async file => file === loop ? root : file)
  filesystem.lstat.mockImplementation(async file => ({
    isDirectory: () => file === root,
    isSymbolicLink: () => file === loop,
  }))
  filesystem.readdir.mockResolvedValue(['index.js', 'loop'])
  const inputs = await captureSnapshotInputs(scope)

  expect(inputs.versions.get(loop)).toBe(`cycle:${root}`)
  expect(inputs.versions.get(root)).toBe('directory:["index.js","loop"]')
  expect(filesystem.readdir).toHaveBeenCalledOnce()
  expect(filesystem.readFile).toHaveBeenCalledOnce()
})
