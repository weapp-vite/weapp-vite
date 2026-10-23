import type { CompilerContext } from '../../context'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHost } from '../compilerPlugin/hmr'
import { observeCompilerInputs } from './sourceSnapshot'
import { createSfcResolveSrcOptions, readAndParseSfc, resolveSfcBlockSrc } from './vueSfc'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn<(file: string, options?: { checkMtime?: boolean }) => Promise<string>>(),
}))

vi.mock('wevu/compiler', async importOriginal => ({
  ...await importOriginal<typeof import('wevu/compiler')>(),
  readFile: mocks.readFile,
}))

const roots: string[] = []
const releases: Array<() => void> = []

afterEach(async () => {
  releases.splice(0).forEach(release => release())
  mocks.readFile.mockReset()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

it('preserves a resync rejection through real external template resolution without rolling back newer input', async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'sfc-resync-resolution-')))
  roots.push(root)
  const filename = path.join(root, 'page.vue')
  const file = path.join(root, 'template.html')
  const before = '<view>before</view>'
  const after = '<view>after</view>'
  await writeFile(file, before)
  const ctx = { configService: { isDev: true } } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  host.onDependencyChange = vi.fn()
  host.captureRaw(file, before)
  const observer = vi.fn()
  releases.push(observeCompilerInputs(ctx.configService, observer))
  const parsed = await readAndParseSfc(filename, { source: '<template src="./template.html"></template>' })
  expect(parsed.errors).toEqual([])

  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<string>()
  mocks.readFile.mockImplementationOnce(async () => {
    entered.resolve()
    return await release.promise
  })
  const resolving = resolveSfcBlockSrc(parsed.descriptor, filename, createSfcResolveSrcOptions({}, ctx.configService))
  const settled = resolving.then(() => undefined, (error: unknown) => error)
  try {
    await Promise.race([
      entered.promise,
      settled.then(() => {
        throw new Error('External template resolution completed before its delayed read checkpoint')
      }),
    ])
    await writeFile(file, after)
    host.captureRaw(file, after, false)
    release.resolve(before)
    const failure = await settled

    // 必须经过真实 block resolver 保留控制流错误，不能只验证 reader 本身拒绝。
    expect.soft(failure).toBeInstanceOf(CompilerHmrResyncError)
    expect.soft(failure).toMatchObject({ files: [compilerSourceId(file)] })
    expect(host.readSource(file)).toBe(after)
    expect(observer).not.toHaveBeenCalled()
    expect(mocks.readFile).toHaveBeenCalledExactlyOnceWith(file, { checkMtime: true })
  }
  finally {
    release.resolve(before)
    await settled
  }
})
