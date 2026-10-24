import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertConsumerStartupClassic } from './startupClassic.mjs'

export { assertConsumerStartupClassic as assertStylesheetClassic } from './startupClassic.mjs'

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

/** 启动即选择 classic；样式修改、恢复及再次保存都沿用同一原生交付会话。 */
export async function verifyStylesheetHmr({ root, operation, originalTemplate, waitForOutput, readOutput }) {
  await waitForOutput('app.wxss', /width:\s*37px/)
  await assertConsumerStartupClassic({ root, operation, output: readOutput() })
  for (const width of [53, 37, 61, 37]) {
    await writeFile(path.join(root, 'src/pages/native/index.wxml'), originalTemplate.replace('37px', `${width}px`))
    await waitForOutput('pages/native/index.wxml', `${width}px`)
    await waitForOutput('app.wxss', new RegExp(`width:\\s*${width}px`))
    await assertConsumerStartupClassic({ root, operation, output: readOutput() })
  }
}
