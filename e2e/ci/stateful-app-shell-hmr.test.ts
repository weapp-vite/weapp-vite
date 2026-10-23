import { pathToFileURL } from 'node:url'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { createHeadlessSession } from '../../mpcore/packages/simulator/src/runtime'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename, waitForFileContains, waitForStatefulHmrControl } from '../utils/hmr-helpers'
import { createNativeHmrPublication } from '../utils/nativeHmrPublication'

const appRoot = path.resolve(import.meta.dirname, '../../e2e-apps/app-vue-hmr-alias')
const appFile = path.join(appRoot, 'src/app.vue')
const configFile = path.join(appRoot, 'weapp-vite.config.ts')
const profileFile = path.join(appRoot, '.tmp/app-shell-hmr-profile.jsonl')
const dist = path.join(appRoot, 'dist')
const baseMarker = 'APP-VUE-HMR-ALIAS-APP-BASE'
const shellOutputs = ['js', 'json', 'wxml'].map(extension => path.join(dist, `__weapp_vite_app_shell.${extension}`))

async function buildId() {
  const script = await fs.readFile(path.join(dist, 'app.js'), 'utf8')
  const match = /weapp-vite-stateful-build:([a-f0-9]+)/.exec(script)
  expect(match).not.toBeNull()
  return match![1]
}

function render() {
  // 与 IDE 的完整重载对应，mpcore 重新读取同一代原生输出。
  const session = createHeadlessSession({ projectPath: appRoot })
  try {
    session.reLaunch('/pages/index/index')
    return session.renderCurrentPage().wxml
  }
  finally {
    session.close()
  }
}

it('hands app shell registration changes to classic and publishes removal and restoration', async (ctx) => {
  const original = await fs.readFile(appFile, 'utf8')
  const originalConfig = await fs.readFile(configFile, 'utf8')
  const observer = pathToFileURL(path.resolve(import.meta.dirname, '../utils/nativePublication/plugin.ts')).href
  await fs.writeFile(configFile, `import { nativePublicationPlugin } from ${JSON.stringify(observer)}\n${originalConfig.replace('defineConfig({', 'defineConfig({\n  plugins: [nativePublicationPlugin({ profilePath: process.env.WEAPP_VITE_HMR_PROFILE_JSON })],')}`)
  await fs.remove(dist)
  const dev = startDevProcess(process.execPath, [
    path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js'),
    'dev',
    appRoot,
    '--platform',
    'weapp',
    '--skipNpm',
  ], { cwd: appRoot, all: true, reject: false, env: { ...createDevProcessEnv(), WEAPP_VITE_HMR_PROFILE_JSON: profileFile } })
  ctx.onTestFailed(() => {
    process.stdout.write(dev.getOutput())
  })
  // 首次只修改模板文字，应由已发布的原生模板注册能力判断交接到 classic。
  const publication = createNativeHmrPublication(appRoot, dev, 'auto', ['native-registration'], profileFile)
  try {
    await dev.waitFor(waitForStatefulHmrControl(path.join(dist, '__weapp_vite_hmr/control.js')), 'stateful initial output')
    await buildId()
    expect(render()).toContain(baseMarker)
    const marker = 'STATEFUL-APP-SHELL-UPDATED'
    const changed = publication.capture(appFile)
    await replaceFileByRename(appFile, original.replace(baseMarker, marker))
    await changed.wait()
    await dev.waitFor(waitForFileContains(path.join(dist, '__weapp_vite_app_shell.wxml'), marker), 'updated shell')
    expect(await Promise.all(shellOutputs.map(file => fs.pathExists(file)))).toEqual([true, true, true])
    expect(render()).toContain(marker)

    const removed = publication.capture(appFile)
    await replaceFileByRename(appFile, original.replace(/<template>[\s\S]*?<\/template>/, ''))
    await removed.wait()
    await expect.poll(async () => fs.pathExists(path.join(dist, '__weapp_vite_app_shell.wxml')), { timeout: 30_000 }).toBe(false)
    expect(await Promise.all(shellOutputs.map(file => fs.pathExists(file)))).toEqual([false, false, false])
    const rendered = render()
    expect(rendered).not.toContain('app-vue-hmr-alias-app__marker')
    expect(rendered).toContain('APP-VUE-HMR-ALIAS-PAGE')

    const restored = publication.capture(appFile)
    await replaceFileByRename(appFile, original)
    await restored.wait()
    expect(await Promise.all(shellOutputs.map(file => fs.pathExists(file)))).toEqual([true, true, true])
    expect(render()).toContain(baseMarker)
    expect(await fs.readFile(appFile, 'utf8')).toBe(original)
  }
  finally {
    try {
      await dev.stop(5_000)
    }
    finally {
      await Promise.all([fs.writeFile(appFile, original), fs.writeFile(configFile, originalConfig)])
    }
  }
})
