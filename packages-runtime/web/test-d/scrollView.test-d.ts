import { createScrollEventDetail } from '@weapp-vite/web/runtime'
import { expectError, expectType } from 'tsd'

const viewport = { scrollHeight: 800, scrollLeft: 40, scrollTop: 60, scrollWidth: 900 }
const previous = { scrollLeft: 10, scrollTop: 20 }
const detail = createScrollEventDetail(viewport, previous)

expectType<{
  scrollLeft: number
  scrollTop: number
  scrollWidth: number
  scrollHeight: number
  deltaX: number
  deltaY: number
}>(detail)

expectError(createScrollEventDetail({ ...viewport, scrollTop: '60' }, previous))
expectError(createScrollEventDetail({ scrollLeft: 0, scrollTop: 0, scrollWidth: 900 }, previous))
expectError(createScrollEventDetail(viewport, { scrollLeft: 0 }))
expectError(createScrollEventDetail(viewport, { scrollLeft: 0, scrollTop: '20' }))
