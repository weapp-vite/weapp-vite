import type { HeadlessWorker, HeadlessWx } from '..'
import { expectType } from 'tsd'

declare const wx: HeadlessWx
const worker = wx.createWorker('workers/index.js')
expectType<HeadlessWorker>(worker)
expectType<void>(worker.postMessage({ text: 'message' }))
expectType<void>(worker.onMessage((message) => {
  expectType<any>(message)
}))
expectType<void>(worker.terminate())
expectType<void>(wx.preDownloadSubpackage({ packageType: 'workers', success(result) {
  expectType<string>(result.errMsg)
} }))
