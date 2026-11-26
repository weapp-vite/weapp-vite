import type { ComponentApi } from '@a2ui/web_core/catalog'
import type { SurfaceModel } from '@a2ui/web_core/state'
import type { A2uiEnvelope } from './envelope'
import type { A2uiNodeOperation, A2uiProjectedSurface } from './projection'
import type { A2uiActionMessage, A2uiInteraction, A2uiRendererDataModel, A2uiSession, A2uiSessionOptions, A2uiSurfaceView, A2uiTransportMetadata } from './types'
import { MessageProcessor, STRICT_VALIDATION } from '@a2ui/web_core/processing'
import { batchWrite, effect, getValue, peekValue, setValue, signal } from '@a2ui/web_core/reactivity'
import { NodeResolver } from '@a2ui/web_core/resolution'
import { createA2uiCatalog } from './catalog'
import { A2UI_STATE_MESSAGES, readA2uiEnvelopes } from './envelope'
import { projectA2uiSurface } from './projection'
import { cloneDataModelValue, selectOperation } from './session/helpers'

const ACTION_IDEMPOTENCY_WINDOW_MS = 30_000
const ACTION_IDEMPOTENCY_CAPACITY = 256

function clonePayload<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload)) as T
}

interface ResolvedSurface<T extends ComponentApi> {
  readonly resolver: NodeResolver<T>
  generation: number
  operations: Map<string, A2uiNodeOperation>
}

interface CapturedAction {
  readonly message: A2uiActionMessage
  readonly metadata?: A2uiTransportMetadata
}

/**
 * 创建与页面生命周期解耦的 A2UI 渲染会话。
 *
 * 会话只处理 surface 状态消息，不接管 transport、agent 或 RPC；用户交互通过
 * `interact` 进入，动作经 `onAction` 交给调用方发送给 agent。
 */
export function createA2uiSession(options: A2uiSessionOptions): A2uiSession {
  const { catalog } = createA2uiCatalog(options.catalog, options.functionImplementations, { locale: options.locale })
  const processor = new MessageProcessor([catalog], undefined, {
    validationConfig: { ...STRICT_VALIDATION, targetVersion: '1.0', allowedMessages: [...A2UI_STATE_MESSAGES] },
  })
  function readTransportMetadata(): A2uiTransportMetadata | undefined {
    const dataModel = processor.getRendererDataModel('1.0')
    if (!dataModel) {
      return undefined
    }
    return { a2uiRendererDataModel: clonePayload(dataModel) as unknown as A2uiRendererDataModel }
  }
  const surfaces = new Map<string, ResolvedSurface<ComponentApi>>()
  const revision = signal(0)
  let disposed = false
  let published = false
  let dispatch: CapturedAction[] | undefined
  let actionQueue: Promise<void> = Promise.resolve()
  const pendingActions = new Map<string, Promise<void>>()
  const completedActions = new Map<string, number>()
  const actionSubscription = processor.model.onAction.subscribe((action) => {
    if (!disposed && dispatch) {
      dispatch.push({
        message: { version: '1.0', action: clonePayload(action) },
        metadata: readTransportMetadata(),
      })
    }
  })
  const errorSubscription = processor.model.onError.subscribe((error) => {
    if (!disposed) {
      return options.onError?.(clonePayload(error), readTransportMetadata())
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

  function applyEnvelope(envelope: A2uiEnvelope) {
    const { type, surfaceId } = envelope
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
  }

  return {
    receive(message) {
      if (disposed) {
        return
      }
      const envelopes = readA2uiEnvelopes(message)
      batchWrite(() => {
        for (const envelope of envelopes) {
          applyEnvelope(envelope)
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
      const messages: CapturedAction[] = []
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
        for (const captured of messages) {
          if (disposed) {
            return
          }
          await options.onAction(captured.message, captured.metadata)
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
