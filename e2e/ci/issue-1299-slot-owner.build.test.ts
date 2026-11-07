import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createHeadlessSession } from '../../mpcore/packages/simulator/src/runtime'
import { assertIssue1299OwnerArtifacts, ISSUE_1299_OWNERS, loadIssue1299OwnerDefinitions } from '../utils/issue1299Artifacts'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'

describe('issue #1299: scriptless native slot owner build', { concurrent: false }, () => {
  let project: string | undefined

  afterEach(async () => {
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
    project = undefined
  })

  it('registers real owner lifetimes and handlers matching app-shell and layout slot bindings', async () => {
    project = await createIssueRegressionProject(1299)
    await buildIssueRegressionProject(project, 'weapp')
    await assertIssue1299OwnerArtifacts(project)
  }, 180_000)

  it('keeps scriptless owner stubs when native slot context is explicitly disabled', async () => {
    project = await createIssueRegressionProject(1299)
    const configPath = path.join(project, 'weapp-vite.config.ts')
    const config = await readFile(configPath, 'utf8')
    await writeFile(configPath, config.replace('nativeSlotContext: true', 'nativeSlotContext: false'))
    await buildIssueRegressionProject(project, 'weapp')
    const dist = path.join(project, 'dist')
    const definitions = loadIssue1299OwnerDefinitions(dist)
    for (const owner of ISSUE_1299_OWNERS) {
      const template = await readFile(path.join(dist, `${owner}.wxml`), 'utf8')
      expect(template).not.toMatch(/__wevu_native_slot_parent|__wevu_native_declaration/)
      const definition = definitions.get(`${owner}.js`)
      expect(definition, owner).toBeDefined()
      expect(definition?.properties, owner).toHaveProperty('vueSlots')
      expect(definition?.methods?.__weapp_vite_nativeSlotParent, owner).toBeUndefined()
      expect(definition?.methods?.__weapp_vite_nativeDeclaration, owner).toBeUndefined()
      expect(definition?.lifetimes?.attached, owner).toBeUndefined()
    }
  }, 180_000)

  it('preserves scoped app styles and JSON-only layout handlers without reexecuting app script or setup', async () => {
    project = await createIssueRegressionProject(1299)
    const appPath = path.join(project, 'src/app.vue')
    const app = await readFile(appPath, 'utf8')
    const script = `<script lang="ts">
const appScriptProbe = globalThis as typeof globalThis & { issue1299ScriptRuns?: number }
appScriptProbe.issue1299ScriptRuns = (appScriptProbe.issue1299ScriptRuns ?? 0) + 1
</script>
<script setup lang="ts">
const appSetupProbe = globalThis as typeof globalThis & { issue1299SetupRuns?: number }
appSetupProbe.issue1299SetupRuns = (appSetupProbe.issue1299SetupRuns ?? 0) + 1
</script>
`
    await writeFile(appPath, `${script}${app.replace('id="issue1299-app-shell"', 'id="issue1299-app-shell" class="issue1299-shell-style"')}\n<style scoped>\n.issue1299-shell-style { color: #123456; }\n</style>\n`)
    const layoutPath = path.join(project, 'src/layouts/default.vue')
    await writeFile(layoutPath, `${await readFile(layoutPath, 'utf8')}\n<json>{ "component": true, "styleIsolation": "shared" }</json>\n`)
    await buildIssueRegressionProject(project, 'weapp')
    await assertIssue1299OwnerArtifacts(project)
    const dist = path.join(project, 'dist')
    const layout = JSON.parse(await readFile(path.join(dist, 'layouts/default.json'), 'utf8')) as { styleIsolation?: string }
    expect(layout.styleIsolation).toBe('shared')
    const template = await readFile(path.join(dist, '__weapp_vite_app_shell.wxml'), 'utf8')
    const style = await readFile(path.join(dist, 'app.wxss'), 'utf8')
    const scope = /\b(data-v-[\w-]+)=""/.exec(template)?.[1]
    expect(scope).toBeTruthy()
    expect(template).toContain('issue1299-shell-style')
    expect(style).toContain(`.issue1299-shell-style[${scope}]`)
    expect(style).toContain('#123456')
    const session = createHeadlessSession({ projectPath: project })
    try {
      session.reLaunch('/pages/index/index')
      expect(session.renderCurrentPage().wxml).toContain('issue1299-shell-style')
      session.reLaunch('/pages/without-layout/index')
      session.reLaunch('/pages/index/index')
      expect(session.evaluateRuntime('() => ({ script: globalThis.issue1299ScriptRuns, setup: globalThis.issue1299SetupRuns })')).toEqual({ script: 1, setup: 1 })
    }
    finally {
      session.close()
    }
  }, 180_000)
})
