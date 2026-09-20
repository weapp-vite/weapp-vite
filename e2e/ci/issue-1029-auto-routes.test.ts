/* eslint-disable e18e/ban-dependencies -- 验收真实 CLI 和生成声明的 TypeScript 消费端。 */
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createIssue1029Project, runIssue1029Command } from '../utils/issue1029Project'

const ROOT = path.resolve(import.meta.dirname, '../..')
const projects: string[] = []

afterEach(async () => {
  await Promise.all(projects.splice(0).map(project => rm(project, { recursive: true, force: true })))
})

describe('issue #1029: automatic named route build contract', { concurrent: false }, () => {
  it('prepares a real strict name/meta consumer without widening unknown names', async () => {
    const project = await createIssue1029Project()
    projects.push(project)
    await runIssue1029Command(project, 'prepare')
    const consumer = path.join(project, 'consumer.ts')
    await writeFile(consumer, `
import { createRouter, useRoute, useRouter } from 'wevu/router'
import { routes } from 'wevu/router/auto-routes'
const router = createRouter({ routes })
router.push({ name: 'home' })
router.replace({ name: 'profile', query: { tab: 'bio' } })
// @ts-expect-error 未声明名称不能绕过严格模式
router.push({ name: 'settings' })
// @ts-expect-error 目标不能同时提供 name 与 path
router.resolve({ name: 'home', path: '/pages/legacy/index' })
router.beforeEach((to, from) => {
  if (to?.name === 'home') {
    const title: string = to.meta.title
    const auth: boolean = to.meta.requiresAuth
    const widened: typeof to.meta = { title: 'Other title', requiresAuth: true, tags: ['another', 'public'] }
    // @ts-expect-error home 没有 role
    to.meta.role
  }
  if (from.name === 'profile') {
    const role: string = from.meta.role
    const count: number = from.meta.limits.count
    const widened: typeof from.meta = { title: 'Another profile', requiresAuth: false, role: 'admin', limits: { count: 7 }, nullable: null }
  }
})
const current = useRoute()
if (current.name === 'profile') {
  const role: string = current.meta.role
}
// @ts-expect-error composable 不能丢失名称约束
useRouter().push({ name: 'missing' })
// @ts-expect-error 同名替换不能改变既定 meta 结构
router.addRoute({ name: 'profile', path: '/subpackages/account/pages/profile/index', meta: { title: 1, requiresAuth: true, role: 'admin', limits: { count: 7 }, nullable: null } })
`)
    await execa(process.execPath, [
      path.join(ROOT, 'node_modules/typescript/bin/tsc'),
      '--ignoreConfig',
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      consumer,
      path.join(project, '.weapp-vite/typed-router.d.ts'),
    ], { cwd: project })
  })

  it('prepares external package scripts and refreshes a retargeted package export', async () => {
    const project = await createIssue1029Project()
    projects.push(project)
    const pageFile = path.join(project, 'src/subpackages/account/pages/profile/index.vue')
    const packageName = 'issue-1029-page-script'
    const packageDir = path.join(path.dirname(pageFile), 'node_modules', packageName)
    await mkdir(packageDir, { recursive: true })
    const packageFile = path.join(packageDir, 'package.json')
    const packageConfig = { name: packageName, type: 'module', exports: './index.mjs' }
    await writeFile(packageFile, JSON.stringify(packageConfig))
    const relativeRouter = path.relative(packageDir, path.join(project, 'src/router')).split(path.sep).join('/')
    const source = (await readFile(path.join(project, 'src/pageScripts/profile.ts'), 'utf8'))
      .replace('from \'../router\'', `from '${relativeRouter}'`)
    await writeFile(path.join(packageDir, 'index.mjs'), source)
    await writeFile(pageFile, (await readFile(pageFile, 'utf8')).replace('@page-scripts/profile.ts', packageName))

    await runIssue1029Command(project, 'prepare')
    const declaration = path.join(project, '.weapp-vite/typed-router.d.ts')
    expect(await readFile(declaration, 'utf8')).toContain('"profile"')
    await runIssue1029Command(project, 'build')
    await writeFile(path.join(packageDir, 'retargeted.cjs'), source.replace('meta: {', 'meta: { packageRevision: 2,'))
    await writeFile(packageFile, JSON.stringify({ ...packageConfig, exports: './retargeted.cjs' }))
    await runIssue1029Command(project, 'prepare')
    expect(await readFile(declaration, 'utf8')).toMatch(/packageRevision["']?\s*:\s*number/)
    await runIssue1029Command(project, 'build')
  })

  it('removes disabled route artifacts and regenerates the current declarations when enabled again', async () => {
    const project = await createIssue1029Project()
    projects.push(project)
    const configFile = path.join(project, 'weapp-vite.config.ts')
    const config = await readFile(configFile, 'utf8')
    const declaration = path.join(project, '.weapp-vite/typed-router.d.ts')
    const cache = path.join(project, '.weapp-vite/auto-routes.cache.json')
    await runIssue1029Command(project, 'prepare')
    expect(await readFile(declaration, 'utf8')).toContain('"profile"')

    await writeFile(configFile, config.replace('autoRoutes: { persistentCache: true }', 'autoRoutes: false'))
    await runIssue1029Command(project, 'prepare')
    await expect(readFile(declaration, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(cache, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })

    const sourceFile = path.join(project, 'src/pageScripts/profile.ts')
    await writeFile(sourceFile, (await readFile(sourceFile, 'utf8')).replace('name: \'profile\'', 'name: \'profileAfterEnable\''))
    await writeFile(configFile, config)
    await runIssue1029Command(project, 'prepare')
    const regenerated = await readFile(declaration, 'utf8')
    expect(regenerated).toContain('"profileAfterEnable"')
    expect(regenerated).not.toContain('"profile"')
  })

  it('diagnoses both locations for duplicate names rather than choosing a page', async () => {
    const project = await createIssue1029Project()
    projects.push(project)
    const file = path.join(project, 'src/pageScripts/profile.ts')
    await writeFile(file, (await readFile(file, 'utf8')).replace('name: \'profile\'', 'name: \'home\''))
    const diagnostic = await runIssue1029Command(project, 'build').then(
      () => {
        throw new Error('Expected duplicate named routes to fail the build')
      },
      (error: unknown) => {
        if (!(error instanceof Error)) {
          throw error
        }
        return error.message
      },
    )
    expect(diagnostic).toContain('home')
    expect(diagnostic.replaceAll('\\', '/')).toContain('pages/home/index.vue')
    expect(diagnostic.replaceAll('\\', '/')).toContain('pageScripts/profile.ts')
  })

  it('refreshes emitted metadata and declaration structure on a metadata-only save', async () => {
    const project = await createIssue1029Project()
    projects.push(project)
    const file = path.join(project, 'src/pages/home/index.vue')
    const source = await readFile(file, 'utf8')
    const output = path.join(project, 'dist')
    const externalFile = path.join(project, 'src/pageScripts/profile.cjs')
    await rename(path.join(project, 'src/pageScripts/profile.ts'), externalFile)
    const profilePage = path.join(project, 'src/subpackages/account/pages/profile/index.vue')
    await writeFile(profilePage, (await readFile(profilePage, 'utf8')).replace('profile.ts', 'profile.cjs'))
    const declaration = path.join(project, '.weapp-vite/typed-router.d.ts')
    const dev = startDevProcess(process.execPath, [
      path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'),
      'dev',
      project,
      '--platform',
      'weapp',
      '--skipNpm',
    ], { cwd: ROOT, env: createDevProcessEnv(), all: true })
    const readEmittedScripts = async () => {
      const files = await readdir(output, { recursive: true })
      return (await Promise.all(files.filter(file => file.endsWith('.js')).map(file => readFile(path.join(output, file), 'utf8')))).join('\n')
    }
    try {
      await dev.waitFor(expect.poll(readEmittedScripts, { timeout: 90_000 }).toContain('requiresAuth'), 'initial route metadata emitted')
      await writeFile(file, source.replace('title: \'首页\'', 'title: \'route-metadata-after-save\', revision: 2'))
      await dev.waitFor(expect.poll(readEmittedScripts, { timeout: 90_000 }).toContain('route-metadata-after-save'), 'metadata-only save updates runtime data')
      await dev.waitFor(expect.poll(() => readFile(declaration, 'utf8'), { timeout: 30_000 }).toMatch(/revision["']?\s*:\s*number/), 'metadata-only save updates type shape')
      const externalSource = await readFile(externalFile, 'utf8')
      await writeFile(externalFile, externalSource.replace('title: \'个人资料\'', 'title: \'external-profile-after-save\', external: true'))
      await dev.waitFor(expect.poll(readEmittedScripts, { timeout: 90_000 }).toContain('external-profile-after-save'), 'external script metadata save updates runtime data')
      await dev.waitFor(expect.poll(() => readFile(declaration, 'utf8'), { timeout: 30_000 }).toMatch(/external["']?\s*:\s*boolean/), 'external script metadata save updates type shape')
    }
    finally {
      await dev.stop(5_000)
    }
    await runIssue1029Command(project, 'prepare')
    expect(await readFile(declaration, 'utf8')).toMatch(/revision["']?\s*:\s*number/)
    expect(await readFile(declaration, 'utf8')).toMatch(/external["']?\s*:\s*boolean/)
  }, 180_000)
})
