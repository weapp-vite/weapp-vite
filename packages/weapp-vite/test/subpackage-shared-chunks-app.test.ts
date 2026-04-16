import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createCompilerContext } from '@/createContext'
import logger from '@/logger'
import { getApp } from './utils'

describe('subpackage-shared-chunks app', () => {
  const cwd = getApp('subpackage-shared-chunks')
  const distDir = path.resolve(cwd, 'dist')
  let ctx: Awaited<ReturnType<typeof createCompilerContext>> | undefined
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeAll(async () => {
    await fs.remove(distDir)
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    ctx = await createCompilerContext({
      cwd,
      inlineConfig: {
        build: {
          minify: false,
        },
      },
    })
    await ctx.buildService.build()
  }, 60000)

  afterAll(async () => {
    warnSpy.mockRestore()
    await ctx?.watcherService?.closeAll()
    ctx = undefined
    await fs.remove(distDir)
  })

  it('injects the valid shared component style into order subpackage outputs', async () => {
    const sharedStylePath = path.resolve(distDir, 'shared/styles/components.wxss')
    const orderComponentStylePath = path.resolve(distDir, 'packages/order/components/OrderMetrics/OrderMetrics.wxss')
    expect(await fs.pathExists(sharedStylePath)).toBe(true)

    const orderComponentStyle = await fs.readFile(orderComponentStylePath, 'utf8')

    expect(orderComponentStyle).toContain('@import \'../../styles/theme.wxss\';')
    expect(orderComponentStyle).toContain('@import \'../../../../shared/styles/components.wxss\';')
  })

  it('warns and skips the invalid shared style entry', () => {
    expect(warnSpy).toHaveBeenCalledWith(
      '[分包] 分包 packages/order 样式入口 `../shared/styles/components.scss` 对应文件不存在，已忽略。',
    )
  })
})
