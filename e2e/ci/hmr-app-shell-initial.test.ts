import { readFile, rm, writeFile } from 'node:fs/promises'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createHeadlessSession } from '../../mpcore/packages/simulator/src/runtime'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { waitForFileContains } from '../utils/hmr-helpers'
import { createIssue1015Project, ISSUE_1015_CLI } from '../utils/issue1015Project'

describe('App shell saves during initial classic build', { concurrent: false }, () => {
  it.each([false, true])('publishes a consistent latest shell without a second save (initial shell=%s)', async (before) => {
    const project = await createIssue1015Project()
    const appId = path.join(project, 'src/app.vue')
    const original = await readFile(appId, 'utf8')
    const shell = '<template><view class="initial-app-shell"><slot /></view></template>\n'
    await writeFile(appId, `${original}${before ? shell : ''}`)
    const nextSource = `${original}${before ? '' : shell}`
    const configFile = path.join(project, 'weapp-vite.config.mjs')
    const config = await readFile(configFile, 'utf8')
    // renderStart 位于页面 transform 后、bundle 资产刷新前，稳定模拟同一首构中的保存。
    await writeFile(configFile, `import { writeFile } from 'node:fs/promises'\n${config.replace('  weapp: {', `  plugins: [{
    name: 'e2e-save-initial-app-shell',
    renderStart() {
      if (this.meta.watchMode || saved) return
      saved = true
      return writeFile(new URL('./src/app.vue', import.meta.url), ${JSON.stringify(nextSource)})
    },
  }],
  weapp: {`).replace('export default defineConfig', 'let saved = false\nexport default defineConfig')}`)
    const dev = startDevProcess('node', [ISSUE_1015_CLI, 'dev', '--non-interactive'], {
      cwd: project,
      env: createDevProcessEnv(),
    })
    try {
      await dev.waitForInitialBuild()
      const pageFile = path.join(project, 'dist/pages/issue-1015/index.wxml')
      if (!before) {
        await dev.waitFor(waitForFileContains(pageFile, '<weapp-app-shell'), 'new shell reaches the page after the initial save')
      }
      else {
        await expect.poll(async () => (await readFile(pageFile, 'utf8')).includes('<weapp-app-shell'), { timeout: 30_000 }).toBe(false)
      }
      await expect.poll(async () => {
        const page = await fs.readJson(path.join(project, 'dist/pages/issue-1015/index.json')) as { usingComponents?: Record<string, string> }
        return Boolean(page.usingComponents?.['weapp-app-shell'])
      }, { timeout: 30_000 }).toBe(!before)
      expect(await readFile(appId, 'utf8')).toBe(nextSource)
      const session = createHeadlessSession({ projectPath: project })
      try {
        session.reLaunch('/pages/issue-1015/index')
        const rendered = session.renderCurrentPage().wxml
        expect(rendered.includes('class="initial-app-shell"')).toBe(!before)
        expect(rendered).toContain('external css vars initial')
      }
      finally {
        session.close()
      }
    }
    finally {
      await dev.stop()
      await rm(project, { recursive: true, force: true })
    }
  })
})
