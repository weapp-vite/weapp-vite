import type { ViteDevServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { getDevServerCloseRecord } from '../devLifecycle/server'
import { bindHostLifecycle } from './lifecycle'

it('retains session recovery failure when closing the native host also fails', async () => {
  const recoveryFailure = new Error('session recovery failed')
  const hostFailure = new Error('native host close failed')
  const nativeClose = vi.fn(async () => {
    throw hostFailure
  })
  const server = { config: { inlineConfig: {} }, close: nativeClose, restart: vi.fn(async () => {}) } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {
    throw recoveryFailure
  })
  const closing = server.close()
  await expect(closing).rejects.toMatchObject({ errors: [recoveryFailure, hostFailure] })
  await expect(server.close()).rejects.toMatchObject({ errors: [recoveryFailure, hostFailure] })
  expect(nativeClose).toHaveBeenCalledOnce()
})

it('retains recovery failure while waiting for and closing a failed replacement host', async () => {
  const recoveryFailure = new Error('old session recovery failed')
  const hostFailure = new Error('replacement close failed')
  const entered = Promise.withResolvers<void>()
  const ready = Promise.withResolvers<void>()
  const nativeClose = vi.fn(async () => {})
  const replacementClose = vi.fn(async () => {
    throw hostFailure
  })
  const closeSession = vi.fn(async () => {}).mockRejectedValueOnce(recoveryFailure)
  const server = {
    config: { inlineConfig: {} },
    close: nativeClose,
    restart: async () => {
      entered.resolve()
      await ready.promise
      const replacement = { close: replacementClose } as unknown as ViteDevServer
      getDevServerCloseRecord(replacement)
      Object.assign(server, replacement)
    },
  } as unknown as ViteDevServer
  // 重启先成功释放旧会话；退出阶段的额外恢复工作失败仍须关闭替换宿主。
  let restarting = true
  bindHostLifecycle(server, async () => {
    if (restarting) {
      restarting = false
      return
    }
    await closeSession()
  })
  const restart = server.restart()
  await entered.promise
  const closing = expect(server.close()).rejects.toMatchObject({ errors: [recoveryFailure, hostFailure] })
  try {
    await Promise.resolve()
    expect(replacementClose).not.toHaveBeenCalled()
  }
  finally {
    ready.resolve()
    await Promise.all([restart, closing])
  }
  expect(nativeClose).not.toHaveBeenCalled()
  expect(replacementClose).toHaveBeenCalledOnce()
})
