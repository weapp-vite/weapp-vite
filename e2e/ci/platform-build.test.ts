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

async function runBuild(root: string, platform: string) {
  await execa('node', [CLI_PATH, 'build', root, '--platform', platform, '--skipNpm'], {
    stdio: 'inherit',
  })
}

describe.sequential('platform build verification gate', () => {
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
})
