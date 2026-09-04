import type { TestJsFormat } from '../utils/jsFormat'
import { fs } from '@weapp-core/shared/node'
import { describe, expect, it } from 'vitest'
import { resolvePlatformMatrix } from '../utils/platform-matrix'
import {
  buildWevuJsxApp,
  collectGeneratedScripts,
  resolveWevuJsxPageOutput,
  WEVU_JSX_DIST_ROOT,
} from '../utils/wevu-jsx-tsx'

const PLATFORM_CASES = [
  { directive: 'wx:for', format: 'esm' as TestJsFormat, platform: 'weapp' as const },
  { directive: 'wx:for', format: 'cjs' as TestJsFormat, platform: 'weapp' as const },
  { directive: 'a:for', format: undefined, platform: 'alipay' as const },
  { directive: 'tt:for', format: undefined, platform: 'tt' as const },
]

const enabledPlatforms = resolvePlatformMatrix(['weapp', 'alipay', 'tt'], {
  localDefault: 'weapp',
})
const enabledCases = PLATFORM_CASES.filter(item => enabledPlatforms.includes(item.platform))

describe('wevu JSX/TSX build outputs', { concurrent: false }, () => {
  it.each(enabledCases)('builds $platform $format JSX/TSX outputs', async ({ directive, format, platform }) => {
    await buildWevuJsxApp(platform, format)

    const appConfig = JSON.parse(await fs.readFile(`${WEVU_JSX_DIST_ROOT}/app.json`, 'utf8')) as {
      pages: string[]
    }
    expect(appConfig.pages).toEqual(expect.arrayContaining([
      'pages/jsx-basic/index',
      'pages/tsx-basic/index',
      'pages/vue-tsx/index',
      'pages/setup-render/index',
      'pages/sfc-script-jsx/index',
      'pages/sfc-script-setup-tsx/index',
    ]))

    const tsxOutput = resolveWevuJsxPageOutput('pages/tsx-basic/index', platform)
    const setupOutput = resolveWevuJsxPageOutput('pages/setup-render/index', platform)
    const sfcJsxOutput = resolveWevuJsxPageOutput('pages/sfc-script-jsx/index', platform)
    const sfcSetupOutput = resolveWevuJsxPageOutput('pages/sfc-script-setup-tsx/index', platform)
    const [tsxTemplate, tsxScript, tsxConfig, setupTemplate, sfcJsxTemplate, sfcSetupScript] = await Promise.all([
      fs.readFile(tsxOutput.template, 'utf8'),
      fs.readFile(tsxOutput.script, 'utf8'),
      fs.readJSON(tsxOutput.config) as Promise<unknown>,
      fs.readFile(setupOutput.template, 'utf8'),
      fs.readFile(sfcJsxOutput.template, 'utf8'),
      fs.readFile(sfcSetupOutput.script, 'utf8'),
    ])

    expect(tsxTemplate).toContain(`${directive}="{{features}}"`)
    expect(tsxTemplate).toContain('data-wv-jsx-island="i0"')
    expect(tsxTemplate).toContain('template name="__wv_jsx_node"')
    expect(tsxTemplate).toContain('跨文件静态 JSX fragment')
    expect(tsxTemplate).toContain('跨文件参数化 JSX factory')
    expect(tsxScript).toContain('__wv_jsx_islands')
    expect(tsxScript).not.toContain('<view')
    expect(tsxConfig).toMatchObject({
      usingComponents: {
        'info-card': '/components/info-card/index',
      },
    })
    expect(setupTemplate).toContain('setup count:')
    expect(sfcJsxTemplate).toContain('SFC script JSX')
    expect(sfcSetupScript).toContain('setup-tsx-ready')
    expect(sfcSetupScript).not.toContain('<text')

    const scripts = await collectGeneratedScripts()
    expect(scripts.length).toBeGreaterThan(0)
    for (const generated of scripts) {
      expect(generated.code, generated.relativePath).not.toMatch(/\beval\s*\(/)
      expect(generated.code, generated.relativePath).not.toContain('new Function')
      expect(generated.code, generated.relativePath).not.toMatch(/\bfrom\s*["']vue["']/)
    }
  })
})
