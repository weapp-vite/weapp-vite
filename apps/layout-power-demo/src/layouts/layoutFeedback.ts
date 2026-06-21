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
  feedback: 'message' | 'toast'
  messageTheme: MessageTheme
  toastTheme: ToastTheme
  toastPlacement: ToastPlacement
  toastDirection: ToastDirection
  ok: boolean
}

interface LayoutFeedbackHandlers {
  message: () => LayoutFeedbackResult
  toast: () => LayoutFeedbackResult
}
export type LayoutFeedbackComponent = WechatMiniprogram.Component.TrivialInstance & {
  __layoutPowerFeedbackHandlers?: LayoutFeedbackHandlers
}
type FeedbackPageInstance = WechatMiniprogram.Page.Instance<Record<string, unknown>, Record<string, unknown>> & {
  __layoutPowerFeedback?: LayoutFeedbackHandlers
}

function resolveCurrentPage() {
  const pages = getCurrentPages() as FeedbackPageInstance[]
  return pages[pages.length - 1]
}

export function createLayoutFeedback(
  context: LayoutFeedbackComponent,
  options: LayoutFeedbackOptions,
): LayoutFeedbackHandlers {
  const createResult = (feedback: LayoutFeedbackResult['feedback']): LayoutFeedbackResult => ({
    layout: options.id,
    feedback,
    messageTheme: options.message.theme,
    toastTheme: options.toast.theme,
    toastPlacement: options.toast.placement,
    toastDirection: options.toast.direction,
    ok: true,
  })

  return {
    message() {
      const messagePayload = {
        context,
        selector: '#t-message',
        content: options.message.content,
        duration: options.message.duration,
        align: options.message.align ?? 'left',
        closeBtn: options.message.closeBtn ?? false,
        marquee: options.message.marquee ?? {
          delay: 0,
          loop: 0,
          speed: 50,
        },
        single: true,
      }

      if (options.message.theme === 'success') {
        Message.success(messagePayload)
      }
      else if (options.message.theme === 'warning') {
        Message.warning(messagePayload)
      }
      else if (options.message.theme === 'error') {
        Message.error(messagePayload)
      }
      else {
        Message.info(messagePayload)
      }

      return createResult('message')
    },
    toast() {
      Toast({
        context,
        selector: '#t-toast',
        message: options.toast.message,
        theme: options.toast.theme,
        duration: options.toast.duration,
        placement: options.toast.placement,
        direction: options.toast.direction,
      })

      return createResult('toast')
    },
  }
}

export function registerLayoutFeedback(handler: LayoutFeedbackHandlers) {
  const page = resolveCurrentPage()
  if (page) {
    page.__layoutPowerFeedback = handler
  }
}

export function unregisterLayoutFeedback(handler: LayoutFeedbackHandlers) {
  const page = resolveCurrentPage()
  if (page?.__layoutPowerFeedback === handler) {
    page.__layoutPowerFeedback = undefined
  }
}

function createMissingResult(feedback: LayoutFeedbackResult['feedback']): LayoutFeedbackResult {
  return {
    layout: 'none',
    feedback,
    messageTheme: 'info',
    toastTheme: 'success',
    toastPlacement: 'middle',
    toastDirection: 'row',
    ok: false,
  }
}

export function callLayoutMessage(): LayoutFeedbackResult {
  const page = resolveCurrentPage()
  return page?.__layoutPowerFeedback?.message() ?? createMissingResult('message')
}

export function callLayoutToast(): LayoutFeedbackResult {
  const page = resolveCurrentPage()
  return page?.__layoutPowerFeedback?.toast() ?? createMissingResult('toast')
}
