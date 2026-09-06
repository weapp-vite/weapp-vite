import type { TestContext } from 'vitest'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const SOURCE_APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-prelude-native')
const PROJECTS_ROOT = path.resolve(import.meta.dirname, '../../.tmp/e2e-projects/app-prelude-native')
const PROJECT_COPY_ENTRIES = ['package.json', 'project.config.json', 'project.private.config.json', 'src', 'tsconfig.json', 'weapp-vite.config.ts']
const ROUTES = [
  { route: '/pages/index/index', label: 'main' },
  { route: '/subpackages/normal/pages/entry/index', label: 'normal-subpackage' },
  { route: '/subpackages/independent/pages/entry/index', label: 'independent-subpackage' },
]
const REQUEST_RUNTIME = {
  fetch: 'function',
  headers: 'function',
  request: 'function',
  response: 'function',
  xmlHttpRequest: 'undefined',
  webSocket: 'undefined',
  url: 'function',
  urlSearchParams: 'function',
  blob: 'function',
  formData: 'function',
}
type Mode = 'default' | 'inline' | 'default-request-runtime'

async function launchMode(mode: Mode) {
  // 每种 prelude 构建拓扑必须独立冷启动，避免模块缓存掩盖重复副作用。
  const projectRoot = path.join(PROJECTS_ROOT, mode)
  await fs.remove(projectRoot)
  await fs.ensureDir(projectRoot)
  await Promise.all(PROJECT_COPY_ENTRIES.map(entry => fs.copy(path.join(SOURCE_APP_ROOT, entry), path.join(projectRoot, entry))))
  await fs.symlink(path.join(SOURCE_APP_ROOT, 'node_modules'), path.join(projectRoot, 'node_modules'), 'junction')
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot,
    platform: 'weapp',
    cwd: projectRoot,
    label: `ide:app-prelude-native:${mode}`,
    skipNpm: true,
    env: {
      ...(mode === 'inline' ? { APP_PRELUDE_MODE: 'inline' } : {}),
      ...(mode === 'default-request-runtime' ? { APP_PRELUDE_REQUEST_GLOBALS: '1' } : {}),
    },
  })
  for (const { route } of ROUTES) {
    for (const extension of ['js', 'wxml', 'json']) {
      expect(await fs.pathExists(path.join(projectRoot, 'dist', `${route.slice(1)}.${extension}`))).toBe(true)
    }
  }
  return launchAutomator({ projectPath: projectRoot, timeout: 180_000, warmupRoute: ROUTES[0]!.route, warmupRootSelectors: ['#route'] })
}

async function verifyPrelude(context: TestContext, mode: 'default' | 'inline') {
  const acceptance = createDomAcceptance(context, 'e2e-apps/app-prelude-native', ROUTES.map(({ route, label }) => ({
    id: label,
    route,
    action: `reLaunch ${label} and inspect the prelude execution log`,
    nodes: [
      { selector: '#route', text: label },
      { selector: '#prelude-log-count', text: '1' },
      { selector: '.prelude-log-item', count: 1, text: 'app.prelude.ts:/app.prelude.ts' },
    ],
  })))
  const miniProgram = await launchMode(mode)
  try {
    for (const { route, label } of ROUTES) {
      const page = await miniProgram.reLaunch(route)
      await acceptance.check(label, miniProgram, page)
      expect(await miniProgram.evaluate(() => getApp<{ getPreludeLog: () => string[] }>().getPreludeLog()))
        .toEqual(['app.prelude.ts:/app.prelude.ts'])
    }
  }
  finally {
    await miniProgram.close()
  }
}

describe('e2e app: app-prelude-native runtime', { concurrent: false }, () => {
  it('executes inline app prelude once even after relaunching main and subpackage pages', async (context) => {
    await verifyPrelude(context, 'inline')
  })

  it('keeps one prelude side effect per package scope under default require mode', async (context) => {
    await verifyPrelude(context, 'default')
  })

  it('installs request runtime globals through app.prelude.js under default require mode', async (context) => {
    const acceptance = createDomAcceptance(context, 'e2e-apps/app-prelude-native', [{
      id: 'request-runtime',
      route: ROUTES[0]!.route,
      action: 'inspect the installed request API constructors on the first page',
      nodes: Object.entries(REQUEST_RUNTIME).map(([name, type]) => ({ selector: `#runtime-${name}`, text: `${name}=${type}` })),
    }])
    const miniProgram = await launchMode('default-request-runtime')
    try {
      const page = await miniProgram.currentPage()
      if (!page) {
        throw new Error('Missing initial page after request runtime startup')
      }
      await acceptance.check('request-runtime', miniProgram, page)
      expect(await page.data('requestRuntime')).toEqual(REQUEST_RUNTIME)
    }
    finally {
      await miniProgram.close()
    }
  })
})
