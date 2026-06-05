import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { waitForFileContains } from '../utils/hmr-helpers'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const CONFIG_MODULE_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/dist/config.mjs')
const TEMP_ROOT = path.resolve(import.meta.dirname, '../../.tmp')
const tempRoots: string[] = []

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function writeJson(target: string, value: Record<string, any>) {
  await fs.ensureDir(path.dirname(target))
  await fs.writeJson(target, value, { spaces: 2 })
}

async function writeText(target: string, source: string) {
  await fs.ensureDir(path.dirname(target))
  await fs.writeFile(target, source, 'utf8')
}

async function createBaseProject(label: string) {
  await fs.ensureDir(TEMP_ROOT)
  const root = await fs.mkdtemp(path.join(TEMP_ROOT, `${label}-`))
  tempRoots.push(root)

  await writeJson(path.join(root, 'package.json'), {
    name: `e2e-${label}`,
    private: true,
    type: 'module',
  })
  await writeJson(path.join(root, 'project.config.json'), {
    appid: 'wxb3d842a4a7e3440d',
    miniprogramRoot: 'dist',
  })
  await writeText(
    path.join(root, 'weapp-vite.config.ts'),
    [
      `import { defineConfig } from ${JSON.stringify(CONFIG_MODULE_PATH)}`,
      '',
      'export default defineConfig({',
      '  weapp: {',
      '    srcRoot: \'src\',',
      '  },',
      '})',
      '',
    ].join('\n'),
  )
  await writeText(path.join(root, 'src/pages/index/index.ts'), 'Page({})\n')
  await writeText(path.join(root, 'src/pages/index/index.wxml'), '<view>issue 649</view>\n')
  await writeText(path.join(root, 'src/pkgA/pages/detail/index.ts'), 'Page({})\n')
  await writeText(path.join(root, 'src/pkgA/pages/detail/index.wxml'), '<view>issue 649 subpackage</view>\n')

  return root
}

async function createAppVueProject() {
  const root = await createBaseProject('issue-649-app-vue')

  await writeText(
    path.join(root, 'src/app.vue'),
    [
      '<script setup lang="ts">',
      'defineAppJson({',
      '  pages: [\'pages/index/index\'],',
      '  subPackages: [{ root: \'pkgA\', pages: [\'pages/detail/index\'] }],',
      '})',
      '</script>',
      '',
      '<template>',
      '  <slot />',
      '</template>',
      '',
    ].join('\n'),
  )

  return root
}

async function createAppTsWithJsonTsProject() {
  const root = await createBaseProject('issue-649-app-ts-json-ts')

  await writeText(path.join(root, 'src/app.ts'), 'App({})\n')
  await writeText(
    path.join(root, 'src/app.json.ts'),
    [
      'export default {',
      '  pages: [\'pages/index/index\'],',
      '  subPackages: [{ root: \'pkgA\', pages: [\'pages/detail/index\'] }],',
      '}',
      '',
    ].join('\n'),
  )

  return root
}

async function createAppJsonProject() {
  const root = await createBaseProject('issue-649-config-restart')

  await writeText(
    path.join(root, 'weapp-vite.config.ts'),
    [
      `import { defineConfig } from ${JSON.stringify(CONFIG_MODULE_PATH)}`,
      '',
      'export default defineConfig({',
      '  define: { __ISSUE_649_CONFIG_RESTART__: JSON.stringify(\'issue-649-config-initial\') },',
      '  weapp: {',
      '    srcRoot: \'src\',',
      '  },',
      '})',
      '',
    ].join('\n'),
  )
  await writeText(path.join(root, 'src/app.ts'), 'App({})\n')
  await writeText(path.join(root, 'src/pages/index/index.ts'), 'Page({ data: { configMarker: __ISSUE_649_CONFIG_RESTART__ } })\n')
  await writeJson(path.join(root, 'src/app.json'), {
    pages: ['pages/index/index'],
    subPackages: [{ root: 'pkgA', pages: ['pages/detail/index'] }],
  })

  return root
}

async function buildProject(root: string, label: string) {
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: root,
    platform: 'weapp',
    cwd: root,
    label,
    skipNpm: true,
  })
}

async function expectAppJson(root: string) {
  const appJson = await fs.readJson(path.join(root, 'dist/app.json'))
  expect(appJson.pages).toEqual(['pages/index/index'])
  expect(appJson.subPackages).toEqual([
    {
      root: 'pkgA',
      pages: ['pages/detail/index'],
    },
  ])
}

afterAll(async () => {
  await cleanupResidualDevProcesses()
  await Promise.all(tempRoots.splice(0).map(root => fs.remove(root)))
})

describe.sequential('issue 649 entry config combinations', () => {
  it('builds when app.vue provides the app config', async () => {
    const root = await createAppVueProject()

    await buildProject(root, 'ci:issue-649:app-vue')

    expect(await fs.pathExists(path.join(root, 'dist/app.js'))).toBe(true)
    await expectAppJson(root)
  })

  it('builds when app.ts uses app.json.ts as the app config', async () => {
    const root = await createAppTsWithJsonTsProject()

    await buildProject(root, 'ci:issue-649:app-ts-json-ts')

    expect(await fs.pathExists(path.join(root, 'dist/app.js'))).toBe(true)
    await expectAppJson(root)
  })

  it('restarts dev watcher after config changes and keeps responding to later updates', async () => {
    await cleanupResidualDevProcesses()
    const root = await createAppJsonProject()
    const configPath = path.join(root, 'weapp-vite.config.ts')
    const pageWxmlPath = path.join(root, 'src/pages/index/index.wxml')
    const distPageJsPath = path.join(root, 'dist/pages/index/index.js')
    const distWxmlPath = path.join(root, 'dist/pages/index/index.wxml')

    await fs.remove(path.join(root, 'dist'))

    const devProcess = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', root, '--platform', 'weapp', '--skipNpm'], {
      env: createDevProcessEnv(),
      all: true,
    })

    try {
      await devProcess.waitFor(
        waitForFileContains(distWxmlPath, 'issue 649', 90_000),
        'issue 649 initial dev output',
      )
      await devProcess.waitFor(
        waitForFileContains(distPageJsPath, 'issue-649-config-initial', 90_000),
        'issue 649 initial config marker output',
      )
      await sleep(2_000)

      const originalConfig = await fs.readFile(configPath, 'utf8')
      const updatedConfig = originalConfig.replace('issue-649-config-initial', 'issue-649-config-changed')
      await fs.writeFile(configPath, updatedConfig, 'utf8')
      await devProcess.waitFor(
        waitForFileContains(distPageJsPath, 'issue-649-config-changed', 90_000),
        'issue 649 config restart marker output',
      )

      await fs.writeFile(pageWxmlPath, '<view>issue 649 after config restart</view>\n', 'utf8')
      await devProcess.waitFor(
        waitForFileContains(distWxmlPath, 'issue 649 after config restart', 90_000),
        'issue 649 post config restart dev output',
      )
    }
    finally {
      await devProcess.stop(2_000)
    }
  })
})
