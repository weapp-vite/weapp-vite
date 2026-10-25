import type { DomPage } from '../../utils/domAcceptance/types'
import { expect } from 'vitest'
import { createHmrRuntimeDiagnostics } from '../../utils/hmrRuntimeDiagnostics'
import { resolveRuntimeProviderName } from '../../utils/runtimeProvider'
import { waitForClassicWxsReload } from './classicWxs'

interface ClassicReloadSession {
  currentPage: (options?: { appFunctionFallback: boolean }) => Promise<(DomPage & { pageId: number }) | null>
  evaluate: (callback: (...args: any[]) => any, ...args: any[]) => Promise<any>
}

/** 在更新前登记旧应用身份；真实 IDE 必须先自行刷新，再允许测试导航。 */
export function createClassicReloadObserver<T extends ClassicReloadSession>(options: {
  getSession: () => T
  reopenHeadless: () => Promise<void>
  assertClassic: (session: T) => Promise<void>
  project: string
}) {
  return {
    async prepare(label: string) {
      const diagnostics = createHmrRuntimeDiagnostics(options.getSession(), options.project)
      const before = await diagnostics.initialize()
      expect(before.errors).toEqual([])
      expect(before.runtime).toMatchObject({
        pageMarkerRetained: true,
        appMarkerRetained: true,
        clientPresent: false,
        bridgeReady: false,
        controlPresent: false,
      })
      await options.assertClassic(options.getSession())
      return async () => {
        if (resolveRuntimeProviderName() === 'headless') {
          // companion 冷启已写出的 classic 产物；不将新 VM 记作 IDE 自动刷新。
          await options.reopenHeadless()
        }
        else {
          await expect.poll(async () => {
            const observed = await diagnostics.capture(label)
            expect(observed.errors).toEqual([])
            return observed.runtime
          }, { timeout: 20_000 }).toMatchObject({
            route: 'pages/reactivity/index',
            pageMarkerRetained: false,
            appMarkerRetained: false,
            clientPresent: false,
            bridgeReady: false,
            controlPresent: false,
          })
        }
        const page = await waitForClassicWxsReload(options.getSession())
        await options.assertClassic(options.getSession())
        return page
      }
    },
  }
}
