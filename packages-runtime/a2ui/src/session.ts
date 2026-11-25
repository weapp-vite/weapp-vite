import type { ActionPayload, ComponentApi, SurfaceModel } from '@a2ui/web_core'
import type { A2uiNodeOperation, A2uiProjectedSurface } from './projection'
import type { A2uiActionMessage, A2uiInteraction, A2uiSession, A2uiSessionOptions, A2uiSurfaceView } from './types'
import {
  batchWrite,
  effect,
  getValue,
  MessageProcessor,
  NodeResolver,
  peekValue,
  setValue,
  signal,
  STRICT_VALIDATION,
} from '@a2ui/web_core'
import { createA2uiCatalog } from './catalog'
import { A2UI_STATE_MESSAGES, readA2uiEnvelope } from './envelope'
import { projectA2uiSurface } from './projection'

function cloneAction(action: ActionPayload): ActionPayload {
  return JSON.parse(JSON.stringify(action)) as ActionPayload
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
  const { catalog } = createA2uiCatalog(options.catalog)
  const processor = new MessageProcessor([catalog], undefined, {
    validationConfig: { ...STRICT_VALIDATION, targetVersion: '1.0', allowedMessages: [...A2UI_STATE_MESSAGES] },
  })
  const surfaces = new Map<string, ResolvedSurface<ComponentApi>>()
  const revision = signal(0)
  let disposed = false
  let published = false
  let dispatch: A2uiActionMessage[] | undefined
  const actionSubscription = processor.model.onAction.subscribe((action) => {
    if (!disposed && dispatch) {
      dispatch.push({ version: '1.0', action: cloneAction(action) })
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
        try {
          processor.processMessages(envelope.message)
        }
        catch (error) {
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
      const operation = surfaces.get(surfaceId)?.operations.get(event.nodeId)
      if (!operation) {
        return
      }
      if (event.type === 'input' && operation.input) {
        const binding = operation.input
        if (binding.value !== event.value) {
          batchWrite(() => binding.set(event.value))
        }
        return
      }
      if (event.type !== 'action' || !operation.action) {
        return
      }
      const messages: A2uiActionMessage[] = []
      let completion
      dispatch = messages
      try {
        completion = operation.action()
      }
      finally {
        dispatch = undefined
      }
      await completion
      for (const message of messages) {
        if (disposed) {
          return
        }
        await options.onAction(message)
      }
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      stopProjection()
      actionSubscription.unsubscribe()
      for (const id of surfaces.keys()) {
        detach(id)
      }
      processor.model.dispose()
      processor.dispose()
    },
  }
}
