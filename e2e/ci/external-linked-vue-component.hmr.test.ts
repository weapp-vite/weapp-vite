import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterEach, beforeEach, describe, it } from 'vitest'
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
  await fs.ensureDir(path.join(TEMP_ROOT, 'packages/monorepo-ui'))
  await fs.ensureDir(LINK_BADGE_SOURCE_ROOT)

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
    ],
  }, { spaces: 2 })
  await fs.writeJson(path.join(TEMP_ROOT, 'tsconfig.json'), {
    extends: './app/.weapp-vite/tsconfig.shared.json',
    include: [
      'app/src/**/*',
      'packages/**/*.vue',
    ],
  }, { spaces: 2 })

  await fs.writeFile(path.join(PROJECT_ROOT, 'weapp-vite.config.ts'), [
    'import path from \'node:path\'',
    'import { fileURLToPath } from \'node:url\'',
    'import { defineConfig } from \'weapp-vite\'',
    '',
    'const projectRoot = path.dirname(fileURLToPath(import.meta.url))',
    '',
    'export default defineConfig({',
    '  weapp: {',
    '    srcRoot: \'src\',',
    '    hmr: {',
    '      logLevel: \'verbose\',',
    '    },',
    '  },',
    '  build: {',
    '    minify: false,',
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
    '  </view>',
    '</template>',
    '',
  ].join('\n'), 'utf8')

  await fs.writeFile(MONOREPO_BADGE, createComponentSource('monorepo-badge', 'MONOREPO-BADGE-V1'), 'utf8')
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

beforeEach(async () => {
  await cleanupResidualDevProcesses()
  await writeFixtureProject()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
  await fs.remove(TEMP_ROOT)
})

describe.sequential('external linked Vue component HMR', () => {
  it('updates monorepo sibling and node_modules symlink Vue components outside srcRoot', async () => {
    await fs.remove(DIST_ROOT)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', [CLI_PATH, 'dev', '.', '--platform', 'weapp', '--skipNpm'], {
      cwd: PROJECT_ROOT,
      env: createDevProcessEnv(),
      stdio: 'inherit',
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

      await replaceFileByRename(MONOREPO_BADGE, createComponentSource('monorepo-badge', 'MONOREPO-BADGE-V2'))
      await dev.waitFor(
        waitForExternalComponentContains(MONOREPO_BADGE, 'MONOREPO-BADGE-V2'),
        'updated monorepo component marker',
      )

      await replaceFileByRename(LINK_BADGE, createComponentSource('linked-badge', 'LINKED-BADGE-V2'))
      await dev.waitFor(
        waitForExternalComponentContains(LINK_BADGE, 'LINKED-BADGE-V2'),
        'updated linked component marker',
      )
    }
    finally {
      await dev.stop(5_000)
    }
  })
})
