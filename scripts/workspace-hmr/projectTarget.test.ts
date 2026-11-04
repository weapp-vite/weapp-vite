import type { InlineConfig } from 'vite'
import path from 'node:path'
import { getMiniProgramPlatformDescriptor, getSupportedMiniProgramPlatforms } from '@weapp-core/shared'
import { describe, expect, it } from 'vitest'
import { isWorkspaceHmrStylesheetOutput, readWorkspaceHmrProjectTarget, resolveWorkspaceHmrProjectTarget, selectWorkspaceHmrSourceFiles, WORKSPACE_HMR_TARGET_PREFIX, workspaceHmrSidecarExtensions } from './projectTarget'

describe('workspace HMR project target', () => {
  it.each(['weapp', 'tt', 'alipay', 'swan', 'xhs', 'jd'] as const)('keeps the configured %s target without guessing from project metadata', (platform) => {
    expect(resolveWorkspaceHmrProjectTarget({ weapp: { platform } })).toBe(platform)
  })

  it('uses the shared default only when no target is configured and normalizes aliases', () => {
    expect(resolveWorkspaceHmrProjectTarget({})).toBe('weapp')
    expect(resolveWorkspaceHmrProjectTarget({ weapp: { platform: 'wechat' } } as unknown as InlineConfig)).toBe('weapp')
  })

  it('selects one supported target while preserving multi-platform validation', () => {
    expect(resolveWorkspaceHmrProjectTarget({ weapp: { multiPlatform: { targets: ['weapp', 'alipay', 'tt'] } } })).toBe('weapp')
    expect(resolveWorkspaceHmrProjectTarget({ weapp: { platform: 'tt', multiPlatform: { targets: ['weapp', 'tt'] } } })).toBe('tt')
    expect(() => resolveWorkspaceHmrProjectTarget({ weapp: { multiPlatform: { targets: ['alipay', 'tt'] } } })).toThrow('weapp is not included')
    expect(() => resolveWorkspaceHmrProjectTarget({ weapp: { multiPlatform: { targets: [] } } })).toThrow('至少需要包含一个目标平台')
  })

  it.each(['unknown', 'web', null, ''])('rejects unsupported target %s without a fallback', (platform) => {
    expect(() => resolveWorkspaceHmrProjectTarget({ weapp: { platform } } as unknown as InlineConfig)).toThrow('unsupported mini-program target')
  })
})

describe('workspace HMR managed project receipt', () => {
  const identity = { id: 'current-wrapper', pid: 123 }
  const receipt = { ...identity, platform: 'tt', distRoot: path.resolve('output/tt') }
  const line = (value: unknown) => `${WORKSPACE_HMR_TARGET_PREFIX}${JSON.stringify(value)}\n`

  it('accepts one current canonical target and the actual absolute output root', () => {
    expect(readWorkspaceHmrProjectTarget(`dev output\r\n${line(receipt)}done`, identity)).toEqual({ platform: 'tt', distRoot: receipt.distRoot })
    expect(readWorkspaceHmrProjectTarget('unrelated output', identity)).toBeUndefined()
  })

  it.each([
    { ...receipt, id: 'previous-wrapper' },
    { ...receipt, pid: 456 },
    { ...receipt, platform: 'wechat' },
    { ...receipt, platform: 'web' },
    { ...receipt, distRoot: 'relative/dist' },
  ])('rejects stale or invalid receipt %#', (value) => {
    expect(() => readWorkspaceHmrProjectTarget(line(value), identity)).toThrow('does not match')
  })

  it('rejects duplicate receipts including a changed target', () => {
    expect(() => readWorkspaceHmrProjectTarget(line(receipt).repeat(2), identity)).toThrow('duplicate')
    expect(() => readWorkspaceHmrProjectTarget(line(receipt) + line({ ...receipt, platform: 'weapp' }), identity)).toThrow('duplicate')
  })
})

describe('workspace HMR source and output extensions', () => {
  it.each(getSupportedMiniProgramPlatforms())('chooses the actual native sidecars and stylesheet output for %s', (platform) => {
    const { wxml, wxss } = getMiniProgramPlatformDescriptor(platform).outputExtensions
    const templates = ['pages/index.html', 'pages/index.wxml', `pages/index.${wxml}`, 'pages/other.html']
    const styles = ['pages/index.css', 'pages/index.wxss', 'pages/index.scss', `pages/index.${wxss}`, 'pages/other.less']
    expect(selectWorkspaceHmrSourceFiles([...new Set(templates)], platform, 'template')).toEqual([`pages/index.${wxml}`, 'pages/other.html'])
    expect(selectWorkspaceHmrSourceFiles([...new Set(styles)], platform, 'style')).toEqual([`pages/index.${wxss}`, 'pages/other.less'])
    expect(workspaceHmrSidecarExtensions(platform)).toContain(wxml)
    expect(isWorkspaceHmrStylesheetOutput(`pages/index.${wxss}`)).toBe(true)
    expect(isWorkspaceHmrStylesheetOutput(`pages/index.${wxml}`)).toBe(false)
  })

  it('preserves entry ranking while selecting portable fallbacks in formal extension order', () => {
    const files = ['pages/index.scss', 'pages/index.css', 'pages/home.less', 'pages/home.sass', 'pages/detail.styl', 'other/index.js']
    expect(selectWorkspaceHmrSourceFiles(files, 'tt', 'style')).toEqual(['pages/index.css', 'pages/home.less', 'pages/detail.styl'])
    expect(selectWorkspaceHmrSourceFiles(['pages/index.html', 'pages/index.wxml'], 'tt', 'template')).toEqual(['pages/index.wxml'])
  })
})
