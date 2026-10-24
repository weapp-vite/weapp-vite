import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareDarwinInspector, verifyPreparedDarwinInspector } from './compiler'

const mocks = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.execute }))
vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return {
    ...actual,
    async lstat(...args: Parameters<typeof actual.lstat>) {
      const stat = await actual.lstat(...args)
      if (process.platform !== 'win32' || typeof stat.mode !== 'number') {
        return stat
      }
      // Windows 临时文件模拟 Darwin 权限观察；生产校验没有平台豁免。
      return Object.create(stat, { mode: { value: (stat.mode & ~0o6022) | 0o100 } }) as typeof stat
    },
  }
})
let root: string
let compiler: string
let sdk: string
let builds: number
beforeEach(async () => {
  vi.resetAllMocks()
  root = await fs.mkdtemp(path.join(tmpdir(), 'darwin-inspector-cache-'))
  compiler = path.join(root, 'fixture-compiler')
  sdk = path.join(root, 'fixture-sdk')
  await fs.writeFile(compiler, 'fixture compiler', { mode: 0o700 })
  await fs.mkdir(sdk)
  builds = 0
  mocks.execute.mockImplementation(async (command: string, args: string[]) => {
    let stdout = ''
    if (command === '/usr/bin/xcrun') {
      if (args.includes('--find')) {
        stdout = compiler
      }
      else if (args.includes('--show-sdk-path')) {
        stdout = sdk
      }
      else if (args.includes('--show-sdk-build-version')) {
        stdout = 'fixture-build'
      }
    }
    else if (args.includes('--version')) {
      stdout = 'fixture version'
    }
    else if (args.includes('-o')) {
      builds++
      await fs.writeFile(args[args.indexOf('-o') + 1]!, 'fixture binary')
    }
    return { stdout, stderr: '', exitCode: 0 }
  })
})
afterEach(async () => fs.rm(root, { recursive: true, force: true }))
const prepare = () => prepareDarwinInspector({ cacheRoot: path.join(root, 'cache'), platform: 'darwin' })

describe('SDK-bound Darwin helper cache', () => {
  it('publishes atomically and reuses verified source/compiler/SDK artifacts', async () => {
    const first = await prepare()
    const second = await prepare()
    expect(first).toEqual(second)
    expect(builds).toBe(1)
    expect((await fs.readdir(path.join(root, 'cache'))).filter(value => value.startsWith('.preparing-'))).toEqual([])
    expect((await fs.stat(first.executable)).mode & 0o6000).toBe(0)
    expect(await verifyPreparedDarwinInspector(first)).toEqual(first)
  })
  it('shares one atomic build while preparations overlap', async () => {
    const [first, second] = await Promise.all([prepare(), prepare()])
    expect(first).toEqual(second)
    expect(builds).toBe(1)
  })
  it('blocks binary or metadata corruption without silently compiling another source', async () => {
    const first = await prepare()
    await fs.writeFile(first.executable, 'changed binary')
    await expect(prepare()).rejects.toThrow(/binary hash/)
    expect(builds).toBe(1)
    await fs.writeFile(first.executable, 'fixture binary')
    await fs.appendFile(path.join(first.cacheDirectory, 'metadata.json'), ' ')
    await expect(prepare()).rejects.toThrow(/metadata hash/)
    expect(builds).toBe(1)
  })
  it('binds a changed compiler identity to a distinct cache entry', async () => {
    const first = await prepare()
    await fs.writeFile(compiler, 'different fixture compiler')
    const second = await prepare()
    expect(first.identityKey).not.toBe(second.identityKey)
    expect(builds).toBe(2)
  })
  it('reports missing toolchains and failed builds without a fallback executable', async () => {
    mocks.execute.mockResolvedValueOnce({ stdout: '', stderr: 'missing SDK', exitCode: 1 })
    await expect(prepare()).rejects.toThrow(/SDK and compiler/)
    expect(builds).toBe(0)
    mocks.execute.mockImplementation(async (command: string, args: string[]) => {
      if (command === '/usr/bin/xcrun') {
        return { stdout: args.includes('--find') ? compiler : args.includes('--show-sdk-path') ? sdk : 'fixture-build', exitCode: 0 }
      }
      if (args.includes('--version')) {
        return { stdout: 'fixture version', exitCode: 0 }
      }
      return { stdout: '', stderr: 'compile failed', exitCode: 1 }
    })
    await expect(prepare()).rejects.toThrow(/compilation failed/)
    expect((await fs.readdir(path.join(root, 'cache'))).filter(value => value.startsWith('.preparing-'))).toEqual([])
  })
})
