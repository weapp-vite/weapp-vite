/* eslint-disable e18e/ban-dependencies -- 模板构建矩阵需要通过 CLI 验证真实多平台 SFC 产物。 */
import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { BUILD_VERIFICATION_CAPABILITIES } from '../platforms/verification'
import { findWevuSemanticChunk } from '../utils/wevu-vendor'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(
  import.meta.dirname,
  '../../templates/weapp-vite-multi-platform-sfc-template',
)

interface AppConfig {
  pages?: string[]
}

interface ComponentConfig {
  component?: boolean
}

interface PageConfig {
  navigationBarTitleText?: string
  usingComponents?: Record<string, string>
}

async function buildTemplate(platform: string) {
  await execa(process.execPath, [
    CLI_PATH,
    'build',
    TEMPLATE_ROOT,
    '--platform',
    platform,
    '--skipNpm',
  ], {
    cwd: TEMPLATE_ROOT,
    stdio: 'inherit',
  })
}

describe.sequential('multi-platform SFC template build matrix', () => {
  it.each(BUILD_VERIFICATION_CAPABILITIES)(
    'builds the SFC template for $id with stable platform semantics',
    async ({ id, expectation }) => {
      const {
        eventAttr,
        platform,
        projectConfigFile,
        runtimeGlobal,
        styleExt,
        templateExt,
      } = expectation
      const projectRoot = path.join(TEMPLATE_ROOT, 'dist', platform)
      const outputRoot = path.join(projectRoot, 'dist')
      await fs.remove(projectRoot)

      await buildTemplate(platform)

      const pageRoot = path.join(outputRoot, 'pages/index/index')
      const componentRoot = path.join(outputRoot, 'components/PlatformCard/index')
      const [appConfig, pageConfig, componentConfig, pageTemplate, componentTemplate, pageScript] = await Promise.all([
        fs.readJson(path.join(outputRoot, 'app.json')) as Promise<AppConfig>,
        fs.readJson(`${pageRoot}.json`) as Promise<PageConfig>,
        fs.readJson(`${componentRoot}.json`) as Promise<ComponentConfig>,
        fs.readFile(`${pageRoot}.${templateExt}`, 'utf8'),
        fs.readFile(`${componentRoot}.${templateExt}`, 'utf8'),
        fs.readFile(`${pageRoot}.js`, 'utf8'),
      ])

      expect(await fs.pathExists(path.join(projectRoot, projectConfigFile))).toBe(true)
      expect(await fs.pathExists(`${pageRoot}.${styleExt}`)).toBe(true)
      expect(await fs.pathExists(`${componentRoot}.${styleExt}`)).toBe(true)
      expect(appConfig.pages).toEqual(['pages/index/index'])
      expect(pageConfig.navigationBarTitleText).toBe('多平台 SFC 模板')
      expect(pageConfig.usingComponents?.['platform-card']).toBe('/components/PlatformCard/index')
      expect(componentConfig.component).toBe(true)
      expect(pageTemplate).toContain(eventAttr.replace(':', ''))
      expect(pageTemplate).toContain('platform-marker')
      expect(pageTemplate).toContain('increment-button')
      expect(pageTemplate).toContain('<platform-card')
      expect(componentTemplate).toContain('platform-card')
      expect(componentTemplate).toContain('component-platform')
      expect(pageScript).toMatch(new RegExp(`platform\\s*=\\s*["']${id}["']`))

      const runtimeChunk = await findWevuSemanticChunk(
        outputRoot,
        code => code.includes('"MP_PLATFORM"') && code.includes(`"${platform}"`),
        `${platform} SFC template runtime`,
      )
      expect(runtimeChunk.code).toMatch(new RegExp(`["']MP_PLATFORM["']:\\s*["']${id}["']`))
      expect(runtimeChunk.code).toMatch(new RegExp(`\\.${runtimeGlobal}\\b|["']${runtimeGlobal}["']`))
    },
  )
})
