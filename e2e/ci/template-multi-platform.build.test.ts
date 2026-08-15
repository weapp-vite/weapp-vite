/* eslint-disable e18e/ban-dependencies -- 模板构建矩阵需要通过 CLI 验证真实多平台产物。 */
import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { BUILD_VERIFICATION_CAPABILITIES } from '../platforms/verification'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(
  import.meta.dirname,
  '../../templates/weapp-vite-multi-platform-template',
)

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

describe.sequential('multi-platform template build matrix', () => {
  it.each(BUILD_VERIFICATION_CAPABILITIES)(
    'builds the template for $id with stable platform semantics',
    async ({ id, expectation }) => {
      const {
        eventAttr,
        platform,
        projectConfigFile,
        scriptModuleExt,
        scriptModuleTag,
        styleExt,
        templateExt,
      } = expectation
      const projectRoot = path.join(TEMPLATE_ROOT, 'dist', platform)
      const outputRoot = path.join(projectRoot, 'dist')
      await fs.remove(projectRoot)

      await buildTemplate(platform)

      const pageRoot = path.join(outputRoot, 'pages/index/index')
      const template = await fs.readFile(`${pageRoot}.${templateExt}`, 'utf8')
      const pageScript = await fs.readFile(`${pageRoot}.js`, 'utf8')

      expect(await fs.pathExists(path.join(projectRoot, projectConfigFile))).toBe(true)
      expect(await fs.pathExists(`${pageRoot}.${styleExt}`)).toBe(true)
      expect(template).toContain(eventAttr)
      expect(template).toContain('platform-marker')
      expect(template).toContain('increment-button')
      expect(pageScript).toMatch(new RegExp(`platform:\\s*["']${id}["']`))

      if (scriptModuleExt && scriptModuleTag) {
        expect(await fs.pathExists(path.join(outputRoot, `pages/index/platform.${scriptModuleExt}`))).toBe(true)
        expect(template).toContain(scriptModuleTag)
        expect(template).toContain(`./platform.${scriptModuleExt}`)
      }
    },
  )
})
