import assert from 'node:assert/strict'
import { access, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import {
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import { assertNoStatefulInstallations } from './installedRuntime.mjs'

const fallbackPrefix = '[weapp-vite] HMR fallback '
const readyPrefix = '[weapp-vite] HMR classic ready '
const endpointPath = '/__weapp_vite_stateful_hmr__'

async function probeTransport(endpoint) {
  assert.equal(new URL(endpoint).pathname, endpointPath, 'Probe must target the original stateful transport route')
  return fetch(endpoint, {
    method: 'POST',
    redirect: 'manual',
    body: '{}',
    headers: { connection: 'close' },
    signal: AbortSignal.timeout(2_000),
  })
}

function isConnectionRefused(error) {
  if (!error || typeof error !== 'object') {
    return false
  }
  if (Array.isArray(error.errors) && error.errors.length) {
    return error.errors.every(isConnectionRefused)
  }
  return error.code === 'ECONNREFUSED' || isConnectionRefused(error.cause)
}

/** 宿主可复用监听端口；只接受原 endpoint 的明确退役响应或连接拒绝。 */
export async function assertRetiredStatefulTransport(endpoint) {
  let response
  try {
    response = await probeTransport(endpoint)
  }
  catch (error) {
    if (isConnectionRefused(error)) {
      return
    }
    throw error
  }
  const source = await response.text()
  let value
  try {
    value = JSON.parse(source)
  }
  catch {}
  // Vite 重启会替换 middleware stack；custom 宿主由 Connect 返回绑定原路由的 404。
  // spa/mpa 的末端 404 middleware 则返回空响应，均不同于任意 HTML 错误页面。
  const removedRoute = response.status === 404 && (
    value?.type === 'not-found'
    || source === ''
    || source.includes(`<pre>Cannot POST ${endpointPath}</pre>`)
  )
  assert(
    (response.status === 410 && value?.type === 'retired')
    || removedRoute,
    `Original stateful transport is still active or did not confirm retirement: ${response.status} ${source}`,
  )
}

/** 两次配置执行只说明宿主重启；同时验证模式、输出与旧交付链路的退出。 */
export async function assertStylesheetClassic({ root, operation, output, endpoint }) {
  assert.doesNotMatch(output, /Build failed|delivery failed|patch transform failed|classic HMR 切换失败|classic 回退失败|stateful HMR 旧引擎停止失败/)
  const stateful = operation === 'stateful-dev'
  const fallbackCount = output.split(fallbackPrefix).length - 1
  const readyCount = output.split(readyPrefix).length - 1
  assert.equal(fallbackCount, stateful ? 1 : 0, 'Stylesheet changes must perform exactly one classic handoff')
  assert.equal(readyCount, stateful ? 1 : 0, 'Classic handoff must finish exactly once')
  if (stateful) {
    const fallback = output.match(/\[weapp-vite\] HMR fallback (\{[^\r\n]*\})/)
    const ready = output.match(/\[weapp-vite\] HMR classic ready (\{[^\r\n]*\})/)
    assert(fallback && ready, 'Classic handoff must publish structured capability evidence')
    const reason = JSON.parse(fallback[1])
    assert.equal(typeof reason.message, 'string', 'Classic fallback must retain its capability message')
    assert.deepEqual(reason, {
      from: 'stateful-experimental',
      to: 'classic',
      reason: 'stylesheet-output',
      message: reason.message,
      requested: 'stateful-experimental',
      actual: 'classic',
      phase: 'switching',
    })
    assert.deepEqual(JSON.parse(ready[1]), { reason: 'stylesheet-output', requested: 'stateful-experimental', actual: 'classic', phase: 'classic' })
    assert(fallback.index < ready.index, 'Classic readiness must follow its capability decision')
    assert(endpoint, 'Classic handoff must retain the original stateful transport identity')
  }
  assert.equal(await readFile(path.join(root, 'config-calls.txt'), 'utf8'), 'loaded\n'.repeat(stateful ? 2 : 1))
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
    const source = await readFile(path.join(outDir, file), 'utf8')
    assertNoStatefulInstallations(file, source)
  }
  if (stateful) {
    await assertRetiredStatefulTransport(endpoint)
  }
}

async function waitForClassicReady(readOutput, isExited) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline && !isExited()) {
    if (readOutput().includes(readyPrefix)) {
      return
    }
    await delay(50)
  }
  throw new Error(`Stylesheet change did not finish its classic handoff: ${readOutput()}`)
}

/** 样式字节首次变化后交接 classic；恢复及再次保存不得重新建立 stateful 会话。 */
export async function verifyStylesheetHmr({ root, operation, originalTemplate, waitForOutput, readOutput, isExited }) {
  await waitForOutput('app.wxss', /width:\s*37px/)
  assert.equal(await readFile(path.join(root, 'config-calls.txt'), 'utf8'), 'loaded\n')
  let endpoint
  if (operation === 'stateful-dev') {
    const control = await waitForOutput(WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, /http:\/\/localhost:[1-9]\d*\//)
    endpoint = control.match(/http:\/\/localhost:\d+\/__weapp_vite_stateful_hmr__/)?.[0]
    assert(endpoint, 'Stateful stylesheet host must publish its transport endpoint')
    const response = await probeTransport(endpoint)
    assert.equal(response.status, 403, 'Original transport must be live before stylesheet changes')
    assert.deepEqual(await response.json(), { type: 'forbidden' })
  }
  else {
    await assertStylesheetClassic({ root, operation, output: readOutput() })
  }
  for (const width of [53, 37, 61, 37]) {
    await writeFile(path.join(root, 'src/pages/native/index.wxml'), originalTemplate.replace('37px', `${width}px`))
    await waitForOutput('pages/native/index.wxml', `${width}px`)
    await waitForOutput('app.wxss', new RegExp(`width:\\s*${width}px`))
    if (operation === 'stateful-dev') {
      await waitForClassicReady(readOutput, isExited)
    }
    await assertStylesheetClassic({ root, operation, output: readOutput(), endpoint })
  }
}
