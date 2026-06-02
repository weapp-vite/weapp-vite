import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename } from '../utils/hmr-helpers'
import { CLI_PATH, waitForFile } from '../wevu-runtime.utils'

const TEMP_ROOT = path.resolve(import.meta.dirname, '../../.tmp/e2e/external-linked-vue-component-hmr')
const PROJECT_ROOT = path.join(TEMP_ROOT, 'app')
const DIST_ROOT = path.join(PROJECT_ROOT, 'dist')
const MONOREPO_BADGE = path.join(TEMP_ROOT, 'packages/monorepo-ui/MonorepoBadge.vue')
const LINK_BADGE_SOURCE_ROOT = path.join(TEMP_ROOT, 'packages/linked-ui')
const LINK_BADGE = path.join(LINK_BADGE_SOURCE_ROOT, 'LinkedBadge.vue')
const RESOLVER_BADGE = path.join(TEMP_ROOT, 'packages/resolver-ui/ResolverBadge.vue')
const SHARED_MESSAGE = path.join(TEMP_ROOT, 'packages/shared-state/message.ts')
const CONFIG_VALUE = path.join(TEMP_ROOT, 'config/config-values.ts')

function createComponentSource(className: string, marker: string) {
  return [
    '<script setup lang="ts">',
    'defineComponentJson({',
    '  component: true,',
    '})',
    '</script>',
    '',
    '<template>',
    `  <view class="${className}">`,
    `    ${marker}`,
    '  </view>',
    '</template>',
    '',
    '<style>',
    `.${className} {`,
    '  padding: 8rpx;',
    '}',
    '</style>',
    '',
  ].join('\n')
}

