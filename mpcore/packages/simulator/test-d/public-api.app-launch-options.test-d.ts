import type { createBrowserHeadlessSession, createHeadlessSession, HeadlessAppInstance, HeadlessWxLaunchOptions } from '..'
import { expectError, expectType } from 'tsd'

declare const nodeSession: ReturnType<typeof createHeadlessSession>
declare const browserSession: ReturnType<typeof createBrowserHeadlessSession>
const options: HeadlessWxLaunchOptions = {
  path: 'pages/index/index',
  query: { from: 'share' },
  scene: 1047,
  referrerInfo: { appId: 'wx9876543210abcdef', extraData: {} },
}

expectType<HeadlessAppInstance>(nodeSession.bootstrap(options))
expectType<HeadlessAppInstance>(browserSession.bootstrap(options))
expectType<HeadlessAppInstance>(nodeSession.bootstrap({ ...options, referrerInfo: {} }))
expectType<HeadlessAppInstance>(browserSession.bootstrap({ ...options, referrerInfo: { appId: 'wx9876543210abcdef' } }))
expectType<HeadlessAppInstance>(browserSession.bootstrap({ ...options, referrerInfo: { extraData: {} } }))
expectType<string | undefined>(nodeSession.getLaunchOptions().referrerInfo.appId)
expectType<Record<string, never> | undefined>(browserSession.getEnterOptions().referrerInfo.extraData)
expectError(nodeSession.bootstrap({ ...options, scene: '1047' }))
expectError(browserSession.bootstrap({ ...options, query: { from: 1047 } }))
