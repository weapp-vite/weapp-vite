import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { fs } from '@weapp-core/shared/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runCleanupSteps } from '../utils/cleanupSteps'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { createNativeHmrPublication } from '../utils/nativeHmrPublication'
import { createStatefulHmrProject } from '../utils/statefulHmrProject'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CLI = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')

describe('non-WeChat explicit stateful capability fallback', { concurrent: false }, () => {
  let fixture: Awaited<ReturnType<typeof createStatefulHmrProject>> | undefined
  let dev: ReturnType<typeof startDevProcess> | undefined
  let initialSource = ''
  let sourceFile = ''
  let outputFile = ''
  let publication: ReturnType<typeof createNativeHmrPublication> | undefined
  let devReleased = true

  beforeAll(async () => {
    fixture = await createStatefulHmrProject(ROOT)
    const project = fixture.projectRoot
    const profilePath = path.join(project, '.tmp/hmr-profile.jsonl')
    const configFile = path.join(project, 'weapp-vite.config.ts')
    const observer = pathToFileURL(path.join(ROOT, 'e2e/utils/nativePublication/plugin.ts')).href
    const config = `import { nativePublicationPlugin } from ${JSON.stringify(observer)}\n${await fs.readFile(configFile, 'utf8')}`
      .replace('export default defineConfig({', 'export default defineConfig({\n  plugins: [nativePublicationPlugin({ profilePath: process.env.WEAPP_VITE_HMR_PROFILE_JSON })],')
      .replace('logLevel: \'verbose\',', 'runtime: \'stateful-experimental\', logLevel: \'verbose\',')
    await fs.writeFile(configFile, config, 'utf8')
    const appFile = path.join(project, 'src/app.json')
    const app = await fs.readJson(appFile) as Record<string, unknown>
    app.pages = ['pages/native/index']
    delete app.tabBar
    await fs.writeJson(appFile, app, { spaces: 2 })
    const privateFile = path.join(project, 'project.private.config.json')
    const privateConfig = await fs.readJson(privateFile) as Record<string, unknown>
    privateConfig.condition = { miniprogram: { list: [{ name: 'HMR non-WeChat platform', pathName: 'pages/native/index', query: '' }] } }
    await fs.writeJson(privateFile, privateConfig, { spaces: 2 })
    await fs.writeJson(path.join(project, 'mini.project.json'), { miniprogramRoot: 'dist' }, { spaces: 2 })
    await fs.writeFile(path.join(project, 'src/app.ts'), 'App({})\n', 'utf8')
    sourceFile = path.join(project, 'src/pages/native/index.ts')
    outputFile = path.join(project, 'dist/pages/native/index.js')
    initialSource = await fs.readFile(sourceFile, 'utf8')
    devReleased = false
    dev = startDevProcess(process.execPath, [CLI, 'dev', project, '--platform', 'alipay', '--skipNpm'], {
      cwd: project,
      all: true,
      env: { ...createDevProcessEnv(), WEAPP_VITE_HMR_PROFILE_JSON: profilePath },
      reject: false,
    })
    publication = createNativeHmrPublication(project, dev, 'stateful-experimental', ['platform'], profilePath)
    await dev.waitForOutput('[weapp-vite] HMR classic ready ', 'non-WeChat classic readiness')
    await dev.waitFor(waitForFileContains(outputFile, 'STATEFUL-NATIVE-BASE'), 'non-WeChat initial output')
  }, 300_000)

  afterAll(async () => {
    await runCleanupSteps([
      { label: 'platform fallback watcher', run: async () => {
        if (dev) {
          await dev.stop(5_000)
          devReleased = true
        }
      } },
      { label: 'platform fallback isolated fixture', run: async () => {
        if (!devReleased) {
          throw new Error('Preserving platform fixture because watcher ownership is not confirmed released')
        }
        await fixture?.cleanup()
      } },
    ])
  })

  it('publishes the target platform in classic and preserves updates and restoration without a stateful client', async () => {
    const project = fixture!.projectRoot
    expect(dev!.getOutput()).toContain('"reason":"platform"')
    for (const extension of ['js', 'json', 'axml']) {
      expect(await fs.pathExists(path.join(project, `dist/pages/native/index.${extension}`))).toBe(true)
    }
    expect(await fs.pathExists(path.join(project, 'dist/pages/native/index.wxml'))).toBe(false)
    const app = await fs.readJson(path.join(project, 'dist/app.json')) as { pages: string[] }
    expect(app.pages).toEqual(['pages/native/index'])
    await publication!.assertClassicOutput()
    for (const marker of ['PLATFORM-A', 'PLATFORM-B', 'STATEFUL-NATIVE-BASE']) {
      const published = publication!.capture(sourceFile)
      await replaceFileByRename(sourceFile, initialSource.replace('STATEFUL-NATIVE-BASE', marker))
      await published.wait()
      await dev!.waitFor(waitForFileContains(outputFile, marker), `non-WeChat classic ${marker} output`)
      expect(await fs.pathExists(path.join(project, 'dist/__weapp_vite_hmr/control.js'))).toBe(false)
      expect(await fs.pathExists(path.join(project, 'dist/__weapp_vite_hmr/update.js'))).toBe(false)
      expect(dev!.getBuildErrors()).toEqual([])
    }
    expect(dev!.getOutput().match(/\[weapp-vite\] HMR fallback /g)).toHaveLength(1)
  }, 300_000)
})
