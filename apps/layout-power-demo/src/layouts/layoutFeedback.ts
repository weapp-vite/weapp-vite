import Message from 'tdesign-miniprogram/message/index'
import Toast from 'tdesign-miniprogram/toast/index'

type ToastTheme = 'loading' | 'success' | 'warning' | 'error'
type ToastPlacement = 'top' | 'middle' | 'bottom'
type ToastDirection = 'row' | 'column'
type MessageTheme = 'info' | 'success' | 'warning' | 'error'

export interface LayoutFeedbackOptions {
  id: string
  message: {
    content: string
    theme: MessageTheme
    duration: number
    align?: string
    closeBtn?: boolean
    marquee?: {
      speed?: number
      loop?: number
      delay?: number
    }
  }
  toast: {
    message: string
    theme: ToastTheme
    duration: number
    placement: ToastPlacement
    direction: ToastDirection
  }
}

export interface LayoutFeedbackResult {
  layout: string
  messageTheme: MessageTheme
  toastTheme: ToastTheme
  toastPlacement: ToastPlacement
  toastDirection: ToastDirection
  ok: boolean
}

type LayoutFeedbackHandler = () => LayoutFeedbackResult
export type LayoutFeedbackComponent = WechatMiniprogram.Component.TrivialInstance & {
  __layoutPowerFeedbackHandler?: LayoutFeedbackHandler
}
type FeedbackPageInstance = WechatMiniprogram.Page.Instance<Record<string, unknown>, Record<string, unknown>> & {
  __layoutPowerFeedback?: LayoutFeedbackHandler
}

function resolveCurrentPage() {
  const pages = getCurrentPages() as FeedbackPageInstance[]
  return pages[pages.length - 1]
}

export function createLayoutFeedback(
  context: LayoutFeedbackComponent,
  options: LayoutFeedbackOptions,
): LayoutFeedbackHandler {
  return () => {
    const messageOptions = {
      context,
      selector: '#t-message',
      content: options.message.content,
      duration: options.message.duration,
      align: options.message.align,
      closeBtn: options.message.closeBtn,
      marquee: options.message.marquee,
      single: true,
    }

    if (options.message.theme === 'success') {
      Message.success(messageOptions)
    }
    else if (options.message.theme === 'warning') {
      Message.warning(messageOptions)
    }
    else if (options.message.theme === 'error') {
      Message.error(messageOptions)
    }
    else {
      Message.info(messageOptions)
    }

    Toast({
      context,
      selector: '#t-toast',
      message: options.toast.message,
      theme: options.toast.theme,
      duration: options.toast.duration,
      placement: options.toast.placement,
      direction: options.toast.direction,
    })

    return {
      layout: options.id,
      messageTheme: options.message.theme,
      toastTheme: options.toast.theme,
      toastPlacement: options.toast.placement,
      toastDirection: options.toast.direction,
      ok: true,
    }
  }
}

export function registerLayoutFeedback(handler: LayoutFeedbackHandler) {
  const page = resolveCurrentPage()
  if (page) {
    page.__layoutPowerFeedback = handler
  }
}

export function unregisterLayoutFeedback(handler: LayoutFeedbackHandler) {
  const page = resolveCurrentPage()
  if (page?.__layoutPowerFeedback === handler) {
    page.__layoutPowerFeedback = undefined
  }
}

export function callLayoutFeedback(): LayoutFeedbackResult {
  const page = resolveCurrentPage()
  const result = page?.__layoutPowerFeedback?.()
  return result ?? {
    layout: 'none',
    messageTheme: 'info',
    toastTheme: 'success',
    toastPlacement: 'middle',
    toastDirection: 'row',
    ok: false,
  }
}
