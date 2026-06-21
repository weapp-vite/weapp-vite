import type { LayoutHostBridge } from 'weapp-vite/runtime'
import Message from 'tdesign-miniprogram/message/index'
import Toast from 'tdesign-miniprogram/toast/index'
import { registerLayoutHosts, unregisterLayoutHosts } from 'weapp-vite/runtime'

type ToastTheme = 'loading' | 'success' | 'warning' | 'error'
type ToastPlacement = 'top' | 'middle' | 'bottom'
type ToastDirection = 'row' | 'column'
type MessageTheme = 'info' | 'success' | 'warning' | 'error'
type MessageOffset = Array<string | number>
interface LayoutMessageHost {
  id: string
}

const MESSAGE_HIDE_DURATION = 400
const MESSAGE_CLEANUP_GAP = 80

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
  __layoutPowerMessageHosts?: LayoutMessageHost[]
  __layoutPowerMessageIndex?: number
  __layoutPowerMessageTimers?: Array<ReturnType<typeof setTimeout>>
  data: WechatMiniprogram.Component.TrivialInstance['data'] & {
    messageHosts?: LayoutMessageHost[]
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

function updateMessageHosts(context: LayoutFeedbackComponent, messageHosts: LayoutMessageHost[]) {
  context.__layoutPowerMessageHosts = messageHosts
  context.setData({
    messageHosts,
  })
}

function appendMessageHost(context: LayoutFeedbackComponent) {
  const nextIndex = (context.__layoutPowerMessageIndex ?? 0) + 1
  context.__layoutPowerMessageIndex = nextIndex

  const host = {
    id: `t-message-${nextIndex}`,
  }
  const messageHosts = [
    ...(context.__layoutPowerMessageHosts ?? context.data.messageHosts ?? []),
    host,
  ]

  return new Promise<LayoutMessageHost>((resolve) => {
    context.__layoutPowerMessageHosts = messageHosts
    context.setData({
      messageHosts,
    }, () => {
      resolve(host)
    })
  })
}

function removeMessageHost(context: LayoutFeedbackComponent, hostId: string) {
  const messageHosts = (context.__layoutPowerMessageHosts ?? context.data.messageHosts ?? [])
    .filter(host => host.id !== hostId)
  updateMessageHosts(context, messageHosts)
}

function scheduleMessageHostCleanup(
  context: LayoutFeedbackComponent,
  hostId: string,
  duration: number,
) {
  const timer = setTimeout(() => {
    removeMessageHost(context, hostId)
    context.__layoutPowerMessageTimers = (context.__layoutPowerMessageTimers ?? [])
      .filter(item => item !== timer)
  }, duration + MESSAGE_HIDE_DURATION + MESSAGE_CLEANUP_GAP)

  context.__layoutPowerMessageTimers = [
    ...(context.__layoutPowerMessageTimers ?? []),
    timer,
  ]
}

function clearMessageHosts(context: LayoutFeedbackComponent) {
  for (const timer of context.__layoutPowerMessageTimers ?? []) {
    clearTimeout(timer)
  }

  context.__layoutPowerMessageTimers = []
  context.__layoutPowerMessageHosts = []
  updateMessageHosts(context, [])
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
      const messageHost = await appendMessageHost(context)
      const messagePayload = {
        context,
        selector: `#${messageHost.id}`,
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
        single: false,
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

      scheduleMessageHostCleanup(context, messageHost.id, options.message.duration)
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
  clearMessageHosts(context)

  if (bridge) {
    unregisterLayoutFeedbackHost(bridge)
  }
}
