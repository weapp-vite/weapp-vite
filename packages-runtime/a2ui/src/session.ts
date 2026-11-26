import type { ComponentApi } from '@a2ui/web_core/catalog'
import type { SurfaceModel } from '@a2ui/web_core/state'
import type { A2uiNodeOperation, A2uiProjectedSurface } from './projection'
import type { A2uiActionMessage, A2uiInteraction, A2uiSession, A2uiSessionOptions, A2uiSurfaceView } from './types'
import { MessageProcessor, STRICT_VALIDATION } from '@a2ui/web_core/processing'
import { batchWrite, effect, getValue, peekValue, setValue, signal } from '@a2ui/web_core/reactivity'
import { NodeResolver } from '@a2ui/web_core/resolution'
import { createA2uiCatalog } from './catalog'
import { A2UI_STATE_MESSAGES, readA2uiEnvelope } from './envelope'
import { projectA2uiSurface } from './projection'

const ACTION_IDEMPOTENCY_WINDOW_MS = 30_000
const ACTION_IDEMPOTENCY_CAPACITY = 256

function clonePayload<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload)) as T
}

function cloneDataModelValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const result: unknown[] = []
    result.length = value.length
    for (let index = 0; index < value.length; index++) {
      if (index in value) {
        result[index] = cloneDataModelValue(value[index])
      }
    }
    return result
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      Object.defineProperty(result, key, {
        value: cloneDataModelValue(item),
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
    return result
  }
  return value
}

function selectOperation<T>(operations: ReadonlyMap<string, T>, name: string | undefined, kind: 'binding' | 'action', nodeId: string): T | undefined {
  if (name !== undefined) {
    const selected = operations.get(name)
    if (!selected) {
      throw new TypeError(`节点 '${nodeId}' 不存在名为 '${name}' 的${kind === 'binding' ? '输入绑定' : '动作'}。`)
    }
    return selected
  }
  if (operations.size === 1) {
    return operations.values().next().value
  }
  if (operations.size > 1) {
    throw new TypeError(`节点 '${nodeId}' 有多个${kind === 'binding' ? '输入绑定' : '动作'}，请指定${kind === 'binding' ? ' bindingName' : ' actionName'}。`)
  }
  return undefined
}

interface ResolvedSurface<T extends ComponentApi> {
  readonly resolver: NodeResolver<T>
  generation: number
  operations: Map<string, A2uiNodeOperation>
}

/**
 * 创建与页面生命周期解耦的 A2UI 渲染会话。
 *
 * 会话只处理 surface 状态消息，不接管 transport、agent 或 RPC；用户交互通过
 * `interact` 进入，动作经 `onAction` 交给调用方发送给 agent。
 */
