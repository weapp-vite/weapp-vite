import type { ViteDevServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { getDevServerCloseRecord } from '../devLifecycle/server'
import { bindHostLifecycle } from './lifecycle'

it.each([false, true])('closes a saved lower dispatch locally inside replacement cleanup (commandGate=%s)', async (withCommandGate) => {
  const nativeClose = vi.fn(async () => {})
  const replacementClose = vi.fn(async () => {})
  const wrapperClose = vi.fn(async () => {})
  const finalize = vi.fn(async () => {})
  const commandGate = vi.fn(async (close: () => Promise<void>) => await close())
  const server = {
    config: { inlineConfig: {} },
    close: nativeClose,
    restart: async () => {
      const replacement = {
        config: { inlineConfig: server.config.inlineConfig },
        close: replacementClose,
        restart: vi.fn(async () => {}),
      } as unknown as ViteDevServer
      const record = getDevServerCloseRecord(replacement)
      if (withCommandGate) {
        record.gate = commandGate
      }
      // 用户 pre hook 保存的下层 dispatch 会回读之后安装的公共退出 gate。
      const previousClose = replacement.close
      replacement.close = async () => {
        await wrapperClose()
        await previousClose()
      }
      bindHostLifecycle(replacement, async () => {})
      Object.assign(server, replacement)
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {}, undefined, undefined, finalize)
  await server.restart()
  await server.close()
  await server.close()
  expect(wrapperClose).toHaveBeenCalledOnce()
  expect(replacementClose).toHaveBeenCalledOnce()
  expect(nativeClose).not.toHaveBeenCalled()
  expect(finalize).toHaveBeenCalledOnce()
  expect(commandGate).toHaveBeenCalledTimes(withCommandGate ? 3 : 0)
})
