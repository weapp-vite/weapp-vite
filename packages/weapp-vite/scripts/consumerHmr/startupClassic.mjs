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

/** 核验消费者在指定能力边界后的完整 classic 交付。 */
export async function assertConsumerStartupClassic({ root, operation, output, expectedReason = 'stylesheet-output' }) {
  assert.doesNotMatch(output, /Build failed|delivery failed|patch transform failed|classic HMR 切换失败|classic 回退失败|stateful HMR 旧引擎停止失败/)
  const stateful = operation === 'stateful-dev'
  assert.equal(output.split(fallbackPrefix).length - 1, stateful ? 1 : 0, 'The capability boundary must select classic exactly once')
  assert.equal(output.split(classicReadyPrefix).length - 1, stateful ? 1 : 0, 'Classic publication must finish exactly once')
  if (stateful) {
    const fallback = output.match(/\[weapp-vite\] HMR fallback (\{[^\r\n]*\})/)
    const ready = output.match(/\[weapp-vite\] HMR classic ready (\{[^\r\n]*\})/)
    assert(fallback && ready, 'Classic startup must publish structured capability evidence')
    const reason = JSON.parse(fallback[1])
    assert.equal(typeof reason.message, 'string', 'Classic fallback must retain its capability message')
    if (reason.files !== undefined) {
      assert(Array.isArray(reason.files) && reason.files.every(file => typeof file === 'string'), 'Fallback files must retain source labels')
    }
    assert.deepEqual(reason, {
      from: 'stateful-experimental',
      to: 'classic',
      reason: expectedReason,
      message: reason.message,
      requested: 'stateful-experimental',
      actual: 'classic',
      phase: 'switching',
      ...(reason.files !== undefined ? { files: reason.files } : {}),
    })
    assert.deepEqual(JSON.parse(ready[1]), { reason: expectedReason, requested: 'stateful-experimental', actual: 'classic', phase: 'classic' })
    assert(fallback.index < ready.index, 'Classic readiness must follow its capability decision')
  }
  assert.equal(await readFile(path.join(root, 'config-calls.txt'), 'utf8'), stateful ? 'loaded\nloaded\n' : 'loaded\n', 'Only the capability handoff may restart the configuration')
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

/** 初始 stateful 只证明构建及控制文件就绪，不冒充 IDE 连接或执行确认。 */
export async function assertConsumerStatefulStartup({ root, output }) {
  assert.doesNotMatch(output, /\[weapp-vite\] HMR fallback |Build failed|delivery failed/)
  const control = await readFile(path.join(root, 'dist', WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE), 'utf8')
  assert(control.includes('/__weapp_vite_stateful_hmr__'), 'Stateful startup must publish the real transport control')
  assert.equal(await readFile(path.join(root, 'config-calls.txt'), 'utf8'), 'loaded\n')
  assert.equal(JSON.parse(await readFile(path.join(root, 'project.private.config.json'), 'utf8')).setting?.compileHotReLoad, true)
}
