import { WEVU_PAGE_LAYOUT_NAME_KEY, WEVU_PAGE_LAYOUT_NONE } from '@weapp-core/constants'
import Message from 'tdesign-miniprogram/message/index'
import Toast from 'tdesign-miniprogram/toast/index'

type FeedbackTheme = 'success' | 'warning' | 'error' | 'info'

interface FeedbackOptions {
  message: string
  theme?: FeedbackTheme
}

interface LayoutFeedbackHost {
  showLayoutMessage?: (options: FeedbackOptions) => void
  showLayoutToast?: (options: FeedbackOptions) => void
}

function resolveCurrentLayoutName(context: WechatMiniprogram.Page.TrivialInstance) {
  const data = context.data as Record<string, unknown> | undefined
  const value = data?.[WEVU_PAGE_LAYOUT_NAME_KEY]
  return typeof value === 'string' && value !== WEVU_PAGE_LAYOUT_NONE ? value : 'default'
}

function resolveLayoutHost(context: WechatMiniprogram.Page.TrivialInstance) {
  const layoutName = resolveCurrentLayoutName(context)
  const selector = `weapp-layout-${layoutName}`
  return context.selectComponent?.(selector) as LayoutFeedbackHost | null
}

export function showLayoutToast(context: WechatMiniprogram.Page.TrivialInstance, options: FeedbackOptions) {
  const host = resolveLayoutHost(context)
  if (host?.showLayoutToast) {
    host.showLayoutToast(options)
    return
  }

  Toast({
    context,
    selector: '#layout-toast',
    message: options.message,
    theme: options.theme === 'info' ? undefined : options.theme,
    duration: 1400,
  })
}

export function showLayoutMessage(context: WechatMiniprogram.Page.TrivialInstance, options: FeedbackOptions) {
  const host = resolveLayoutHost(context)
  if (host?.showLayoutMessage) {
    host.showLayoutMessage(options)
    return
  }

  const theme = options.theme ?? 'info'
  Message[theme]({
    context,
    selector: '#layout-message',
    content: options.message,
    duration: 1800,
    single: true,
  })
}