async function writeFixtureProject() {
  await fs.remove(TEMP_ROOT)
  await fs.ensureDir(path.join(PROJECT_ROOT, 'src/pages/index'))
  await fs.ensureDir(path.join(PROJECT_ROOT, 'node_modules/@e2e'))
  await fs.ensureDir(path.join(TEMP_ROOT, 'config'))
  await fs.ensureDir(path.join(TEMP_ROOT, 'packages/monorepo-ui'))
  await fs.ensureDir(LINK_BADGE_SOURCE_ROOT)
  await fs.ensureDir(path.dirname(RESOLVER_BADGE))
  await fs.ensureDir(path.dirname(SHARED_MESSAGE))

  await fs.writeJson(path.join(PROJECT_ROOT, 'package.json'), {
    name: 'external-linked-vue-component-hmr',
    type: 'module',
    dependencies: {
      '@e2e/linked-ui': 'workspace:*',
      'weapp-vite': 'workspace:*',
      'wevu': 'workspace:*',
    },
    devDependencies: {},
  }, { spaces: 2 })
  await fs.writeJson(path.join(PROJECT_ROOT, 'tsconfig.json'), {
    extends: './.weapp-vite/tsconfig.shared.json',
    compilerOptions: {
      types: [
        'miniprogram-api-typings',
      ],
    },
    include: [
      'src/**/*',
      '../packages/**/*.vue',
      '../packages/**/*.ts',
    ],
  }, { spaces: 2 })
  await fs.writeJson(path.join(TEMP_ROOT, 'tsconfig.json'), {
    extends: './app/.weapp-vite/tsconfig.shared.json',
    include: [
      'app/src/**/*',
      'packages/**/*.vue',
      'packages/**/*.ts',
    ],
  }, { spaces: 2 })
  await fs.writeFile(CONFIG_VALUE, 'export const configMarker = \'CONFIG-MARKER-V1\'\n', 'utf8')

  await fs.writeFile(path.join(PROJECT_ROOT, 'weapp-vite.config.ts'), [
    'import path from \'node:path\'',
    'import { fileURLToPath } from \'node:url\'',
    'import { defineConfig } from \'weapp-vite\'',
    'import { configMarker } from \'../config/config-values\'',
    '',
    'const projectRoot = path.dirname(fileURLToPath(import.meta.url))',
    '',
    'export default defineConfig({',
    '  weapp: {',
    '    srcRoot: \'src\',',
    '    hmr: {',
    '      logLevel: \'verbose\',',
    '    },',
    '    autoImportComponents: {',
    '      resolvers: [',
    '        {',
    '          resolve(componentName) {',
    '            if (componentName === \'ResolverBadge\') {',
    '              return {',
    '                name: componentName,',
    '                from: \'/__weapp_vite_external__/resolver-ui/ResolverBadge\',',
    '                resolvedId: path.join(projectRoot, \'../packages/resolver-ui/ResolverBadge.vue\'),',
    '              }',
    '            }',
    '          },',
    '        },',
    '      ],',
    '    },',
    '  },',
    '  define: {',
    '    __E2E_CONFIG_MARKER__: JSON.stringify(configMarker),',
    '  },',
    '  build: {',
    '    minify: false,',
    '    watch: {',
    '      include: [path.join(projectRoot, \'../packages/shared-state/**/*.ts\')],',
    '      buildDelay: 80,',
    '      chokidar: {',
    '        usePolling: true,',
    '        interval: 100,',
    '      },',
    '    },',
    '    rolldownOptions: {',
    '      tsconfig: path.join(projectRoot, \'tsconfig.json\'),',
    '    },',
    '  },',
    '})',
    '',
  ].join('\n'), 'utf8')

  await fs.writeJson(path.join(PROJECT_ROOT, 'project.config.json'), {
    appid: 'wxb3d842a4a7e3440d',
    libVersion: '3.13.2',
    miniprogramRoot: 'dist',
    compileType: 'miniprogram',
    setting: {
      minifyWXML: true,
      es6: true,
    },
  }, { spaces: 2 })

  await fs.writeJson(path.join(PROJECT_ROOT, 'src/app.json'), {
    pages: [
      'pages/index/index',
    ],
    window: {},
    style: 'v2',
    sitemapLocation: 'sitemap.json',
  }, { spaces: 2 })
  await fs.writeFile(path.join(PROJECT_ROOT, 'src/app.ts'), 'App({})\n', 'utf8')
  await fs.writeJson(path.join(PROJECT_ROOT, 'src/sitemap.json'), {
    rules: [],
  }, { spaces: 2 })

  await fs.writeFile(path.join(PROJECT_ROOT, 'src/pages/index/index.vue'), [
    '<script setup lang="ts">',
    'import MonorepoBadge from \'../../../../packages/monorepo-ui/MonorepoBadge.vue\'',
    'import LinkedBadge from \'@e2e/linked-ui/LinkedBadge.vue\'',
    'import { sharedMessage } from \'../../../../packages/shared-state/message\'',
    '',
    'const configMarker = __E2E_CONFIG_MARKER__',
    '',
    'definePageJson({',
    '  navigationBarTitleText: \'external linked hmr\',',
    '})',
    '</script>',
    '',
    '<template>',
    '  <view class="page">',
    '    <MonorepoBadge />',
    '    <LinkedBadge />',
    '    <ResolverBadge />',
    '    <view class="shared-message">{{ sharedMessage }}</view>',
    '    <view class="config-marker">{{ configMarker }}</view>',
    '  </view>',
    '</template>',
    '',
  ].join('\n'), 'utf8')

  await fs.writeFile(MONOREPO_BADGE, createComponentSource('monorepo-badge', 'MONOREPO-BADGE-V1'), 'utf8')
  await fs.writeFile(RESOLVER_BADGE, createComponentSource('resolver-badge', 'RESOLVER-BADGE-V1'), 'utf8')
  await fs.writeFile(SHARED_MESSAGE, 'export const sharedMessage = \'SHARED-MESSAGE-V1\'\n', 'utf8')
  await fs.writeJson(path.join(LINK_BADGE_SOURCE_ROOT, 'package.json'), {
    name: '@e2e/linked-ui',
    type: 'module',
    exports: {
      './LinkedBadge.vue': './LinkedBadge.vue',
    },
  }, { spaces: 2 })
  await fs.writeFile(LINK_BADGE, createComponentSource('linked-badge', 'LINKED-BADGE-V1'), 'utf8')
  await fs.ensureSymlink(LINK_BADGE_SOURCE_ROOT, path.join(PROJECT_ROOT, 'node_modules/@e2e/linked-ui'), 'junction')
}

