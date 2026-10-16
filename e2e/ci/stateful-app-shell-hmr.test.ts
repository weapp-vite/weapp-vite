import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { createHeadlessSession } from '../../mpcore/packages/simulator/src/runtime'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename, waitForFileContains, waitForStatefulHmrControl } from '../utils/hmr-helpers'

const appRoot = path.resolve(import.meta.dirname, '../../e2e-apps/app-vue-hmr-alias')
const appFile = path.join(appRoot, 'src/app.vue')
const dist = path.join(appRoot, 'dist')
const baseMarker = 'APP-VUE-HMR-ALIAS-APP-BASE'

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

it('publishes a fresh native generation when an app shell template changes or disappears', async () => {
  const original = await fs.readFile(appFile, 'utf8')
  await fs.remove(dist)
  const dev = startDevProcess(process.execPath, [
    path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js'),
    'dev',
    appRoot,
    '--platform',
    'weapp',
    '--skipNpm',
  ], { cwd: appRoot, all: true, reject: false, env: createDevProcessEnv() })
  try {
    await dev.waitFor(waitForStatefulHmrControl(path.join(dist, '__weapp_vite_hmr/control.js')), 'stateful initial output')
    let previous = await buildId()
    expect(render()).toContain(baseMarker)
    const marker = 'STATEFUL-APP-SHELL-UPDATED'
    await replaceFileByRename(appFile, original.replace(baseMarker, marker))
    await dev.waitFor(waitForFileContains(path.join(dist, '__weapp_vite_app_shell.wxml'), marker), 'updated shell')
    await expect.poll(buildId, { timeout: 30_000 }).not.toBe(previous)
    previous = await buildId()
    expect(render()).toContain(marker)

    await replaceFileByRename(appFile, original.replace(/<template>[\s\S]*?<\/template>/, ''))
    await expect.poll(buildId, { timeout: 30_000 }).not.toBe(previous)
    await expect.poll(async () => fs.pathExists(path.join(dist, '__weapp_vite_app_shell.wxml')), { timeout: 30_000 }).toBe(false)
    const rendered = render()
    expect(rendered).not.toContain('app-vue-hmr-alias-app__marker')
    expect(rendered).toContain('APP-VUE-HMR-ALIAS-PAGE')
  }
  finally {
    try {
      await dev.stop(5_000)
    }
    finally {
      await fs.writeFile(appFile, original)
    }
  }
})
