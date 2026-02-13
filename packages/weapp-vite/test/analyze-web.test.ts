import { describe, expect, it } from 'vitest'
import { createWebAnalyzeResult } from '@/cli/commands/analyze'
import { createTestCompilerContext, getApp } from './utils'

describe('analyze web static report', () => {
  it('returns web static analyze result when weapp.web is enabled', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd: getApp('weapp-vite-web-demo'),
      mode: 'production',
    })

    const result = createWebAnalyzeResult(ctx.configService, {
      platform: 'h5',
      now: new Date('2026-02-13T00:00:00.000Z'),
    })

    expect(result.runtime).toBe('web')
    expect(result.platform).toBe('h5')
    expect(result.generatedAt).toBe('2026-02-13T00:00:00.000Z')
    expect(result.experimental).toBe(true)
    expect(result.web.enabled).toBe(true)
    expect(result.web.root).toBe('.')
    expect(result.web.srcDir).toBe('src')
    expect(result.web.outDir).toBe('dist/web')
    expect(result.web.executionMode).toBe('compat')
    expect(result.supportedScopes.length).toBeGreaterThan(0)
    expect(result.unsupportedScopes.length).toBeGreaterThan(0)
    expect(result.limitations).toContain('当前仅提供静态配置分析，不执行 Web 产物扫描。')

    await dispose()
  })

  it('marks disabled state when weapp.web is not enabled', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd: getApp('weapp-vite-template'),
      mode: 'production',
    })

    const result = createWebAnalyzeResult(ctx.configService, {
      platform: 'h5',
      now: new Date('2026-02-13T00:00:00.000Z'),
    })

    expect(result.web.enabled).toBe(false)
    expect(result.web.root).toBeUndefined()
    expect(result.web.srcDir).toBeUndefined()
    expect(result.web.outDir).toBeUndefined()
    expect(result.web.executionMode).toBe('compat')
    expect(result.limitations).toContain('未检测到启用的 weapp.web 配置。')

    await dispose()
  })

  it('reads executionMode from web runtime config', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd: getApp('weapp-vite-web-demo'),
      mode: 'production',
      inlineConfig: {
        weapp: {
          web: {
            pluginOptions: {
              runtime: {
                executionMode: 'safe',
              },
            },
          },
        },
      },
    })

    const result = createWebAnalyzeResult(ctx.configService, {
      platform: 'h5',
      now: new Date('2026-02-13T00:00:00.000Z'),
    })

    expect(result.web.executionMode).toBe('safe')

    await dispose()
  })
})
