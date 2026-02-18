import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
const BASE_APP_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/base')
const RUNTIME_APP_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/wevu-runtime-e2e')
const SUPPORTED_PLATFORMS = ['weapp', 'alipay', 'tt'] as const

type RuntimePlatform = typeof SUPPORTED_PLATFORMS[number]

const PLATFORM_TEMPLATE_EXT: Record<RuntimePlatform, string> = {
  weapp: 'wxml',
  alipay: 'axml',
  tt: 'ttml',
}

const PLATFORM_STYLE_EXT: Record<RuntimePlatform, string> = {
  weapp: 'wxss',
  alipay: 'acss',
  tt: 'ttss',
}

const PLATFORM_HELPER_EXT: Record<RuntimePlatform, string> = {
  weapp: 'wxs',
  alipay: 'sjs',
  tt: 'wxs',
}

function resolvePlatforms() {
  const selected = process.env.E2E_PLATFORM
  if (!selected) {
    return [...SUPPORTED_PLATFORMS]
  }
  if (!SUPPORTED_PLATFORMS.includes(selected as RuntimePlatform)) {
    throw new Error(`Unsupported E2E_PLATFORM: ${selected}. Supported: ${SUPPORTED_PLATFORMS.join(', ')}`)
  }
  return [selected as RuntimePlatform]
}

async function runBuild(root: string, platform: RuntimePlatform) {
  await execa('node', [CLI_PATH, 'build', root, '--platform', platform, '--skipNpm'], {
    stdio: 'inherit',
  })
}

const PLATFORM_LIST = resolvePlatforms()

describe.sequential('miniapp e2e smoke', () => {
  it.each(PLATFORM_LIST)('builds base app with %s template/script outputs', async (platform) => {
    const outputRoot = path.join(BASE_APP_ROOT, 'dist')
    await fs.remove(outputRoot)

    await runBuild(BASE_APP_ROOT, platform)

    const templateExt = PLATFORM_TEMPLATE_EXT[platform]
    const helperExt = PLATFORM_HELPER_EXT[platform]
    const templateFile = path.join(outputRoot, `pages/index/index.${templateExt}`)
    const scriptFile = path.join(outputRoot, `pages/index/utils.${helperExt}`)

    expect(await fs.pathExists(templateFile)).toBe(true)
    expect(await fs.pathExists(scriptFile)).toBe(true)

    const templateContent = await fs.readFile(templateFile, 'utf8')
    expect(templateContent).toContain(`./card.${templateExt}`)
    expect(templateContent).toContain('onTap')
    expect(templateContent).toContain(`./utils.${helperExt}`)
  })

  it.each(PLATFORM_LIST)('builds wevu runtime app with %s page assets', async (platform) => {
    const distRoot = path.join(RUNTIME_APP_ROOT, 'dist')
    await fs.remove(distRoot)

    await runBuild(RUNTIME_APP_ROOT, platform)

    const appJsonPath = path.join(distRoot, 'app.json')
    expect(await fs.pathExists(appJsonPath)).toBe(true)

    const appConfig = await fs.readJson(appJsonPath)
    const pages = Array.isArray(appConfig.pages) ? appConfig.pages : []
    expect(pages.length).toBeGreaterThan(0)

    const templateExt = PLATFORM_TEMPLATE_EXT[platform]
    const styleExt = PLATFORM_STYLE_EXT[platform]
    const helperExt = PLATFORM_HELPER_EXT[platform]
    const firstPage = pages[0]
    const pageTemplatePath = path.join(distRoot, `${firstPage}.${templateExt}`)
    const pageStylePath = path.join(distRoot, `${firstPage}.${styleExt}`)
    expect(await fs.pathExists(pageTemplatePath)).toBe(true)
    expect(await fs.pathExists(pageStylePath)).toBe(true)

    const runtimeHelperPath = path.join(distRoot, `__weapp_vite_class_style.${helperExt}`)
    const hasRuntimeHelper = await fs.pathExists(runtimeHelperPath)

    const styleMatrixTemplatePath = path.join(distRoot, `pages/style-matrix/index.${templateExt}`)
    expect(await fs.pathExists(styleMatrixTemplatePath)).toBe(true)

    const styleMatrixTemplateContent = await fs.readFile(styleMatrixTemplatePath, 'utf8')
    if (hasRuntimeHelper) {
      expect(styleMatrixTemplateContent).toContain(`__weapp_vite_class_style.${helperExt}`)
      return
    }

    expect(styleMatrixTemplateContent).toContain('__wv_style_')
    expect(styleMatrixTemplateContent).not.toContain(`__weapp_vite_class_style.${helperExt}`)
  })
})
