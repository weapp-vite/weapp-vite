import assert from 'node:assert/strict'
import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import { assertNoStatefulInstallations } from './installedRuntime.mjs'

export const classicReadyPrefix = '[weapp-vite] HMR classic ready '
const fallbackPrefix = '[weapp-vite] HMR fallback '

/** 发布消费者显式请求 stateful 时，启动即交付 classic，后续保存不能重新安装旧运行时。 */
export async function assertConsumerStartupClassic({ root, operation, output }) {
  assert.doesNotMatch(output, /Build failed|delivery failed|patch transform failed|classic HMR 切换失败|classic 回退失败|stateful HMR 旧引擎停止失败/)
  const stateful = operation === 'stateful-dev'
  assert.equal(output.split(fallbackPrefix).length - 1, stateful ? 1 : 0, 'Startup must select classic exactly once')
  assert.equal(output.split(classicReadyPrefix).length - 1, stateful ? 1 : 0, 'Classic startup must finish exactly once')
  if (stateful) {
    const fallback = output.match(/\[weapp-vite\] HMR fallback (\{[^\r\n]*\})/)
    const ready = output.match(/\[weapp-vite\] HMR classic ready (\{[^\r\n]*\})/)
    assert(fallback && ready, 'Classic startup must publish structured capability evidence')
    const reason = JSON.parse(fallback[1])
    assert.equal(typeof reason.message, 'string', 'Classic fallback must retain its capability message')
    assert.deepEqual(reason, {
      from: 'stateful-experimental',
      to: 'classic',
      reason: 'ide-classic-handoff',
      message: reason.message,
      requested: 'stateful-experimental',
      actual: 'classic',
      phase: 'switching',
    })
    assert.deepEqual(JSON.parse(ready[1]), { reason: 'ide-classic-handoff', requested: 'stateful-experimental', actual: 'classic', phase: 'classic' })
    assert(fallback.index < ready.index, 'Classic readiness must follow its capability decision')
  }
  assert.equal(await readFile(path.join(root, 'config-calls.txt'), 'utf8'), 'loaded\n', 'Startup admission must not restart the configuration')
  if (operation !== 'build-watch') {
    const privateConfig = JSON.parse(await readFile(path.join(root, 'project.private.config.json'), 'utf8'))
    assert.equal(privateConfig.setting?.compileHotReLoad, false, 'Effective classic IDE mode must disable script hot reload')
  }
  const outDir = path.join(root, 'dist')
  for (const file of [WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]) {
    await assert.rejects(access(path.join(outDir, file)), { code: 'ENOENT' }, `Classic output must remove ${file}`)
  }
  const scripts = (await readdir(outDir, { recursive: true })).filter(file => file.endsWith('.js'))
  assert(scripts.length, 'Classic verification requires actual emitted JavaScript')
  for (const file of scripts) {
    assertNoStatefulInstallations(file, await readFile(path.join(outDir, file), 'utf8'))
  }
}
