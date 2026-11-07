import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { createHeadlessSession } from '../../mpcore/packages/simulator/src/runtime'
import { waitForStableDistSnapshot } from '../../scripts/workspace-hmr/output'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { disableProjectCompileHotReload, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { assertIssue1299OwnerArtifacts } from '../utils/issue1299Artifacts'
import { createIssueRegressionProject } from '../utils/issueRegressionProject'
import { runWithCleanup } from '../utils/runWithCleanup'

const CLI = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const PAGE = 'pages/index/index'
const SHELL = '__weapp_vite_app_shell'

/** 每一代都从磁盘冷启动 runtime，检查新 shell chunk 的依赖确实已发布。 */
function assertRenderedGeneration(project: string, marker?: string) {
  const session = createHeadlessSession({ projectPath: project })
  try {
    session.reLaunch(`/${PAGE}`)
    const rendered = session.renderCurrentPage().wxml
    if (marker) {
      expect(rendered).toContain(marker)
    }
    else {
      expect(rendered).not.toContain('issue1299-app-shell')
    }
    expect(rendered).toContain('issue1299-layout')
    expect(rendered).toContain('provider:0')
    expect(rendered).toContain('count:0')
  }
  finally {
    session.close()
  }
}

describe('issue #1299: scriptless native slot owner watch publication', { concurrent: false }, () => {
  it('publishes runnable slot owners after template updates, removal and restoration', async (context) => {
    const project = await createIssueRegressionProject(1299)
    let dev: ReturnType<typeof startDevProcess> | undefined
    await runWithCleanup(async () => {
      const appPath = path.join(project, 'src/app.vue')
      const original = await readFile(appPath, 'utf8')
      const configPath = path.join(project, 'weapp-vite.config.ts')
      const config = await readFile(configPath, 'utf8')
      await writeFile(configPath, config.replace('srcRoot: \'src\',', 'srcRoot: \'src\',\n    hmr: { runtime: \'classic\' },'))
      await disableProjectCompileHotReload(project)
      dev = startDevProcess(process.execPath, [CLI, 'dev', '--platform', 'weapp', '--non-interactive'], {
        cwd: project,
        env: createDevProcessEnv(),
      })
      context.onTestFailed(() => {
        process.stdout.write(dev!.getOutput())
      })
      const dist = path.join(project, 'dist')
      const pageTemplate = path.join(dist, `${PAGE}.wxml`)
      const pageJson = path.join(dist, `${PAGE}.json`)
      const shellTemplate = path.join(dist, `${SHELL}.wxml`)
      await dev.waitForInitialBuild()
      await dev.waitFor(waitForFileContains(shellTemplate, 'issue1299-app-shell'), 'initial scriptless app shell')
      await dev.waitFor(waitForStableDistSnapshot(dist, 300, 30_000), 'initial slot owner publication')
      await assertIssue1299OwnerArtifacts(project)
      assertRenderedGeneration(project, 'issue1299-app-shell')

      const updated = original.replace('issue1299-app-shell', 'issue1299-app-shell-updated')
      await replaceFileByRename(appPath, updated)
      await dev.waitFor(waitForFileContains(shellTemplate, 'issue1299-app-shell-updated'), 'updated scriptless app shell template')
      await dev.waitFor(waitForStableDistSnapshot(dist, 300, 30_000), 'updated slot owner publication')
      await assertIssue1299OwnerArtifacts(project)
      assertRenderedGeneration(project, 'issue1299-app-shell-updated')

      await replaceFileByRename(appPath, '<script setup lang="ts">\n// 删除模板后仍保留合法的 App SFC。\n</script>\n')
      await dev.waitFor(expect.poll(async () => (await readFile(pageTemplate, 'utf8')).includes('<weapp-app-shell'), { timeout: 30_000 }).toBe(false), 'page wrapper drops the removed app shell')
      await dev.waitFor(expect.poll(async () => {
        const page = JSON.parse(await readFile(pageJson, 'utf8')) as { usingComponents?: Record<string, string> }
        return page.usingComponents?.['weapp-app-shell']
      }, { timeout: 30_000 }).toBeUndefined(), 'page configuration drops the removed app shell')
      await dev.waitFor(waitForStableDistSnapshot(dist, 300, 30_000), 'shell removal publication')
      await assertIssue1299OwnerArtifacts(project, ['layouts/default'])
      assertRenderedGeneration(project)

      const restored = original.replace('issue1299-app-shell', 'issue1299-app-shell-restored')
      await replaceFileByRename(appPath, restored)
      await dev.waitFor(waitForFileContains(shellTemplate, 'issue1299-app-shell-restored'), 'restored app shell template')
      await dev.waitFor(waitForFileContains(pageTemplate, '<weapp-app-shell'), 'page wrapper restores the app shell')
      await dev.waitFor(waitForStableDistSnapshot(dist, 300, 30_000), 'restored slot owner publication')
      await assertIssue1299OwnerArtifacts(project)
      assertRenderedGeneration(project, 'issue1299-app-shell-restored')
      expect(dev.getBuildErrors()).toEqual([])
    }, async () => {
      await dev?.stop(5_000)
      await rm(project, { recursive: true, force: true })
    })
  }, 240_000)
})
