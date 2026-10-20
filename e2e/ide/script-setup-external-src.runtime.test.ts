import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertAppRetained, captureAppReloadMarker, waitForAppReload } from '../utils/appReload'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDevBuildCompletion } from '../utils/devBuildCompletion'
import { createDomAcceptance } from '../utils/domAcceptance'
import { captureDomCheckpoint } from '../utils/domAcceptance/checkpoint'
import { readHmrOutputIdentity } from '../utils/hmrOutputDiagnostics'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { bindScriptSetupExternalManagedProject, createScriptSetupExternalCleanup } from '../utils/scriptSetupExternalCleanup'
import {
  createScriptSetupExternalProject,
  externalComponentScript,
  externalComponentTemplate,
  SCRIPT_SETUP_EXTERNAL_CLI,
  SCRIPT_SETUP_EXTERNAL_FIXTURE,
  SCRIPT_SETUP_EXTERNAL_HOST,
  SCRIPT_SETUP_EXTERNAL_ROUTE,
  SCRIPT_SETUP_EXTERNAL_STEPS,
} from '../utils/scriptSetupExternalProject'

describe('script setup external blocks component analysis runtime', { concurrent: false }, () => {
  let project: string
  let dev: ReturnType<typeof startDevProcess> | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let ideLaunchAttempted = false
  let managed: Awaited<ReturnType<typeof bindScriptSetupExternalManagedProject>> | undefined
  const read = (file: string) => readFile(path.join(project, file), 'utf8')
  const cleanup = createScriptSetupExternalCleanup(() => ({ project, host, dev, launchAttempted: ideLaunchAttempted, managed }))

  async function readOutputIdentity() {
    const first = await readHmrOutputIdentity(path.join(project, 'dist'))
    const second = await readHmrOutputIdentity(path.join(project, 'dist'))
    expect(first.files.length).toBeGreaterThan(0)
    for (const identity of [first, second]) {
      expect(identity.files.every(file => !file.error && typeof file.hash === 'string')).toBe(true)
    }
    expect(second).toEqual(first)
    return second
  }

  async function connect() {
    ideLaunchAttempted ||= resolveRuntimeProviderName() === 'devtools'
    return await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: SCRIPT_SETUP_EXTERNAL_ROUTE,
      warmupRootSelectors: ['#external-page'],
      async onSessionMetadata(metadata) {
        managed = await bindScriptSetupExternalManagedProject(project, metadata)
      },
    })
  }

  beforeAll(async () => {
    project = await createScriptSetupExternalProject()
    const config = JSON.parse(await read('project.config.json')) as { appid: string, compileType: string }
    const privateConfig = JSON.parse(await read('project.private.config.json')) as { condition: { miniprogram: { list: Array<{ pathName: string }> } } }
    expect(config.appid).toMatch(/^wx[\da-f]+$/)
    expect(config.compileType).toBe('miniprogram')
    expect(privateConfig.condition.miniprogram.list.map(item => item.pathName)).toContain(SCRIPT_SETUP_EXTERNAL_ROUTE.slice(1))
    dev = startDevProcess(process.execPath, [SCRIPT_SETUP_EXTERNAL_CLI, 'dev', '--non-interactive'], {
      cwd: project,
      env: createDevProcessEnv(),
      all: true,
    })
    await dev.waitForInitialBuild()
    host = await connect()
  }, 180_000)

  afterAll(async () => {
    await cleanup()
  }, 60_000)

  it('renders external template edits, changed import paths and component removal/restoration', async (context) => {
    context.onTestFailed(() => {
      process.stdout.write(dev?.getOutput().slice(-24_000) ?? '')
    })
    const checkpoints = SCRIPT_SETUP_EXTERNAL_STEPS.map(step => ({
      id: step.id,
      route: SCRIPT_SETUP_EXTERNAL_ROUTE,
      action: `检查外部块 ${step.id} 的页面与组件渲染`,
      nodes: [
        { selector: '#external-marker', text: step.marker },
        step.text ? { selector: '#external-card', text: step.text } : { selector: '#external-card', count: 0 },
      ],
    }))
    const dom = createDomAcceptance(context, SCRIPT_SETUP_EXTERNAL_FIXTURE, checkpoints)

    for (const step of SCRIPT_SETUP_EXTERNAL_STEPS) {
      if (step.id !== 'initial') {
        const before = await readOutputIdentity()
        const reloadMarker = await captureAppReloadMarker(host!)
        const editedFile = path.join(project, 'src/pages/index', step.id.includes('script') ? 'setup.ts' : 'template.html')
        const completion = createDevBuildCompletion(dev!, {
          completed: '小程序已重新构建',
          source: { file: editedFile, profilePath: path.join(project, '.weapp-vite/hmr-profile.jsonl') },
        })
        if (step.id.includes('script')) {
          await writeFile(editedFile, externalComponentScript(step.imported))
        }
        else {
          await writeFile(editedFile, externalComponentTemplate(step.marker, step.component !== null))
        }
        await completion.wait()
        // 指纹只在本轮 publication 完成后分类；未变产物不要求宿主重新加载相同字节。
        const after = await readOutputIdentity()
        const changed = JSON.stringify(before) !== JSON.stringify(after)
        if (changed) {
          if (resolveRuntimeProviderName() === 'headless') {
            // classic 产物变化需要换 VM；无变化的发布保持原 App，与真实 IDE 一致。
            await host?.close()
            host = await connect()
          }
          const ready = await waitForAppReload(host!, reloadMarker, '#external-page')
          expect(ready.route).toBe(SCRIPT_SETUP_EXTERNAL_ROUTE.slice(1))
        }
        else {
          expect(after).toEqual(before)
          await assertAppRetained(host!, reloadMarker, '#external-page', SCRIPT_SETUP_EXTERNAL_ROUTE.slice(1))
          const page = await host!.currentPage()
          expect(page).not.toBeNull()
          const checkpoint = checkpoints.find(checkpoint => checkpoint.id === step.id)!
          await captureDomCheckpoint(host!, page!, checkpoint, resolveRuntimeProviderName(), 5_000)
          await assertAppRetained(host!, reloadMarker, '#external-page', SCRIPT_SETUP_EXTERNAL_ROUTE.slice(1))
        }
      }
      const json = JSON.parse(await read('dist/pages/index/index.json')) as { usingComponents?: Record<string, string> }
      if (step.component) {
        expect(json.usingComponents?.['local-card']).toBe(`/components/${step.component}/index`)
        for (const extension of ['js', 'json', 'wxml']) {
          expect(await read(`dist/components/${step.component}/index.${extension}`)).not.toBe('')
        }
      }
      else {
        expect(json.usingComponents?.['local-card']).toBeUndefined()
      }
      for (const extension of ['js', 'json', 'wxml']) {
        expect(await read(`dist/pages/index/index.${extension}`)).not.toBe('')
      }
      await dom.check(step.id, host!, await host!.reLaunch(SCRIPT_SETUP_EXTERNAL_ROUTE))
      expect(await read('src/pages/index/index.vue')).toBe(SCRIPT_SETUP_EXTERNAL_HOST)
    }
    expect(dev!.getOutput()).not.toMatch(/Build failed|delivery failed|patch transform failed/)
  }, 300_000)
})
