/* eslint-disable ts/no-use-before-define -- 函数声明会被提升，会话回调只在会话构造完成之后执行。 */
import type { A2uiActionMessage, A2uiInteraction, A2uiNode, A2uiSurfaceView } from '@wevu/a2ui'
import { createA2uiSession } from '@wevu/a2ui'
import { computed, reactive, shallowRef } from 'wevu'
import { demoCatalog } from '../catalog'
import {
  agentReplies,
  createInitialMessages,
  invalidMessage,
  pendingMessage,
  streamedMessages,
  SURFACE_ID,
} from '../fixtures/afterSales'
import { recordCancelledTasks } from './metrics'

const REPLY_DELAY_MS = 600
const PLAYBACK_STEP_MS = 25

function deleteSurfaceMessage(surfaceId: string) {
  return { version: '1.0', deleteSurface: { surfaceId } }
}

function findNode(node: A2uiNode | undefined, componentId: string): A2uiNode | undefined {
  if (!node) {
    return undefined
  }
  if (node.componentId === componentId) {
    return node
  }
  for (const child of node.children) {
    const found = findNode(child, componentId)
    if (found) {
      return found
    }
  }
  return undefined
}

function textOf(node: A2uiNode | undefined, key = 'text') {
  const value = node?.props[key]
  return typeof value === 'string' ? value : ''
}

/**
 * 演示会话：把 A2UI 会话包装成页面可直接消费的响应式模型。
 *
 * 服务端由本地假 agent 代替：动作外发后延时回写数据模型，用于观察输入保留、
 * 模板列表重建与异常消息下的界面保持。
 */
export function createDemoSession() {
  const views = shallowRef<A2uiSurfaceView[]>([])
  const actions = shallowRef<A2uiActionMessage[]>([])
  const error = shallowRef('')
  const activity = reactive({ playing: false, pending: false, submissions: 0, replies: 0, delivered: 0 })
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let disposed = false

  function schedule(task: () => void, delay: number) {
    const timer = setTimeout(() => {
      timers.delete(timer)
      if (!disposed) {
        task()
      }
    }, delay)
    timers.add(timer)
  }

  function clearTimers() {
    for (const timer of timers) {
      clearTimeout(timer)
    }
    timers.clear()
  }

  const session = createA2uiSession({
    catalog: demoCatalog,
    onSurfaces: (next) => {
      if (!disposed) {
        views.value = next
      }
    },
    async onAction(message) {
      if (disposed) {
        return
      }
      activity.delivered++
      actions.value = [...actions.value, message]
      if (message.action.name === 'submit') {
        receive(pendingMessage)
      }
      await new Promise<void>(resolve => schedule(resolve, REPLY_DELAY_MS))
      for (const reply of agentReplies(message)) {
        receive(reply)
      }
      activity.replies++
      if (message.action.name === 'submit') {
        activity.pending = false
      }
    },
  })

  const root = computed(() => views.value.find(view => view.id === SURFACE_ID)?.root)

  function receive(message: unknown) {
    if (disposed) {
      return false
    }
    try {
      session.receive(message)
      error.value = ''
      return true
    }
    catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      activity.playing = false
      return false
    }
  }

  function load() {
    if (disposed) {
      return
    }
    clearTimers()
    Object.assign(activity, { playing: false, pending: false, submissions: 0, replies: 0, delivered: 0 })
    actions.value = []
    if (views.value.some(view => view.id === SURFACE_ID)) {
      receive(deleteSurfaceMessage(SURFACE_ID))
    }
    for (const message of createInitialMessages()) {
      receive(message)
    }
  }

  function push(message: unknown) {
    return receive(message)
  }

  function play() {
    if (disposed || activity.playing) {
      return
    }
    activity.playing = true
    let index = 0
    const step = () => {
      if (disposed || !activity.playing) {
        return
      }
      const committed = push(streamedMessages[index++])
      if (index >= streamedMessages.length || !committed) {
        activity.playing = false
        return
      }
      schedule(step, PLAYBACK_STEP_MS)
    }
    schedule(step, PLAYBACK_STEP_MS)
  }

  function injectInvalid() {
    push(invalidMessage)
  }

  function interact(event: A2uiInteraction) {
    if (disposed) {
      return
    }
    const target = nodeIdOf(root.value, event.nodeId)
    if (event.type === 'action' && activity.pending && target === 'submit') {
      return
    }
    if (event.type === 'action' && target === 'submit') {
      activity.pending = true
      activity.submissions++
    }
    void session.interact(SURFACE_ID, event).catch((cause: unknown) => {
      error.value = cause instanceof Error ? cause.message : String(cause)
      activity.pending = false
    })
  }

  /** 交互事件携带投影节点 id，这里换回稳定的 componentId 以便按组件判断。 */
  function nodeIdOf(node: A2uiNode | undefined, id: string): string | undefined {
    if (!node) {
      return undefined
    }
    if (node.id === id) {
      return node.componentId
    }
    for (const child of node.children) {
      const found = nodeIdOf(child, id)
      if (found !== undefined) {
        return found
      }
    }
    return undefined
  }

  const model = computed(() => {
    const current = root.value
    return {
      surfaceIds: views.value.map(view => view.id),
      error: error.value,
      playing: activity.playing,
      pending: activity.pending,
      submissions: activity.submissions,
      replies: activity.replies,
      delivered: activity.delivered,
      actionNames: actions.value.map(message => message.action.name),
      title: textOf(findNode(current, 'formTitle')),
      reason: textOf(findNode(current, 'reason'), 'value'),
      detail: textOf(findNode(current, 'detail'), 'value'),
      status: textOf(findNode(current, 'status')),
      progress: textOf(findNode(current, 'progress')),
      hint: textOf(findNode(current, 'hint')),
      steps: (findNode(current, 'progressList')?.children ?? []).map(node => textOf(node)),
    }
  })

  return {
    views,
    model,
    root,
    load,
    play,
    push,
    receive,
    injectInvalid,
    interact,
    reset: load,
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      // 回包与增量都走 schedule()，卸载时按待取消的定时任务计数，用于证明清理确实执行。
      recordCancelledTasks(timers.size)
      clearTimers()
      activity.playing = false
      views.value = []
      session.dispose()
    },
  }
}
