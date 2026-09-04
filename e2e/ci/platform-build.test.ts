/* eslint-disable e18e/ban-dependencies -- e2e 测试需要 execa 驱动 CLI 构建。 */
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { BUILD_VERIFICATION_CAPABILITIES } from '../platforms/verification'
import { findWevuSemanticChunk } from '../utils/wevu-vendor'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const BASE_APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/base')
const WEVU_APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/wevu-runtime-e2e')
const ALIPAY_DEMO_ROOT = path.resolve(import.meta.dirname, '../../apps/alipay-antd-mini-demo')
const DOUYIN_DEMO_ROOT = path.resolve(import.meta.dirname, '../../apps/douyin-native-demo')

async function runBuild(root: string, platform: string, options: { skipNpm?: boolean } = {}) {
  const args = [CLI_PATH, 'build', root, '--platform', platform]
  if (options.skipNpm !== false) {
    args.push('--skipNpm')
  }
  await execa('node', args, {
    stdio: 'inherit',
  })
}

describe('platform build verification gate', { concurrent: false }, () => {
  it.each(BUILD_VERIFICATION_CAPABILITIES)('builds native base app for $id', async ({
    expectation: {
      platform,
      templateExt,
      styleExt,
      scriptModuleExt,
      eventAttr,
      scriptModuleTag,
      projectConfigFile,
    },
  }) => {
    const outputRoot = path.join(BASE_APP_ROOT, 'dist')
    await fs.remove(outputRoot)

    await runBuild(BASE_APP_ROOT, platform)

    const templateFile = path.join(outputRoot, `pages/index/index.${templateExt}`)
    const styleFile = path.join(outputRoot, `pages/index/index.${styleExt}`)
    const scriptFile = scriptModuleExt
      ? path.join(outputRoot, `pages/index/utils.${scriptModuleExt}`)
      : undefined

    expect(await fs.pathExists(templateFile)).toBe(true)
    expect(await fs.pathExists(styleFile)).toBe(true)
    expect(await fs.pathExists(path.join(BASE_APP_ROOT, projectConfigFile))).toBe(true)
    if (scriptFile) {
      expect(await fs.pathExists(scriptFile)).toBe(true)
    }

    const templateContent = await fs.readFile(templateFile, 'utf8')
    expect(templateContent).toContain(`./card.${templateExt}`)
    expect(templateContent).toContain(eventAttr)
    if (scriptModuleExt && scriptModuleTag) {
      expect(templateContent).toContain(scriptModuleTag)
      expect(templateContent).toContain(`./utils.${scriptModuleExt}`)
    }
  })

  it.each(BUILD_VERIFICATION_CAPABILITIES)('emits the $id runtime marker for wevu', async ({
    id,
    expectation: { platform, runtimeGlobal, styleExt, templateExt },
  }) => {
    const outputRoot = path.join(WEVU_APP_ROOT, 'dist')
    await fs.remove(outputRoot)

    await runBuild(WEVU_APP_ROOT, platform)

    const pageRoot = path.join(outputRoot, 'pages/style-matrix/index')
    expect(await fs.pathExists(`${pageRoot}.${templateExt}`)).toBe(true)
    expect(await fs.pathExists(`${pageRoot}.${styleExt}`)).toBe(true)

    const runtimeChunk = await findWevuSemanticChunk(
      outputRoot,
      code => code.includes('"MP_PLATFORM"') && code.includes(`"${platform}"`),
      `${platform} platform runtime`,
    )
    expect(runtimeChunk.code).toMatch(new RegExp(`["']MP_PLATFORM["']:\\s*["']${id}["']`))
    expect(runtimeChunk.code).toMatch(new RegExp(`\\.${runtimeGlobal}\\b|["']${runtimeGlobal}["']`))
  })

  it('builds the Alipay native, Vue SFC, SJS, and antd-mini integration', async () => {
    const outputRoot = path.join(ALIPAY_DEMO_ROOT, 'dist')
    await fs.remove(outputRoot)

    expect(await fs.pathExists(path.join(ALIPAY_DEMO_ROOT, 'src/pages/index/index.axml'))).toBe(true)
    expect(await fs.pathExists(path.join(ALIPAY_DEMO_ROOT, 'src/pages/index/index.acss'))).toBe(true)
    expect(await fs.pathExists(path.join(ALIPAY_DEMO_ROOT, 'src/pages/index/index.wxml'))).toBe(false)

    await runBuild(ALIPAY_DEMO_ROOT, 'alipay', { skipNpm: false })

    const nativeTemplate = await fs.readFile(path.join(outputRoot, 'pages/index/index.axml'), 'utf8')
    expect(nativeTemplate).toContain('<import-sjs from="./utils.sjs" name="util"')
    expect(nativeTemplate).toContain('onTap="openWevuPage"')
    expect(nativeTemplate).toContain('<native-counter')
    expect(nativeTemplate).toContain('onTap="openNativeSubpackage"')
    expect(nativeTemplate).toContain('<ant-button')
    const nativeSjs = await fs.readFile(path.join(outputRoot, 'pages/index/utils.sjs'), 'utf8')
    expect(nativeSjs).toContain('export default')
    expect(nativeSjs).not.toContain('module.exports')

    const nativeComponentTemplate = await fs.readFile(path.join(outputRoot, 'components/native-counter/index.axml'), 'utf8')
    const nativeComponentScript = await fs.readFile(path.join(outputRoot, 'components/native-counter/index.js'), 'utf8')
    expect(nativeComponentTemplate).toContain('onTap="increase"')
    expect(nativeComponentScript).toContain('deriveDataFromProps')
    expect(nativeComponentScript).toContain('didMount')

    const nativeSubpackageTemplate = await fs.readFile(path.join(outputRoot, 'package-native/pages/detail/index.axml'), 'utf8')
    expect(nativeSubpackageTemplate).toContain('a:if="{{ready}}"')
    expect(nativeSubpackageTemplate).toContain('原生支付宝分包页面')

    const vueTemplate = await fs.readFile(path.join(outputRoot, 'pages/wevu/index.axml'), 'utf8')
    const vueConfig = await fs.readJson(path.join(outputRoot, 'pages/wevu/index.json')) as {
      usingComponents?: Record<string, string>
    }
    expect(vueTemplate).toContain('onTap="__weapp_vite_inline"')
    expect(vueTemplate).toContain('a:if=')
    expect(vueConfig.usingComponents?.['ant-button']).toBe('/node_modules/antd-mini/es/Button/index')

    const antdButtonRoot = path.join(outputRoot, 'node_modules/antd-mini/es/Button')
    expect(await fs.pathExists(path.join(antdButtonRoot, 'index.axml'))).toBe(true)
    expect(await fs.pathExists(path.join(antdButtonRoot, 'index.acss'))).toBe(true)
    expect(await fs.pathExists(path.join(antdButtonRoot, 'index.sjs'))).toBe(true)

    const runtimeChunk = await findWevuSemanticChunk(
      outputRoot,
      code => code.includes('"MP_PLATFORM"') && code.includes('"alipay"'),
      'alipay demo runtime',
    )
    expect(runtimeChunk.code).toMatch(/["']MP_PLATFORM["']:\s*["']alipay["']/)
    expect(runtimeChunk.code).toMatch(/\?\.my\b|\.my\b|["']my["']/)
  })

  it('builds the Douyin native, Vue SFC, WXS, subpackage, and npm integration', async () => {
    const outputRoot = path.join(DOUYIN_DEMO_ROOT, 'dist')
    await fs.remove(outputRoot)

    expect(await fs.pathExists(path.join(DOUYIN_DEMO_ROOT, 'src/pages/index/index.ttml'))).toBe(true)
    expect(await fs.pathExists(path.join(DOUYIN_DEMO_ROOT, 'src/pages/index/index.ttss'))).toBe(true)
    expect(await fs.pathExists(path.join(DOUYIN_DEMO_ROOT, 'src/pages/index/index.wxml'))).toBe(false)

    await runBuild(DOUYIN_DEMO_ROOT, 'tt', { skipNpm: false })

    const nativeTemplate = await fs.readFile(path.join(outputRoot, 'pages/index/index.ttml'), 'utf8')
    expect(nativeTemplate).toContain('<wxs src="./utils.wxs" module="util"')
    expect(nativeTemplate).toContain('tt:if="{{nativeCount >= 1}}"')
    expect(nativeTemplate).toContain('bind:tap="openNativeSubpackage"')
    expect(nativeTemplate).toContain('<native-counter')
    expect(nativeTemplate).toContain('<douyin-native-card')
    expect(await fs.pathExists(path.join(outputRoot, 'pages/index/index.ttss'))).toBe(true)
    expect(await fs.pathExists(path.join(outputRoot, 'pages/index/index.wxml'))).toBe(false)
    expect(await fs.readFile(path.join(outputRoot, 'pages/index/utils.wxs'), 'utf8')).toContain('MP_PLATFORM=tt')

    expect(await fs.readFile(path.join(outputRoot, 'components/native-counter/index.ttml'), 'utf8')).toContain('bind:tap="increase"')
    expect(await fs.readFile(path.join(outputRoot, 'package-native/pages/detail/index.ttml'), 'utf8')).toContain('tt:if="{{ready}}"')

    const npmRoot = path.join(outputRoot, 'miniprogram_npm/douyin-native-card/card')
    expect(await fs.pathExists(path.join(npmRoot, 'index.ttml'))).toBe(true)
    expect(await fs.pathExists(path.join(npmRoot, 'index.ttss'))).toBe(true)
    expect(await fs.pathExists(path.join(npmRoot, 'label.wxs'))).toBe(true)

    const nativeConfig = await fs.readJson(path.join(outputRoot, 'pages/index/index.json')) as {
      usingComponents?: Record<string, string>
    }
    const vueConfig = await fs.readJson(path.join(outputRoot, 'pages/wevu/index.json')) as {
      usingComponents?: Record<string, string>
    }
    expect(nativeConfig.usingComponents?.['douyin-native-card']).toBe('/miniprogram_npm/douyin-native-card/card/index')
    expect(vueConfig.usingComponents?.['douyin-native-card']).toBe('/miniprogram_npm/douyin-native-card/card/index')

    const vueTemplate = await fs.readFile(path.join(outputRoot, 'pages/wevu/index.ttml'), 'utf8')
    expect(vueTemplate).toMatch(/bind:?tap="__weapp_vite_inline"/)
    expect(vueTemplate).toMatch(/bind:?confirm="__weapp_vite_inline"/)

    const runtimeChunk = await findWevuSemanticChunk(
      outputRoot,
      code => code.includes('"MP_PLATFORM"') && code.includes('"tt"'),
      'douyin demo runtime',
    )
    expect(runtimeChunk.code).toMatch(/["']MP_PLATFORM["']:\s*["']tt["']/)
    expect(runtimeChunk.code).toMatch(/\?\.tt\b|\.tt\b|["']tt["']/)
  })
})
