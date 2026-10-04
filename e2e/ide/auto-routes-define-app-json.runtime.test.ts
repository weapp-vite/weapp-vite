import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createIssue1015Project } from '../utils/issue1015Project'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/auto-routes-define-app-json')
const HOME_ROUTE = '/pages/home/index'
const ROUTES = [
  'pages/dashboard/index',
  'pages/detail/index',
  'pages/home/index',
  'pages/logs/index',
  'subpackages/lab/pages/state-playground/index',
  'subpackages/marketing/pages/campaign/index',
]
let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined

// 两个 suite 使用不同项目；每个项目只启动一次，后续页面共用 reLaunch。
async function launchAutoRoutesProject(projectPath: string, warmupRoute: string, warmupRootSelectors: string[], direct = false) {
  return await launchAutomator({ projectPath, warmupRoute, warmupRootSelectors, ...(direct ? { bridgeProjectMode: 'direct' as const } : {}) })
}

async function getSharedMiniProgram() {
  if (!miniProgram) {
    await fs.remove(path.join(APP_ROOT, 'dist'))
    await runWeappViteBuildWithLogCapture({ cliPath: CLI_PATH, projectRoot: APP_ROOT, platform: 'weapp', label: 'ide:auto-routes-define-app-json' })
    miniProgram = await launchAutoRoutesProject(APP_ROOT, HOME_ROUTE, ['#auto-routes-home'])
  }
  return miniProgram
}

describe('auto-routes define app json runtime (weapp e2e)', { concurrent: false }, () => {
  afterAll(async () => {
    await miniProgram?.close()
  })

  it('renders routeLinks for home page with main package and subpackage routes', async (context) => {
    const acceptance = createDomAcceptance(context, 'e2e-apps/auto-routes-define-app-json', [{
      id: 'route-links',
      route: HOME_ROUTE,
      action: 'reLaunch home and inspect all generated navigation links',
      nodes: [
        { selector: '.title', text: 'auto-routes 导航中心' },
        { selector: '.meta', text: '主包页面：4，总入口：6' },
        { selector: 'navigator', count: 6 },
        ...ROUTES.map(route => ({
          selector: `navigator[url="/${route}${route === 'pages/detail/index' ? '?id=42&from=home' : ''}"] .link-path`,
          text: route,
        })),
      ],
    }])
    const miniProgram = await getSharedMiniProgram()
    const page = await miniProgram.reLaunch(HOME_ROUTE)
    await acceptance.check('route-links', miniProgram, page)
    const routeLinks = await page.data('routeLinks') as Array<{ route: string }>
    expect(routeLinks.map(item => item.route).sort()).toEqual([...ROUTES].sort())
  })
})

describe('classic automatic route topology output runtime', { concurrent: false }, () => {
  const route = 'pages/topology-added/index'
  const vueRoute = 'pages/topology-vue/index'
  let project: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined

  async function prepareTopologyProject() {
    project = await createIssue1015Project()
    const appSource = path.join(project, 'src/app.vue')
    const originalApp = await readFile(appSource, 'utf8')
    await writeFile(appSource, originalApp
      .replace('<script setup>', '<script setup>\nimport { pages } from "weapp-vite/auto-routes"')
      .replace('pages: [\'pages/issue-1015/index\']', 'pages'))
    const privateConfigPath = path.join(project, 'project.private.config.json')
    const privateConfig = JSON.parse(await readFile(privateConfigPath, 'utf8')) as {
      condition: { miniprogram: { list: unknown[] } }
    }
    for (const pathName of [route, vueRoute]) {
      privateConfig.condition.miniprogram.list.push({ name: `automatic route topology ${pathName}`, pathName, query: '', scene: null })
    }
    await writeFile(privateConfigPath, JSON.stringify(privateConfig))
    dev = startDevProcess(process.execPath, [CLI_PATH, 'dev', '--non-interactive'], {
      cwd: project,
      env: { ...createDevProcessEnv(), WEAPP_GITHUB_ISSUE_1015_HMR_RUNTIME: 'classic' },
    })
    await dev.waitForInitialBuild()

    const marker = 'automatic-route-app-script-updated'
    await writeFile(appSource, (await readFile(appSource, 'utf8')).replace('</script>', `console.log('${marker}')\n</script>`))
    await expect.poll(async () => (await readFile(path.join(project, 'dist/app.js'), 'utf8')).includes(marker), { timeout: 30_000 }).toBe(true)
    const directory = path.join(project, 'src/pages/topology-added')
    const vueDirectory = path.join(project, 'src/pages/topology-vue')
    for (const stage of ['added', 'removed', 'restored']) {
      const present = stage !== 'removed'
      if (present) {
        await mkdir(directory, { recursive: true })
        await writeFile(path.join(directory, 'index.json'), '{}\n')
        await writeFile(path.join(directory, 'index.wxml'), '<view id="topology-result">{{message}}</view>\n')
        await writeFile(path.join(directory, 'index.js'), `Page({ data: { message: '${stage}' } })\n`)
        await mkdir(vueDirectory, { recursive: true })
        await writeFile(path.join(vueDirectory, 'index.vue'), `<template><view id="topology-vue-result">${stage}</view></template>\n`)
      }
      else {
        await rm(directory, { recursive: true })
        await rm(vueDirectory, { recursive: true })
      }
      // 不触碰 App 触发补偿构建；只靠本轮页面源文件变化发布路由和完整页面。
      await expect.poll(async () => {
        const config = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { pages: string[] }
        const outputs = await Promise.all([route, vueRoute].flatMap(pageRoute => ['js', 'json', 'wxml'].map(extension => access(path.join(project, `dist/${pageRoute}.${extension}`))
          .then(() => true, (error) => {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
              throw error
            }
            return false
          }))))
        return { registered: [route, vueRoute].map(pageRoute => config.pages.includes(pageRoute)), outputs }
      }, { timeout: 30_000 }).toEqual({ registered: [present, present], outputs: Array.from({ length: 6 }).fill(present) })
      expect(await readFile(path.join(project, 'dist/app.js'), 'utf8')).toContain(marker)
    }
    // 路由拓扑改变需要完整 AppService 装载；两种 provider 共用最终恢复产物，不重复启动 IDE。
    host = await launchAutoRoutesProject(project, `/${route}`, ['#topology-result'], true)
  }

  afterAll(async () => {
    const results = await Promise.allSettled([host?.close(), dev?.stop()])
    const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
    if (errors.length) {
      throw new AggregateError(errors, 'Failed to close automatic route topology resources')
    }
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 60_000)

  it('renders the restored page and keeps the original page reachable', async (context) => {
    const acceptance = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1015', [
      { id: 'topology-restored', route: `/${route}`, action: '打开仅由自动路由恢复的原生页面', nodes: [{ selector: '#topology-result', text: 'restored' }] },
      { id: 'topology-vue-restored', route: '/pages/topology-vue/index', action: '打开删除缓存后重新恢复的 Vue 页面', nodes: [{ selector: '#topology-vue-result', text: 'restored' }] },
      { id: 'topology-original', route: '/pages/issue-1015/index', action: '返回原有页面验证路由共存', nodes: [{ selector: '#issue-1015-state', text: 'external css vars initial' }] },
    ])
    await prepareTopologyProject()
    await acceptance.check('topology-restored', host!, await host!.reLaunch(`/${route}`))
    await acceptance.check('topology-vue-restored', host!, await host!.reLaunch(`/${vueRoute}`))
    await acceptance.check('topology-original', host!, await host!.reLaunch('/pages/issue-1015/index'))
  }, 180_000)
})
