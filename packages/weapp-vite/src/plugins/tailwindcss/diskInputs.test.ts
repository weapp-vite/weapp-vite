import type { CompilerGenerateResult } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../context'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { getHmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
import { CompilerHmrResyncError } from '../compilerPlugin/hmr'
import { compilerNativeScriptVersion, observeCompilerInputs } from '../utils/sourceSnapshot'
import { captureTailwindDiskInputs } from './diskInputs'

async function fixture(run: (ctx: CompilerContext, file: string, root: string) => Promise<void>) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-disk-input-')))
  const file = path.join(root, 'new-source.ts')
  const ctx = { configService: { outDir: path.join(root, 'dist'), isDev: true } } as CompilerContext
  try {
    await writeFile(file, 'export const utility = "h-[23px]"')
    getHmrRuntimeSession(ctx).sourcePublication.observe({
      root: ctx.configService.outDir,
      file,
      event: 'create',
      version: compilerNativeScriptVersion('export const utility = "h-[23px]"'),
      eventId: 'source-added',
      receivedAtMs: performance.now(),
    })
    await run(ctx, file, root)
  }
  finally {
    getHmrRuntimeSession(ctx).sourcePublication.close()
    await rm(root, { recursive: true, force: true })
  }
}

function generated(root: string, pattern = '*.ts') {
  return { sources: [{ base: root, pattern, negated: false }] } as CompilerGenerateResult
}

it('confirms an unchanged new content source against the actual generated scanning scope', async () => {
  await fixture(async (ctx, file, root) => {
    const observer = vi.fn()
    const stop = observeCompilerInputs(ctx.configService, observer)
    try {
      const confirm = captureTailwindDiskInputs(ctx)
      expect(observer).not.toHaveBeenCalled()
      await confirm(generated(root))
      expect(observer).toHaveBeenCalledExactlyOnceWith(file.replaceAll('\\', '/'), 'export const utility = "h-[23px]"')
    }
    finally {
      stop()
    }
  })
})

it.each(['changed', 'deleted', 'ABA'] as const)('rejects %s content during disk generation before recording delivery', async (change) => {
  await fixture(async (ctx, file, root) => {
    const observer = vi.fn()
    const stop = observeCompilerInputs(ctx.configService, observer)
    try {
      const confirm = captureTailwindDiskInputs(ctx)
      if (change === 'deleted') {
        await rm(file)
      }
      else {
        await writeFile(file, 'export const utility = "h-[31px]"')
        if (change === 'ABA') {
          await writeFile(file, 'export const utility = "h-[23px]"')
        }
      }
      await expect(confirm(generated(root))).rejects.toBeInstanceOf(CompilerHmrResyncError)
      expect(observer).not.toHaveBeenCalled()
    }
    finally {
      stop()
    }
  })
})

it('does not confirm a pending source outside the generated scope', async () => {
  await fixture(async (ctx, _file, root) => {
    const observer = vi.fn()
    const stop = observeCompilerInputs(ctx.configService, observer)
    try {
      await captureTailwindDiskInputs(ctx)(generated(root, '*.vue'))
      expect(observer).not.toHaveBeenCalled()
    }
    finally {
      stop()
    }
  })
})
