import type { ResolvedConfig } from 'vite'
import type { CompilerContext } from '../../../context'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { css } from '../../css'

const preprocess = vi.hoisted(() => vi.fn())
vi.mock('vite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vite')>()
  return { ...actual, preprocessCSS: preprocess }
})

function invoke(hook: unknown, context: unknown, ...args: unknown[]) {
  const candidate = typeof hook === 'function' ? hook : (hook as { handler?: unknown } | undefined)?.handler
  return (candidate as ((...args: unknown[]) => unknown) | undefined)?.apply(context, args)
}

it.each(['preprocessor', 'inventory'] as const)('reports the original %s failure after ordinary Vite buildEnd cleanup', async (failure) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-style-error-hooks-'))
  try {
    const file = path.join(root, 'page.less')
    await writeFile(file, '.page{}')
    const original = new Error(`${failure} failed`)
    const ctx = {
      configService: { cwd: root },
      runtimeState: { css: { sidecarImports: new Set([file]), transformedSidecarSource: new Map() } },
    } as unknown as CompilerContext
    const hook = {
      environment: {},
      getModuleIds() {
        if (failure === 'inventory') {
          throw original
        }
        return []
      },
    }
    const [prepare, assert] = css(ctx)
    expect(prepare!.buildEnd).toMatchObject({ order: 'pre', sequential: true })
    expect(assert!.buildEnd).toMatchObject({ order: 'post', sequential: true })
    await invoke(prepare!.configResolved, hook, {} as ResolvedConfig)
    await invoke(prepare!.buildStart, hook)
    preprocess.mockRejectedValue(original)
    await invoke(prepare!.buildEnd, hook)
    const cleaned = vi.fn()
    // 普通 Vite buildEnd 位于 pre 准备与 post 断言之间，不能被准备错误截断。
    cleaned()
    expect(() => invoke(assert!.buildEnd, hook)).toThrow(original)
    expect(cleaned).toHaveBeenCalledTimes(1)
  }
  finally {
    preprocess.mockReset()
    await rm(root, { recursive: true, force: true })
  }
})
