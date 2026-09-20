import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY } from '@weapp-core/constants'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createHmrRuntimeDiagnostics } from '../utils/hmrRuntimeDiagnostics'
import { createIssue1015Project, ISSUE_1015_CLI } from '../utils/issue1015Project'

const ROUTE = '/pages/issue-1015/index'

for (const runtime of ['classic', 'stateful-experimental']) {
  describe(`issue #1015 external CSS HMR: ${runtime}`, () => {
    let project: string
    let dev: ReturnType<typeof startDevProcess> | undefined
    let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
    const runtimeErrors: string[] = []
    beforeAll(async () => {
      project = await createIssue1015Project()
      dev = startDevProcess(process.execPath, [ISSUE_1015_CLI, 'dev', '--non-interactive'], {
        cwd: project,
        env: { ...createDevProcessEnv(), WEAPP_GITHUB_ISSUE_1015_HMR_RUNTIME: runtime },
        reject: false,
      })
      await dev.waitForInitialBuild()
      for (const extension of ['js', 'json', 'wxml', 'wxss']) {
        expect(await readFile(path.join(project, `dist/pages/issue-1015/index.${extension}`), 'utf8')).not.toBe('')
      }
      miniProgram = await launchAutomator({
        projectPath: project,
        bridgeProjectMode: 'direct',
        warmupRoute: ROUTE,
        warmupRootSelectors: ['#issue-1015-page'],
      })
      miniProgram.on('exception', (event) => {
        runtimeErrors.push(event.message)
        process.stdout.write(`[issue-1015-exception] ${JSON.stringify(event)}\n`)
      })
      miniProgram.on('console', (event) => {
        if (event.level === 'error') {
          process.stdout.write(`[issue-1015-console] ${JSON.stringify(event)}\n`)
        }
      })
    }, 180_000)

    afterAll(async () => {
      await miniProgram?.close()
      await dev?.stop()
      if (project) {
        await rm(project, { recursive: true, force: true })
      }
    }, 60_000)

    it('renders all seven updates including removing and restoring every CSS variable', async (context) => {
      // 此场景验收原生文件热重载与计算颜色；simulator 注册边界由独立 companion 覆盖。
      const checkpoints = [
        { id: 'initial', color: 'rgb(255, 0, 0)', background: undefined },
        { id: 'style-only', color: 'rgb(255, 0, 0)', background: 'rgb(255, 255, 0)' },
        { id: 'source-switch', color: 'rgb(255, 0, 0)', background: 'rgb(255, 192, 203)' },
        { id: 'replace-variable', color: 'rgb(255, 165, 0)', background: undefined },
        { id: 'remove-variable', color: 'rgb(0, 0, 0)', background: undefined },
        { id: 'restore-variable', color: 'rgb(255, 0, 0)', background: undefined },
        { id: 'reactive', color: 'rgb(0, 0, 255)', background: undefined },
      ]
      const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1015', checkpoints.map(checkpoint => ({
        id: checkpoint.id,
        route: ROUTE,
        action: `检查 ${checkpoint.id} 外部 CSS 变量更新`,
        nodes: [
          {
            selector: '#issue-1015-page',
            attributes: { 'data-theme-color': checkpoint.id === 'reactive' ? 'blue' : 'red' },
            styles: { color: checkpoint.color, ...(checkpoint.background ? { 'background-color': checkpoint.background } : {}) },
          },
          { selector: '#issue-1015-state', text: `external css vars ${checkpoint.id === 'reactive' ? 'updated' : 'initial'}` },
        ],
      })))
      const host = miniProgram!
      const diagnostics = createHmrRuntimeDiagnostics(host as any, 'e2e-apps/github-issues/fixtures/issue-1015')
      const sourceDir = path.join(project, 'src/pages/issue-1015')
      const sourcePath = path.join(sourceDir, 'index.vue')
      const cssPath = path.join(sourceDir, 'index.css')
      const alternatePath = path.join(sourceDir, 'alternate.css')
      const source = await readFile(sourcePath, 'utf8')
      const css = await readFile(cssPath, 'utf8')
      const emittedCss = path.join(project, 'dist/pages/issue-1015/index.wxss')
      await host.reLaunch(ROUTE)
      await diagnostics.initialize()

      async function check(id: string) {
        const expected = checkpoints.find(checkpoint => checkpoint.id === id)!
        if (runtime === 'stateful-experimental') {
          await expect.poll(async () => {
            const control = await readFile(path.join(project, 'dist', WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE), 'utf8')
            const state = await host.evaluate((clientKey, controlKey) => {
              const globals = globalThis as any
              const transport = globals[clientKey]?.getTransportState?.()
              return { buildId: globals[controlKey]?.buildId, response: transport?.lastResponse?.type, phase: transport?.phase }
            }, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY)
            return state.phase === 'polling' && state.response !== 'rebuilding' && typeof state.buildId === 'string' && control.includes(state.buildId)
          }, { timeout: 45_000 }).toBe(true)
        }
        // 宿主重编译会替换页面对象；每次轮询重新取当前页，避免把旧 pageId 当成白屏。
        await expect.poll(async () => {
          const page = await host.currentPage()
          const element = await page?.$('#issue-1015-page')
          if (!element) {
            return null
          }
          const style = await element.attribute('style') || ''
          return {
            color: await element.style('color'),
            variable: id === 'remove-variable' ? !style.includes('--') : style.includes(id === 'replace-variable' ? 'orange' : id === 'reactive' ? 'blue' : 'red'),
          }
        }, { timeout: 45_000 }).toEqual({ color: expected.color, variable: true }).catch(async (error) => {
          await diagnostics.capture(`${id}-failed`)
          process.stdout.write(`[issue-1015-build] ${dev!.getOutput()}\n`)
          throw error
        })
        await dom.check(id, host, await host.currentPage())
        await diagnostics.capture(id)
        process.stdout.write(`[issue-1015] ${runtime} ${id} passed\n`)
      }

      async function updateCss(file: string, content: string, id: string) {
        await writeFile(file, `${content}\n.issue1015-page { --issue-1015-step: ${id}; }\n`)
        await expect.poll(() => readFile(emittedCss, 'utf8'), { timeout: 45_000 }).toContain(id).catch((error) => {
          process.stdout.write(`[issue-1015-build] ${dev!.getOutput()}\n`)
          throw error
        })
        await check(id)
      }

      await check('initial')
      await updateCss(cssPath, `${css}\n.issue1015-page { background-color: yellow; }`, 'style-only')
      await writeFile(alternatePath, `${css}\n.issue1015-page { background-color: pink; --issue-1015-step: source-switch; }`)
      await writeFile(sourcePath, source.replace('./index.css', './alternate.css'))
      await expect.poll(() => readFile(emittedCss, 'utf8'), { timeout: 45_000 }).toContain('source-switch')
      await check('source-switch')
      await updateCss(alternatePath, '.issue1015-page { color: v-bind(accentColor); }', 'replace-variable')
      await updateCss(alternatePath, '.issue1015-page { color: black; }', 'remove-variable')
      await updateCss(alternatePath, '.issue1015-page { color: v-bind(themeColor); }', 'restore-variable')
      await (await host.currentPage())!.callMethod('_runE2E', 'mutate')
      await check('reactive')
      if (runtimeErrors.length) {
        process.stdout.write(`[issue-1015-build] ${dev!.getOutput()}\n`)
      }
      expect(runtimeErrors).toEqual([])
      expect(dev!.getOutput()).not.toContain('Build failed')
    }, 300_000)
  })
}
