import type { WeapiDefaultInstance, WeapiDouyinRawAdapter } from '@wevu/api'
import { createWeapi, wpi } from '@wevu/api'
import { expectType } from 'tsd'

expectType<string | undefined>(wpi.platform)
expectType<WeapiDefaultInstance>(wpi)
expectType<WeapiDefaultInstance['raw']>(wpi.raw)
expectType<WeapiDefaultInstance['showToast']>(wpi.showToast)
expectType<WeapiDefaultInstance['confirm']>(wpi.confirm)

expectType<WechatMiniprogram.SystemInfo>(wpi.getSystemInfoSync())
expectType<WeapiDouyinRawAdapter>(tt)
expectType<void>(wpi.onMemoryWarning(() => {}))
expectType<void>(wpi.offMemoryWarning(() => {}))

const _requestPromise = wpi.request({
  url: 'https://example.com',
})
expectType<WeapiDefaultInstance['request']>(wpi.request)

const requestTask = wpi.request({
  url: 'https://example.com',
  success: () => {},
})
expectType<ReturnType<WeapiDefaultInstance['request']>>(requestTask)

const saveFilePromise = wpi.saveFile({
  apFilePath: '/tmp/demo.png',
  filePath: '/tmp/demo.png',
})
expectType<ReturnType<WeapiDefaultInstance['saveFile']>>(saveFilePromise)

const clipboardPromise = wpi.getClipboardData()
expectType<Promise<WechatMiniprogram.GetClipboardDataSuccessCallbackOption>>(clipboardPromise)

interface CustomAdapter {
  foo: (option: { success?: (res: { ok: true }) => void }) => number
  bazSync: (value: string) => number
  onReady: (callback: () => void) => void
}

const custom = createWeapi<CustomAdapter>()

const fooPromise = custom.foo({})
expectType<Promise<{ ok: true }>>(fooPromise)

const fooReturn = custom.foo({
  success: (res) => {
    expectType<{ ok: true }>(res)
  },
})
expectType<number>(fooReturn)

expectType<number>(custom.bazSync('ok'))
expectType<void>(custom.onReady(() => {}))
