import type {
  BrowserHeadlessSession,
  HeadlessSession,
  HeadlessWx,
  HeadlessWxAccountInfo,
  HeadlessWxLoginFailResult,
  HeadlessWxLoginMockDefinition,
  HeadlessWxLoginOption,
  HeadlessWxLoginSuccessResult,
} from '..'
import { expectAssignable, expectError, expectType } from 'tsd'

declare const wx: HeadlessWx
declare const nodeSession: HeadlessSession
declare const browserSession: BrowserHeadlessSession

expectType<string>(wx.arrayBufferToBase64(new ArrayBuffer(4)))
expectType<ArrayBuffer>(wx.base64ToArrayBuffer('AA=='))
expectType<HeadlessWxAccountInfo>(wx.getAccountInfoSync())
expectType<void>(wx.login())
expectType<void>(wx.login({
  timeout: 100,
  success(result) {
    expectType<HeadlessWxLoginSuccessResult>(result)
    expectType<string>(result.code)
  },
  fail(result) {
    expectType<HeadlessWxLoginFailResult>(result)
    expectType<string>(result.errMsg)
  },
  complete(result) {
    expectType<HeadlessWxLoginSuccessResult | HeadlessWxLoginFailResult>(result)
  },
}))
expectAssignable<HeadlessWxLoginOption>({ timeout: 20 })
expectAssignable<HeadlessWxLoginMockDefinition>({ code: 'local-code', delay: 5 })
expectAssignable<HeadlessWxLoginMockDefinition>({ error: 'denied' })

for (const session of [nodeSession, browserSession]) {
  expectType<void>(session.mockLogin())
  expectType<void>(session.mockLogin({ code: 'local-code', delay: 10 }))
  expectType<void>(session.mockLogin({ error: 'denied' }))
  expectType<void>(session.setAccountInfo({
    miniProgram: { appId: 'wx-configured', envVersion: 'trial', version: '' },
  }))
  expectError(session.mockLogin({ delay: 'slow' }))
  expectError(session.setAccountInfo({
    miniProgram: { appId: 'wx-configured', envVersion: 'preview', version: '' },
  }))
}

expectError(wx.arrayBufferToBase64('bytes'))
expectError(wx.base64ToArrayBuffer(new ArrayBuffer(4)))
expectError(wx.login({ timeout: 'slow' }))
expectError(wx.login().then(() => {}))
