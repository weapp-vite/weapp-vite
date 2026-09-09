import type { HeadlessPageInstance } from '..'
import { expectError, expectType } from 'tsd'
import { createPageInstance } from '..'

expectType<HeadlessPageInstance>(createPageInstance('/pages/index/index', {}))
const page = createPageInstance('/pages/index/index', { data: { count: 0 } }, {}, {
  requestRender(callback) {
    expectType<(() => void) | undefined>(callback)
    callback?.()
  },
})
expectType<HeadlessPageInstance>(page)
expectType<void>(page.setData({ count: 1 }))
expectType<void>(page.setData({ count: 2 }, () => {}))
expectError(createPageInstance('/pages/index/index', {}, {}, { requestRender: true }))
expectError(createPageInstance('/pages/index/index', {}, {}, { requestRender: (_callback: () => void) => {} }))
