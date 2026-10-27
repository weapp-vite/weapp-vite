import type {
  MiniProgramErrorCallback,
  ThemeChangeCallback,
  ThemeChangeEvent,
  UnhandledRejectionCallback,
  UnhandledRejectionEvent,
} from '@weapp-vite/web'
import * as api from '@weapp-vite/web'
import * as runtime from '@weapp-vite/web/runtime'
import * as polyfill from '@weapp-vite/web/runtime/polyfill'
import { expectError, expectType } from 'tsd'

const errorCallback: MiniProgramErrorCallback = (error) => {
  expectType<string>(error)
}
const rejectionCallback: UnhandledRejectionCallback = (event) => {
  expectType<UnhandledRejectionEvent>(event)
  expectType<Promise<unknown>>(event.promise)
  expectType<unknown>(event.reason)
  expectError(event.reason.message)
}
const themeCallback: ThemeChangeCallback = (event) => {
  expectType<ThemeChangeEvent>(event)
  expectType<'dark' | 'light'>(event.theme)
}

expectType<void>(api.onError(errorCallback))
expectType<void>(api.offError(errorCallback))
expectType<void>(api.offError())
expectType<void>(api.onUnhandledRejection(rejectionCallback))
expectType<void>(api.offUnhandledRejection(rejectionCallback))
expectType<void>(api.offUnhandledRejection())
expectType<void>(api.onThemeChange(themeCallback))
expectType<void>(api.offThemeChange(themeCallback))
expectType<void>(api.offThemeChange())
expectError(api.onError())
expectError(api.onUnhandledRejection())
expectError(api.onThemeChange())
expectError(api.onError((error: { message: string }) => error.message))
expectError(api.offError((error: number) => error))
expectError(api.onUnhandledRejection((event: { reason: string }) => event.reason))
expectError(api.onThemeChange((event: { theme: 'system' }) => event.theme))
expectType<void>(api.reportEvent('launch', { count: 1, ready: true }))
expectType<void>(api.reportEvent('launch'))
expectError(api.reportEvent())
expectError(api.reportEvent(1))

for (const surface of [api, runtime, polyfill]) {
  expectType<typeof api.onError>(surface.onError)
  expectType<typeof api.offError>(surface.offError)
  expectType<typeof api.onUnhandledRejection>(surface.onUnhandledRejection)
  expectType<typeof api.offUnhandledRejection>(surface.offUnhandledRejection)
  expectType<typeof api.onThemeChange>(surface.onThemeChange)
  expectType<typeof api.offThemeChange>(surface.offThemeChange)
  expectType<typeof api.reportEvent>(surface.reportEvent)
  expectType<Promise<{ errMsg: string }>>(surface.hideToast())
  expectType<Promise<{ errMsg: string }>>(surface.hideShareMenu())
  expectType<Promise<{ errMsg: string }>>(surface.hideHomeButton())
  surface.hideToast({ success: result => expectType<string>(result.errMsg) })
  surface.hideShareMenu({ complete: result => expectType<string>(result.errMsg) })
  surface.hideHomeButton({ fail: result => expectType<string>(result.errMsg) })
  expectError(surface.hideToast({ success: (result: number) => result }))
  expectError(surface.hideShareMenu({ success: (result: number) => result }))
  expectError(surface.hideHomeButton({ success: (result: number) => result }))
}
