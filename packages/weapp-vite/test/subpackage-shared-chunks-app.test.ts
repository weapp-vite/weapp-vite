import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { parse } from 'postcss'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createCompilerContext } from '@/createContext'
import logger from '@/logger'
import { getApp } from './utils'

describe.each([false, true])('subpackage-shared-chunks app (main style owner: %s)', (mainStyleOwner) => {
  const cwd = getApp('subpackage-shared-chunks')
  const distDir = path.resolve(cwd, 'dist')
  let ctx: Awaited<ReturnType<typeof createCompilerContext>> | undefined
  let warnSpy: ReturnType<typeof vi.spyOn>
  let warningMessages: unknown[]

  beforeAll(async () => {
    await fs.remove(distDir)
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    ctx = await createCompilerContext({
      cwd,
      inlineConfig: {
        weapp: {
          styles: mainStyleOwner ? { source: 'shared/styles/components.scss', scope: 'components' } : undefined,
        },
        build: {
          minify: false,
        },
      },
    })
    await ctx.buildService.build()
    warningMessages = warnSpy.mock.calls.map(([message]) => message)
  }, 60000)

  afterAll(async () => {
    warnSpy.mockRestore()
    await ctx?.watcherService?.closeAll()
    ctx = undefined
    await fs.remove(distDir)
  })

  it('publishes shared component styles only for the packages that own them', async () => {
    const sharedStylePath = path.resolve(distDir, 'shared/styles/components.wxss')
    const orderRoot = path.resolve(distDir, 'packages/order')
    const independentSharedStylePath = path.resolve(orderRoot, 'weapp-shared/shared/styles/components.wxss')
    const orderComponentStylePath = path.resolve(distDir, 'packages/order/components/OrderMetrics/OrderMetrics.wxss')
    // 示例默认只有独立分包声明该入口；文件位于 src/shared 不会自动赋予主包归属。
    expect(await fs.pathExists(sharedStylePath)).toBe(mainStyleOwner)
    expect(await fs.pathExists(independentSharedStylePath)).toBe(true)

    const orderComponentStyle = await fs.readFile(orderComponentStylePath, 'utf8')

    expect(orderComponentStyle).toContain('@import \'../../styles/theme.wxss\';')
    const sharedStyleImport = '../../weapp-shared/shared/styles/components.wxss'
    expect(orderComponentStyle).toContain(`@import '${sharedStyleImport}';`)
    expect(path.resolve(path.dirname(orderComponentStylePath), sharedStyleImport)).toBe(independentSharedStylePath)
    expect(await fs.pathExists(path.resolve(path.dirname(orderComponentStylePath), '../../styles/theme.wxss'))).toBe(true)

    const independentStyle = await fs.readFile(independentSharedStylePath, 'utf8')
    const rules: Record<string, Record<string, string>> = {}
    parse(independentStyle).walkRules((rule) => {
      const declarations = rules[rule.selector] ??= {}
      rule.walkDecls((declaration) => {
        declarations[declaration.prop] = declaration.value
      })
    })
    expect(rules).toMatchObject({
      '.weapp-card': { padding: '24rpx', margin: '16rpx' },
      '.weapp-card__title': { 'font-size': '32rpx', 'font-weight': '600' },
      '.weapp-card__desc': { 'margin-top': '12rpx', 'font-size': '26rpx' },
    })

    const mainComponentStylePath = path.resolve(distDir, 'components/HelloWorld/HelloWorld.wxss')
    const mainComponentStyle = await fs.readFile(mainComponentStylePath, 'utf8')
    if (mainStyleOwner) {
      const mainStyleImport = '../../shared/styles/components.wxss'
      expect(mainComponentStyle).toContain(`@import '${mainStyleImport}';`)
      expect(path.resolve(path.dirname(mainComponentStylePath), mainStyleImport)).toBe(sharedStylePath)
      expect(await fs.readFile(sharedStylePath, 'utf8')).toBe(independentStyle)
    }
    else {
      expect(mainComponentStyle).not.toContain('shared/styles/components.wxss')
    }
  })

  it('warns and skips the invalid shared style entry', () => {
    expect(warningMessages).toContain(
      '[分包] 分包 packages/order 样式入口 `../shared/styles/components.scss` 对应文件不存在，已忽略。',
    )
  })
})
