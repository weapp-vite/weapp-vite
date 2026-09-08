import type { CompilerContext } from '../../context'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTailwindcssPlugin } from '../tailwindcss'

const mocks = vi.hoisted(() => ({ createCompiler: vi.fn() }))
vi.mock('weapp-tailwindcss/core', () => ({ createCompiler: mocks.createCompiler }))

function handler(hook: any) {
  return typeof hook === 'function' ? hook : hook?.handler
}

describe('managed Tailwind compiler ownership', () => {
  let root: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'tailwind-owner-'))
    mocks.createCompiler.mockReset()
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  function setup(command: 'build' | 'serve', watch?: object) {
    let active = true
    const compiler = {
      createSnapshot: vi.fn(() => {
        if (!active) {
          throw new Error('Compiler has been disposed')
        }
        return { classSet: new Set<string>() }
      }),
      mergeSnapshots: vi.fn((snapshots: unknown[]) => snapshots[0]),
      invalidate: vi.fn(),
      dispose: vi.fn(async () => { active = false }),
    }
    mocks.createCompiler.mockReturnValue(compiler)
    const [manager, output] = createTailwindcssPlugin({
      configService: {
        absoluteSrcRoot: path.join(root, 'src'),
        cwd: root,
        isDev: true,
        outputExtensions: { wxss: 'wxss', wxml: 'wxml' },
        platform: 'weapp',
        weappViteConfig: { tailwindcss: { generator: false } },
      },
    } as unknown as CompilerContext)
    handler(manager!.configResolved)({ command, build: { watch } })
    return {
      compiler,
      generate: () => handler(output!.generateBundle).call({}, {}, {}, false),
      closeBundle: () => handler(output!.closeBundle)(),
      closeWatcher: () => handler(manager!.closeWatcher)(),
      buildEnd: (error?: Error) => handler(manager!.buildEnd)(error),
      invalidate: () => handler(manager!.watchChange)(path.join(root, 'src/page.wxml'), { event: 'update' }),
    }
  }

  it('releases each development snapshot at closeBundle without requiring closeWatcher', async () => {
    for (let index = 0; index < 3; index++) {
      const snapshot = setup('build')
      await snapshot.generate()
      await snapshot.buildEnd()
      expect(snapshot.compiler.dispose).not.toHaveBeenCalled()
      await snapshot.closeBundle()
      expect(snapshot.compiler.dispose).toHaveBeenCalledOnce()
      await expect(snapshot.generate()).rejects.toThrow('Compiler has been disposed')
    }
    expect(mocks.createCompiler).toHaveBeenCalledTimes(3)
  })

  it.each([
    ['build', {}],
    ['serve', undefined],
  ] as const)('retains the %s controller through repeated bundle completion', async (command, watch) => {
    const owner = setup(command, watch)
    for (let index = 0; index < 2; index++) {
      await owner.generate()
      await owner.buildEnd(new Error('recoverable watch failure'))
      await owner.closeBundle()
      await owner.invalidate()
    }
    expect(mocks.createCompiler).toHaveBeenCalledOnce()
    expect(owner.compiler.dispose).not.toHaveBeenCalled()
    expect(owner.compiler.invalidate).toHaveBeenCalledTimes(2)
    await owner.closeWatcher()
    await owner.closeBundle()
    expect(owner.compiler.dispose).toHaveBeenCalledOnce()
  })

  it('awaits the same disposal on failed snapshots and subsequent bundle closure', async () => {
    const owner = setup('build')
    await owner.generate()
    let finish!: () => void
    owner.compiler.dispose.mockImplementation(() => new Promise<void>((resolve) => {
      finish = resolve
    }))
    const failure = owner.buildEnd(new Error('snapshot failed'))
    let closed = false
    const closure = owner.closeBundle().then(() => {
      closed = true
    })
    await Promise.resolve()
    expect(closed).toBe(false)
    finish()
    await Promise.all([failure, closure])
    expect(closed).toBe(true)
    expect(owner.compiler.dispose).toHaveBeenCalledOnce()
  })

  it('does not load an unused compiler while closing a snapshot', async () => {
    const owner = setup('build')
    await owner.buildEnd(new Error('failed before Tailwind work'))
    await owner.closeBundle()
    expect(mocks.createCompiler).not.toHaveBeenCalled()
  })
})