export function createA2uiSession(options: A2uiSessionOptions): A2uiSession {
  const { catalog } = createA2uiCatalog(options.catalog, options.functionImplementations)
  const processor = new MessageProcessor([catalog], undefined, {
    validationConfig: { ...STRICT_VALIDATION, targetVersion: '1.0', allowedMessages: [...A2UI_STATE_MESSAGES] },
  })
  const surfaces = new Map<string, ResolvedSurface<ComponentApi>>()
  const revision = signal(0)
  let disposed = false
  let published = false
  let dispatch: A2uiActionMessage[] | undefined
  let actionQueue: Promise<void> = Promise.resolve()
  const pendingActions = new Map<string, Promise<void>>()
  const completedActions = new Map<string, number>()
  const actionSubscription = processor.model.onAction.subscribe((action) => {
    if (!disposed && dispatch) {
      dispatch.push({ version: '1.0', action: clonePayload(action) })
    }
  })
  const errorSubscription = processor.model.onError.subscribe((error) => {
    if (!disposed) {
      return options.onError?.(clonePayload(error))
    }
  })
  const stopProjection = effect(() => {
    getValue(revision)
    const views: A2uiSurfaceView[] = []
    for (const [id, active] of surfaces) {
      const projected: A2uiProjectedSurface = projectA2uiSurface(getValue(active.resolver.rootNode), active.generation)
      active.operations = projected.operations
      if (projected.root) {
        views.push({ id, root: projected.root })
      }
    }
    if (disposed || (!published && views.length === 0)) {
      return
    }
    published = views.length > 0
    options.onSurfaces(views)
  })

  function attach(surface: SurfaceModel<ComponentApi>) {
    surfaces.set(surface.id, {
      resolver: new NodeResolver(surface) as unknown as NodeResolver<ComponentApi>,
      generation: 0,
      operations: new Map(),
    })
  }

  function detach(surfaceId: string) {
    const active = surfaces.get(surfaceId)
    if (!active) {
      return
    }
    surfaces.delete(surfaceId)
    active.resolver.dispose()
    active.operations.clear()
  }

  return {
    receive(message) {
      if (disposed) {
        return
      }
      const envelope = readA2uiEnvelope(message)
      const { type, surfaceId } = envelope
      batchWrite(() => {
        const previous = surfaceId === undefined ? undefined : processor.getSurface(surfaceId)
        const rollback = type === 'updateDataModel' && previous
          ? { surface: previous, data: cloneDataModelValue(previous.dataModel.get('/')) }
          : undefined
        try {
          processor.processMessages(envelope.message as Parameters<typeof processor.processMessages>[0])
        }
        catch (error) {
          if (rollback) {
            rollback.surface.dataModel.set('/', rollback.data)
          }
          // Core 会先注册内联 createSurface，再校验其组件批次。
          if (type === 'createSurface' && !previous && surfaceId !== undefined) {
            processor.model.deleteSurface(surfaceId)
          }
          throw error
        }
        if (surfaceId === undefined) {
          return
        }
        if (type === 'createSurface') {
          const surface = processor.getSurface(surfaceId)
          if (surface) {
            attach(surface)
          }
        }
        else if (type === 'deleteSurface') {
          detach(surfaceId)
        }
        else if (envelope.replacesBindings) {
          const active = surfaces.get(surfaceId)
          if (active) {
            active.generation += 1
            active.operations.clear()
          }
        }
        if (type !== 'updateDataModel' || envelope.replacesBindings) {
          setValue(revision, peekValue(revision) + 1)
        }
      })
    },
    async interact(surfaceId, event: A2uiInteraction) {
      if (disposed) {
        return
      }
      let actionKey: string | undefined
      if (event.type === 'action' && event.eventId !== undefined) {
        if (typeof event.eventId !== 'string' || event.eventId.trim().length === 0) {
          throw new TypeError('动作 eventId 必须是非空字符串。')
        }
        actionKey = JSON.stringify([surfaceId, event.eventId])
        const completedAt = completedActions.get(actionKey)
        if (completedAt !== undefined) {
          if (Date.now() - completedAt < ACTION_IDEMPOTENCY_WINDOW_MS) {
            completedActions.delete(actionKey)
            completedActions.set(actionKey, completedAt)
            return
          }
          completedActions.delete(actionKey)
        }
        const pending = pendingActions.get(actionKey)
        if (pending) {
          return pending
        }
      }
      const operation = surfaces.get(surfaceId)?.operations.get(event.nodeId)
      if (!operation) {
        return
      }
      if (event.type === 'input') {
        const binding = selectOperation(operation.inputs, event.bindingName, 'binding', event.nodeId)
        if (binding && binding.value !== event.value) {
          batchWrite(() => binding.set(event.value))
        }
        return
      }
      const action = selectOperation(operation.actions, event.actionName, 'action', event.nodeId)
      if (!action) {
        return
      }
      // Core 的动作消息没有调用上下文，消息捕获必须串行；handler 内 await interact 会等待当前队列，由调用方避免。
      const messages: A2uiActionMessage[] = []
      const execution = actionQueue.then(async () => {
        if (disposed) {
          return
        }
        dispatch = messages
        try {
          await action()
        }
        finally {
          if (dispatch === messages) {
            dispatch = undefined
          }
        }
      })
      actionQueue = execution.catch(() => {})
      const completion = (async () => {
        await execution
        for (const message of messages) {
          if (disposed) {
            return
          }
          await options.onAction(message)
        }
      })()
      if (actionKey !== undefined) {
        pendingActions.set(actionKey, completion)
      }
      try {
        await completion
      }
      finally {
        if (actionKey !== undefined && pendingActions.get(actionKey) === completion) {
          pendingActions.delete(actionKey)
        }
      }
      if (actionKey !== undefined && !disposed) {
        completedActions.delete(actionKey)
        completedActions.set(actionKey, Date.now())
        while (completedActions.size > ACTION_IDEMPOTENCY_CAPACITY) {
          const oldest = completedActions.keys().next().value
          if (oldest === undefined) {
            break
          }
          completedActions.delete(oldest)
        }
      }
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      pendingActions.clear()
      completedActions.clear()
      stopProjection()
      actionSubscription.unsubscribe()
      errorSubscription.unsubscribe()
      for (const id of surfaces.keys()) {
        detach(id)
      }
      processor.model.dispose()
      processor.dispose()
    },
  }
}
