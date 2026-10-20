import {
  onLaunch as rootOnLaunch,
  useNativeInstance as rootUseNativeInstance,
  useNativeRouter as rootUseNativeRouter,
  useSelectorQuery as rootUseSelectorQuery,
} from '@weapp-vite/web'
import {
  onLaunch,
  onPageScroll,
  onShareAppMessage,
  useBoundingClientRect,
  useIntersectionObserver,
  useNativeInstance,
  useNativeRouter,
  useSelectorQuery,
} from '@weapp-vite/web/runtime'
import {
  onLaunch as polyfillOnLaunch,
  useNativeInstance as polyfillUseNativeInstance,
  useNativeRouter as polyfillUseNativeRouter,
  useSelectorQuery as polyfillUseSelectorQuery,
} from '@weapp-vite/web/runtime/polyfill'
import { expectError, expectType } from 'tsd'
import { onLaunch as internalOnLaunch } from 'wevu/internal-runtime'

expectType<typeof onLaunch>(rootOnLaunch)
expectType<typeof onLaunch>(polyfillOnLaunch)
expectType<typeof onLaunch>(internalOnLaunch)
expectType<typeof useNativeInstance>(rootUseNativeInstance)
expectType<typeof useNativeInstance>(polyfillUseNativeInstance)
expectType<typeof useNativeRouter>(rootUseNativeRouter)
expectType<typeof useNativeRouter>(polyfillUseNativeRouter)
expectType<typeof useSelectorQuery>(rootUseSelectorQuery)
expectType<typeof useSelectorQuery>(polyfillUseSelectorQuery)

// 通过公开 Web 与 internal-runtime 入口消费宿主 API，不预置环境类型。
onLaunch((options) => {
  expectType<WechatMiniprogram.App.LaunchShowOption>(options)
  expectType<string>(options.path)
})
onPageScroll((options) => {
  expectType<WechatMiniprogram.Page.IPageScrollOption>(options)
  expectType<number>(options.scrollTop)
})
onShareAppMessage((options) => {
  expectType<WechatMiniprogram.Page.IShareAppMessageOption>(options)
  expectType<'button' | 'menu'>(options.from)
  return { title: 'share' }
})
expectType<void>(useNativeInstance().triggerEvent('change', { value: 1 }))
expectError(useNativeInstance().triggerEvent(1))

const router = useNativeRouter()
router.navigateTo({ url: '/pages/home/index' })
expectError(router.navigateTo({ url: 1 }))
expectError(router.navigateTo({}))

expectType<WechatMiniprogram.SelectorQuery | null>(useSelectorQuery()())
expectType<Promise<WechatMiniprogram.BoundingClientRectCallbackResult | null>>(useBoundingClientRect()('.card'))
expectType<WechatMiniprogram.IntersectionObserver>(useIntersectionObserver({ thresholds: [0, 1] }))
expectError(useIntersectionObserver({ thresholds: ['invalid'] }))
