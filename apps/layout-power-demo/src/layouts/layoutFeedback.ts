import Message from 'tdesign-miniprogram/message/index'
import Toast from 'tdesign-miniprogram/toast/index'

type ToastTheme = 'loading' | 'success' | 'warning' | 'error'
type ToastPlacement = 'top' | 'middle' | 'bottom'
type ToastDirection = 'row' | 'column'
type MessageTheme = 'info' | 'success' | 'warning' | 'error'
type MessageOffset = Array<string | number>

export interface LayoutFeedbackOptions {
  id: string
  message: {
    content: string
    theme: MessageTheme
    duration: number
    align?: string
    closeBtn?: boolean
    offset?: MessageOffset
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
  messageOffsetTop: number
  ok: boolean
}

interface LayoutFeedbackHandlers {
  message: () => LayoutFeedbackResult
  toast: () => LayoutFeedbackResult
}
export type LayoutFeedbackComponent = WechatMiniprogram.Component.TrivialInstance & {
  __layoutPowerFeedbackHandlers?: LayoutFeedbackHandlers
  data: WechatMiniprogram.Component.TrivialInstance['data'] & {
    messageOffset?: MessageOffset
  }
}
type FeedbackPageInstance = WechatMiniprogram.Page.Instance<Record<string, unknown>, Record<string, unknown>> & {
  __layoutPowerFeedbackByLayout?: Record<string, LayoutFeedbackHandlers | undefined>
}

function resolveCurrentPage() {
  const pages = getCurrentPages() as FeedbackPageInstance[]
  return pages[pages.length - 1]
}

function resolveMessageOffset(context: LayoutFeedbackComponent, options: LayoutFeedbackOptions): MessageOffset {
  return options.message.offset ?? context.data.messageOffset ?? [76, 16]
}

function resolveMessageOffsetTop(offset: MessageOffset) {
  const value = offset[0]
  if (typeof value === 'number') {
    return value
  }

  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function createLayoutFeedback(
  context: LayoutFeedbackComponent,
  options: LayoutFeedbackOptions,
): LayoutFeedbackHandlers {
  const messageOffset = resolveMessageOffset(context, options)
  const createResult = (feedback: LayoutFeedbackResult['feedback']): LayoutFeedbackResult => ({
    layout: options.id,
    feedback,
    messageTheme: options.message.theme,
    toastTheme: options.toast.theme,
    toastPlacement: options.toast.placement,
    toastDirection: options.toast.direction,
    messageOffsetTop: resolveMessageOffsetTop(messageOffset),
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
        offset: messageOffset,
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

export function registerLayoutFeedback(layout: string, handler: LayoutFeedbackHandlers) {
  const page = resolveCurrentPage()
  if (page) {
    page.__layoutPowerFeedbackByLayout = {
      ...page.__layoutPowerFeedbackByLayout,
      [layout]: handler,
    }
  }
}

export function unregisterLayoutFeedback(layout: string, handler: LayoutFeedbackHandlers) {
  const page = resolveCurrentPage()
  if (page?.__layoutPowerFeedbackByLayout?.[layout] === handler) {
    page.__layoutPowerFeedbackByLayout = {
      ...page.__layoutPowerFeedbackByLayout,
      [layout]: undefined,
    }
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
    messageOffsetTop: 0,
    ok: false,
  }
}

export function hasLayoutFeedback(layout: string) {
  const page = resolveCurrentPage()
  return Boolean(page?.__layoutPowerFeedbackByLayout?.[layout])
}

export function callLayoutMessage(layout: string): LayoutFeedbackResult {
  const page = resolveCurrentPage()
  return page?.__layoutPowerFeedbackByLayout?.[layout]?.message() ?? createMissingResult('message')
}

export function callLayoutToast(layout: string): LayoutFeedbackResult {
  const page = resolveCurrentPage()
  return page?.__layoutPowerFeedbackByLayout?.[layout]?.toast() ?? createMissingResult('toast')
}