async function waitForDistJsContains(marker: string, timeoutMs = 90_000) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(DIST_ROOT)) {
      const files: string[] = []
      const visit = async (dir: string) => {
        for (const entry of await fs.readdir(dir)) {
          const candidate = path.join(dir, entry)
          const stat = await fs.stat(candidate)
          if (stat.isDirectory()) {
            await visit(candidate)
            continue
          }
          if (candidate.endsWith('.js')) {
            files.push(candidate)
          }
        }
      }
      await visit(DIST_ROOT)
      for (const file of files) {
        const content = await fs.readFile(file, 'utf8')
        if (content.includes(marker)) {
          return content
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  throw new Error(`Timed out waiting for dist js to contain marker: ${marker}`)
}

async function waitForExternalComponentContains(sourcePath: string, marker: string, timeoutMs = 90_000) {
  const externalRoot = path.join(DIST_ROOT, '__weapp_vite_external__')
  const fileName = `${path.basename(sourcePath, '.vue')}.wxml`
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(externalRoot)) {
      const distRootEntries = await fs.readdir(externalRoot)
      for (const dir of distRootEntries) {
        const candidate = path.join(externalRoot, dir, fileName)
        if (!await fs.pathExists(candidate)) {
          continue
        }
        const content = await fs.readFile(candidate, 'utf8')
        if (content.includes(marker)) {
          return content
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  throw new Error(`Timed out waiting for external component ${fileName} to contain marker: ${marker}`)
}

async function waitForTaskWithSourceHeartbeat<T>(
  task: () => Promise<T>,
  touchFilePath: string,
  touchContent: string,
  timeoutMs = 90_000,
  heartbeatMs = 2_000,
) {
  const deadline = Date.now() + timeoutMs
  let nextTouchAt = Date.now() + heartbeatMs

  while (Date.now() < deadline) {
    try {
      return await task()
    }
    catch {
      if (Date.now() >= nextTouchAt) {
        await replaceFileByRename(touchFilePath, touchContent)
        nextTouchAt = Date.now() + heartbeatMs
      }
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }

  return await task()
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
  await writeFixtureProject()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
  await fs.remove(TEMP_ROOT)
})

describe.sequential('external linked Vue component HMR', () => {
  it('updates srcRoot-external Vue components and emits external plain/config deps in dev', async () => {
    await fs.remove(DIST_ROOT)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', [CLI_PATH, 'dev', '.', '--platform', 'weapp', '--skipNpm'], {
      cwd: PROJECT_ROOT,
      env: createDevProcessEnv(),
      stdio: 'pipe',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 90_000), 'app.json generated')
      await dev.waitFor(
        waitForExternalComponentContains(MONOREPO_BADGE, 'MONOREPO-BADGE-V1'),
        'initial monorepo component marker',
      )
      await dev.waitFor(
        waitForExternalComponentContains(LINK_BADGE, 'LINKED-BADGE-V1'),
        'initial linked component marker',
      )
      await dev.waitFor(
        waitForExternalComponentContains(RESOLVER_BADGE, 'RESOLVER-BADGE-V1'),
        'initial resolver component marker',
      )
      await dev.waitFor(
        waitForDistJsContains('SHARED-MESSAGE-V1'),
        'initial external shared dependency marker',
      )
      await dev.waitFor(
        waitForDistJsContains('CONFIG-MARKER-V1'),
        'initial config dependency marker',
      )

      const updatedMonorepoBadge = createComponentSource('monorepo-badge', 'MONOREPO-BADGE-V2')
      await replaceFileByRename(MONOREPO_BADGE, updatedMonorepoBadge)
      await dev.waitFor(
        waitForTaskWithSourceHeartbeat(
          () => waitForExternalComponentContains(MONOREPO_BADGE, 'MONOREPO-BADGE-V2', 1_000),
          MONOREPO_BADGE,
          updatedMonorepoBadge,
        ),
        'updated monorepo component marker',
      )

      const updatedLinkedBadge = createComponentSource('linked-badge', 'LINKED-BADGE-V2')
      await replaceFileByRename(LINK_BADGE, updatedLinkedBadge)
      await dev.waitFor(
        waitForTaskWithSourceHeartbeat(
          () => waitForExternalComponentContains(LINK_BADGE, 'LINKED-BADGE-V2', 1_000),
          LINK_BADGE,
          updatedLinkedBadge,
        ),
        'updated linked component marker',
      )

      const updatedResolverBadge = createComponentSource('resolver-badge', 'RESOLVER-BADGE-V2')
      await replaceFileByRename(RESOLVER_BADGE, updatedResolverBadge)
      await dev.waitFor(
        waitForTaskWithSourceHeartbeat(
          () => waitForExternalComponentContains(RESOLVER_BADGE, 'RESOLVER-BADGE-V2', 1_000),
          RESOLVER_BADGE,
          updatedResolverBadge,
        ),
        'updated resolver component marker',
      )
    }
    finally {
      await dev.stop(5_000)
    }
  })

  it('ignores build.watch in production build and exits normally', async () => {
    await fs.remove(DIST_ROOT)

    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: PROJECT_ROOT,
      platform: 'weapp',
      skipNpm: true,
      label: 'external-linked-vue-component:build-watch-ignored',
    })

    await waitForFile(path.join(DIST_ROOT, 'app.json'), 90_000)
    await waitForExternalComponentContains(MONOREPO_BADGE, 'MONOREPO-BADGE-V1')
    await waitForExternalComponentContains(LINK_BADGE, 'LINKED-BADGE-V1')
    await waitForExternalComponentContains(RESOLVER_BADGE, 'RESOLVER-BADGE-V1')
    await expect(waitForDistJsContains('SHARED-MESSAGE-V1')).resolves.toContain('SHARED-MESSAGE-V1')
  })
})
