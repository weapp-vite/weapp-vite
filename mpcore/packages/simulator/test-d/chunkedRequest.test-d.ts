import type { HeadlessWx, HeadlessWxNetworkRequestTask, HeadlessWxRequestMockDefinition } from '..'
import { expectType } from 'tsd'

declare const wx: HeadlessWx
const task = wx.request({ url: 'https://example.test', enableChunked: true, responseType: 'arraybuffer' })
expectType<HeadlessWxNetworkRequestTask>(task)
task.onChunkReceived?.(({ data }) => expectType<ArrayBuffer>(data))
task.onHeadersReceived?.(({ header, statusCode, cookies }) => {
  expectType<Record<string, string>>(header)
  expectType<number>(statusCode)
  expectType<string[]>(cookies)
})
task.offChunkReceived?.()
task.offHeadersReceived?.()
const mock: HeadlessWxRequestMockDefinition = { url: 'https://example.test', response: '', chunks: [{ data: new ArrayBuffer(1), delay: 10 }], error: 'request:fail network error' }
expectType<HeadlessWxRequestMockDefinition>(mock)
