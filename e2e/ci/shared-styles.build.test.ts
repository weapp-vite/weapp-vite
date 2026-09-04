/* eslint-disable e18e/ban-dependencies -- e2e 测试需要 execa 驱动 CLI 构建。 */
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { BUILD_VERIFICATION_CAPABILITIES } from '../platforms/verification'
import { sanitizeBuildCommandEnv } from '../utils/buildLog'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const CLI_PATH = path.join(REPO_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.join(
  REPO_ROOT,
  'test/fixture-projects/weapp-vite/subPackages-shared-styles',
)

describe('main-package shared styles build e2e', { concurrent: false }, () => {
  it.each(BUILD_VERIFICATION_CAPABILITIES)(
    'emits and injects shared style entries for $id',
    async ({ id, expectation: { platform, styleExt } }) => {
      const outDirName = `dist-platform-${id}`
      const outDir = path.join(APP_ROOT, outDirName)
      await fs.remove(outDir)

      try {
        const result = await execa('node', [
          CLI_PATH,
          'build',
          APP_ROOT,
          '--platform',
          platform,
          '--skipNpm',
        ], {
          cwd: APP_ROOT,
          extendEnv: false,
          env: {
            ...sanitizeBuildCommandEnv(),
            WEAPP_SHARED_STYLES_OUT_DIR: outDirName,
          },
          reject: false,
          timeout: 120_000,
        })
        expect(result.exitCode, result.stderr || result.stdout).toBe(0)

        const mainPageStyle = await fs.readFile(
          path.join(outDir, `pages/index/index.${styleExt}`),
          'utf8',
        )
        const mainComponentStyle = await fs.readFile(
          path.join(outDir, `components/main-card/index.${styleExt}`),
          'utf8',
        )
        const normalPageStyle = await fs.readFile(
          path.join(outDir, `packageA/pages/foo/index.${styleExt}`),
          'utf8',
        )
        const mainComponentJson = await fs.readJSON(
          path.join(outDir, 'components/main-card/index.json'),
        ) as { component?: boolean }
        const normalComponentJson = await fs.readJSON(
          path.join(outDir, 'packageA/components/card/index.json'),
        ) as { component?: boolean }
        const independentPageStyle = await fs.readFile(
          path.join(outDir, `packageB/pages/bar/index.${styleExt}`),
          'utf8',
        )

        expect(mainPageStyle).toContain(`@import '../../styles/main.${styleExt}';`)
        expect(mainPageStyle).toContain(`@import '../../styles/pages.${styleExt}';`)
        expect(mainPageStyle).not.toContain(`styles/components.${styleExt}`)
        expect(mainPageStyle).not.toContain(`styles/manual.${styleExt}`)
        expect(mainComponentStyle).toContain(`@import '../../styles/main.${styleExt}';`)
        expect(mainComponentStyle).toContain(`@import '../../styles/components.${styleExt}';`)
        expect(mainComponentStyle).not.toContain(`styles/pages.${styleExt}`)
        expect(mainComponentJson.component).toBe(true)
        expect(normalPageStyle).toContain(`@import '../../../styles/main.${styleExt}';`)
        expect(normalPageStyle).toContain(`@import '../../../styles/pages.${styleExt}';`)
        expect(normalComponentJson.component).toBe(true)
        if (id === 'weapp') {
          expect(independentPageStyle).not.toContain(`styles/main.${styleExt}`)
          expect(independentPageStyle).not.toContain(`styles/manual.${styleExt}`)
        }

        await expect(fs.pathExists(path.join(outDir, `styles/main.${styleExt}`))).resolves.toBe(true)
        await expect(fs.pathExists(path.join(outDir, `styles/pages.${styleExt}`))).resolves.toBe(true)
        await expect(fs.pathExists(path.join(outDir, `styles/components.${styleExt}`))).resolves.toBe(true)
        await expect(fs.pathExists(path.join(outDir, `styles/manual.${styleExt}`))).resolves.toBe(true)

        const appStyle = await fs.readFile(path.join(outDir, `app.${styleExt}`), 'utf8')
        expect(appStyle).not.toContain(`styles/main.${styleExt}`)
      }
      finally {
        await fs.remove(outDir)
      }
    },
    180_000,
  )
})
