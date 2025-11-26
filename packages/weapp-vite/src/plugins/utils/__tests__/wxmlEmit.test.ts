import type { MutableCompilerContext } from '../../../context'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { createWxmlServicePlugin } from '../../../runtime/wxmlPlugin'
import { emitWxmlAssetsWithCache } from '../wxmlEmit'

function createMockCompiler(): MutableCompilerContext {
  const runtimeState = createRuntimeState()
  const ctx = {
    runtimeState,
  } as MutableCompilerContext

  const absoluteSrcRoot = '/project/src'
  ctx.configService = {
    absoluteSrcRoot,
    relativeAbsoluteSrcRoot: (p: string) => path.relative(absoluteSrcRoot, p) || '.',
    relativeCwd: (p: string) => p,
    weappViteConfig: {},
    relativeOutputPath(p: string) {
      const relative = path.relative(absoluteSrcRoot, p)
      return relative || '.'
    },
  } as unknown as MutableCompilerContext['configService']

  ctx.scanService = {
    isMainPackageFileName: () => true,
  } as unknown as MutableCompilerContext['scanService']

  createWxmlServicePlugin(ctx)
  return ctx
}

describe('emitWxmlAssetsWithCache', () => {
  let ctx: MutableCompilerContext
  const filePath = '/project/src/pages/index/index.wxml'

  beforeEach(() => {
    ctx = createMockCompiler()
    const token = ctx.wxmlService!.analyze('<view />')
    ctx.wxmlService!.tokenMap.set(filePath, token)
    ctx.wxmlService!.depsMap.set(filePath, new Set())
  })

  it('emits assets only when content changes', () => {
    const emittedCodeCache = ctx.runtimeState.wxml.emittedCode
    const addWatchFile = vi.fn()
    const emitFile = vi.fn()

    const result = emitWxmlAssetsWithCache({
      runtime: { addWatchFile, emitFile },
      compiler: ctx as any,
      emittedCodeCache,
    })

    expect(result).toEqual(['pages/index/index.wxml'])
    expect(emitFile).toHaveBeenCalledTimes(1)

    const second = emitWxmlAssetsWithCache({
      runtime: { addWatchFile, emitFile },
      compiler: ctx as any,
      emittedCodeCache,
    })

    expect(second).toEqual(['pages/index/index.wxml'])
    expect(emitFile).toHaveBeenCalledTimes(1)

    const updatedToken = ctx.wxmlService!.analyze('<view wx:if="true" />')
    ctx.wxmlService!.tokenMap.set(filePath, updatedToken)

    emitWxmlAssetsWithCache({
      runtime: { addWatchFile, emitFile },
      compiler: ctx as any,
      emittedCodeCache,
    })

    expect(emitFile).toHaveBeenCalledTimes(2)
  })
})
