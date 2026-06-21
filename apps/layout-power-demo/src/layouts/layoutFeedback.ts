import type { LayoutHostBridge } from 'weapp-vite/runtime'
import Message from 'tdesign-miniprogram/message/index'
import Toast, { hideToast } from 'tdesign-miniprogram/toast/index'
import { registerLayoutHosts, unregisterLayoutHosts } from 'weapp-vite/runtime'

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

export interface LayoutFeedbackHost {
  message: () => Promise<LayoutFeedbackResult>
  toast: () => LayoutFeedbackResult
}

export type LayoutFeedbackComponent = WechatMiniprogram.Component.TrivialInstance & {
  __layoutPowerFeedbackBridge?: LayoutHostBridge | null
  data: WechatMiniprogram.Component.TrivialInstance['data'] & {
    messageOffset?: MessageOffset
  }
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

export function createLayoutFeedbackHost(
  context: LayoutFeedbackComponent,
  options: LayoutFeedbackOptions,
): LayoutFeedbackHost {
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
    async message() {
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

export function registerLayoutFeedbackHost(layout: string, host: LayoutFeedbackHost) {
  return registerLayoutHosts({
    [layout]: host,
  })
}

export function unregisterLayoutFeedbackHost(bridge: LayoutHostBridge) {
  return unregisterLayoutHosts(bridge)
}

export function destroyLayoutFeedbackHost(
  context: LayoutFeedbackComponent,
  bridge?: LayoutHostBridge | null,
) {
  Message.hide({
    context,
    selector: '#t-message',
  })
  hideToast({
    context,
    selector: '#t-toast',
  })

  if (bridge) {
    unregisterLayoutFeedbackHost(bridge)
  }
}
