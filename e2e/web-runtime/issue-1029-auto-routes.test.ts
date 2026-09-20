import type { Browser } from 'playwright'
import type { PreviewServer } from 'vite'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createIssue1029Project, ISSUE_1029_HOME, ISSUE_1029_PROFILE, runIssue1029Command } from '../utils/issue1029Project'
import { createWebDevServerEnv, resolveWebDevServerUrl } from '../utils/webDevServer'

interface WebFixtureHost {
  getCurrentPages: () => Array<{
    route: string
    _runE2E: () => { records: Array<{ name: string, path: string, meta: Record<string, unknown> }> }
  }>
}

const ROOT = path.resolve(import.meta.dirname, '../..')

let project: string
let browser: Browser | undefined
let server: PreviewServer | undefined

describe('issue #1029: shared named routes on the Web target', { concurrent: false }, () => {
  beforeAll(async () => {
    browser = await chromium.launch({ channel: process.env.WEAPP_VITE_WEB_E2E_CHANNEL })
  })

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => server!.httpServer.close(error => error ? reject(error) : resolve()))
      server = undefined
    }
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  })
  afterAll(async () => {
    await browser?.close()
  })

  it('uses the same names and metadata for navigation, back, abort and redirects', async () => {
    project = await createIssue1029Project()
    await runIssue1029Command(project, 'build', ['--platform', 'web'])
    server = await preview({ root: project, configFile: false, build: { outDir: 'dist/web' }, preview: { host: '127.0.0.1', port: 0, open: false } })
    const page = await browser!.newPage()
    const activePage = page.locator('[data-weapp-page-active="true"]')
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(`${server!.resolvedUrls!.local[0]}${ISSUE_1029_HOME.slice(1)}`)
      await expect.poll(() => activePage.locator('#issue-1029-home #route-title').textContent()).toBe('首页')
      await activePage.locator('#open-profile').click()
      await expect.poll(() => activePage.locator('#issue-1029-profile #route-title').textContent()).toBe('个人资料')
      expect(await page.evaluate(() => {
        // Web runtime 安装的宿主对象不在浏览器原生 Window 声明内。
        const host = globalThis as unknown as WebFixtureHost
        return host.getCurrentPages().at(-1)?.route
      })).toBe(ISSUE_1029_PROFILE.slice(1))
      await activePage.locator('#go-back').click()
      await expect.poll(() => activePage.locator('#issue-1029-home #route-title').textContent()).toBe('首页')
      await activePage.locator('#abort-profile').click()
      await expect.poll(() => page.evaluate(() => {
        const host = globalThis as unknown as WebFixtureHost
        return host.getCurrentPages().map(item => item.route)
      })).toEqual([ISSUE_1029_HOME.slice(1)])
      await activePage.locator('#redirect-profile').click()
      await expect.poll(() => activePage.locator('#issue-1029-home #route-redirect').textContent()).toBe('yes')
      expect(await activePage.locator('#issue-1029-home #route-title').textContent()).toBe('首页')
      expect(errors).toEqual([])
    }
    finally {
      await page.close()
    }
  }, 180_000)

  it('serves and refreshes external metadata and route add/remove/rename through the shared watcher', async () => {
    project = await createIssue1029Project()
    const externalFile = path.join(project, 'src/pageScripts/profile.mjs')
    await rename(path.join(project, 'src/pageScripts/profile.ts'), externalFile)
    const profileDirectory = path.join(project, 'src/subpackages/account/pages/profile')
    const profileFile = path.join(profileDirectory, 'index.vue')
    const profileSource = (await readFile(profileFile, 'utf8')).replace('profile.ts', 'profile.mjs')
    await writeFile(profileFile, profileSource)
    const declaration = path.join(project, '.weapp-vite/typed-router.d.ts')
    const page = await browser!.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const activePage = page.locator('[data-weapp-page-active="true"]')
    const readRoutes = () => page.evaluate(() => {
      const host = globalThis as unknown as WebFixtureHost
      if (typeof host.getCurrentPages !== 'function') {
        return []
      }
      return host.getCurrentPages().at(-1)?._runE2E().records.map(record => ({
        name: record.name,
        path: record.path,
        title: record.meta.title,
      })) ?? []
    })
    const dev = startDevProcess(process.execPath, [
      path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'),
      'dev',
      project,
      '--platform',
      'web',
      '--host',
      '127.0.0.1',
    ], {
      cwd: ROOT,
      env: { ...createWebDevServerEnv(createDevProcessEnv()), WEAPP_WEB_PORT: '0' },
      all: true,
    })
    try {
      await dev.waitFor(expect.poll(() => resolveWebDevServerUrl(dev.getOutput()), { timeout: 90_000 }).toBeTypeOf('string'), 'Web server starts')
      await page.goto(new URL(ISSUE_1029_HOME, resolveWebDevServerUrl(dev.getOutput())!).href)
      await expect.poll(() => activePage.locator('#route-title').textContent()).toBe('首页')
      await activePage.locator('#open-profile').click()
      await expect.poll(() => activePage.locator('#route-title').textContent()).toBe('个人资料')
      await activePage.locator('#go-back').click()
      await expect.poll(() => activePage.locator('#route-title').textContent()).toBe('首页')
      await activePage.locator('#redirect-profile').click()
      await expect.poll(() => activePage.locator('#route-redirect').textContent()).toBe('yes')

      const source = await readFile(externalFile, 'utf8')
      await writeFile(externalFile, source.replace('title: \'个人资料\'', 'title: \'Web external metadata\', webRevision: true'))
      await dev.waitFor(expect.poll(readRoutes, { timeout: 45_000 }).toContainEqual({
        name: 'profile',
        path: ISSUE_1029_PROFILE,
        title: 'Web external metadata',
      }), 'Web virtual route metadata refreshes')
      await expect.poll(() => readFile(declaration, 'utf8')).toMatch(/webRevision["']?\s*:\s*boolean/)
      await activePage.locator('#open-profile').click()
      await expect.poll(() => activePage.locator('#route-title').textContent()).toBe('Web external metadata')
      await activePage.locator('#go-back').click()
      await expect.poll(() => activePage.locator('#route-title').textContent()).toBe('首页')

      const movedDirectory = path.join(path.dirname(profileDirectory), 'moved')
      const movedRoute = ISSUE_1029_PROFILE.replace('/profile/', '/moved/')
      await rename(profileDirectory, movedDirectory)
      await dev.waitFor(expect.poll(readRoutes, { timeout: 45_000 }).toContainEqual({
        name: 'profile',
        path: movedRoute,
        title: 'Web external metadata',
      }), 'Web route rename refreshes')
      await expect.poll(() => readFile(declaration, 'utf8')).toContain(movedRoute)
      await activePage.locator('#open-profile').click()
      await expect.poll(() => page.evaluate(() => {
        const host = globalThis as unknown as WebFixtureHost
        return host.getCurrentPages().at(-1)?.route
      })).toBe(movedRoute.slice(1))
      await activePage.locator('#go-back').click()
      await expect.poll(() => activePage.locator('#route-title').textContent()).toBe('首页')

      await rm(movedDirectory, { recursive: true })
      await dev.waitFor(expect.poll(readRoutes, { timeout: 45_000 }).toEqual([
        { name: 'home', path: ISSUE_1029_HOME, title: '首页' },
      ]), 'Web route removal refreshes')
      await expect.poll(() => readFile(declaration, 'utf8')).not.toContain('"profile"')
      await mkdir(movedDirectory, { recursive: true })
      await writeFile(path.join(movedDirectory, 'index.vue'), profileSource)
      await dev.waitFor(expect.poll(readRoutes, { timeout: 45_000 }).toContainEqual({
        name: 'profile',
        path: movedRoute,
        title: 'Web external metadata',
      }), 'Web route addition refreshes')
      await expect.poll(() => readFile(declaration, 'utf8')).toContain(movedRoute)
      await activePage.locator('#open-profile').click()
      await expect.poll(() => activePage.locator('#route-title').textContent()).toBe('Web external metadata')
      expect(errors).toEqual([])
    }
    finally {
      await page.close()
      await dev.stop(5_000)
    }
  }, 180_000)
})
