import type {
  WeapiCrossPlatformRawAdapter,
  WeapiDefaultInstance,
  WeapiDouyinRawAdapter,
  WeapiMethodSupportQueryOptions,
  WeapiResolvedTarget,
  WeapiSupportLevel,
} from '@wevu/api'
import { createWeapi, wpi } from '@wevu/api'
import { expectType } from 'tsd'

type AssertTrue<T extends true> = T
type IsNever<T> = [T] extends [never] ? true : false
type ExtractMethodKeys<T> = Extract<{
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never
}[keyof T], string>

type WxMethodKeys = ExtractMethodKeys<WechatMiniprogram.Wx>
type MyMethodKeys = ExtractMethodKeys<typeof my>
type TtMethodKeys = ExtractMethodKeys<typeof tt>
type WeapiDefaultKeys = Extract<keyof WeapiDefaultInstance, string>
type WeapiRawKeys = Extract<keyof WeapiCrossPlatformRawAdapter, string>

type _wxMethodCoverage = AssertTrue<IsNever<Exclude<WxMethodKeys, WeapiDefaultKeys>>>
type _myMethodCoverage = AssertTrue<IsNever<Exclude<MyMethodKeys, WeapiRawKeys>>>
type _ttMethodCoverage = AssertTrue<IsNever<Exclude<TtMethodKeys, WeapiRawKeys>>>

expectType<string | undefined>(wpi.platform)
expectType<WeapiDefaultInstance>(wpi)
expectType<WeapiDefaultInstance['raw']>(wpi.raw)
expectType<WeapiDefaultInstance['showToast']>(wpi.showToast)
expectType<WeapiDefaultInstance['confirm']>(wpi.confirm)
expectType<WeapiResolvedTarget>(wpi.resolveTarget('showModal'))
expectType<boolean>(wpi.supports('showModal'))
expectType<boolean>(wpi.supports('showModal', { semantic: true } satisfies WeapiMethodSupportQueryOptions))
expectType<WeapiSupportLevel>(wpi.resolveTarget('showModal').supportLevel)
expectType<boolean>(wpi.resolveTarget('showModal').semanticAligned)

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
const strictCustom = createWeapi<CustomAdapter>({ strictCompatibility: true })

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
expectType<void>(strictCustom.onReady(() => {}))
