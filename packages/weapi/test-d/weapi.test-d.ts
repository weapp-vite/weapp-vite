import { createWeapi, wpi } from '@wevu/api'
import { expectType } from 'tsd'

expectType<string | undefined>(wpi.platform)
expectType<WechatMiniprogram.Wx | undefined>(wpi.getAdapter())
expectType<WechatMiniprogram.Wx | undefined>(wpi.raw)

expectType<WechatMiniprogram.SystemInfo>(wpi.getSystemInfoSync())
expectType<void>(wpi.onMemoryWarning(() => {}))
expectType<void>(wpi.offMemoryWarning(() => {}))

const requestPromise = wpi.request({
  url: 'https://example.com',
})
expectType<Promise<WechatMiniprogram.RequestSuccessCallbackResult>>(requestPromise)

const requestTask = wpi.request({
  url: 'https://example.com',
  success: () => {},
})
expectType<WechatMiniprogram.RequestTask>(requestTask)

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
