import type { ActionContext, CatalogSpec, JsonValue, RendererCatalog, RendererEvent, RendererOptions, RendererSpec } from './types'
import { computed, reactive, shallowRef } from 'wevu'
import { resolveBindings, resolveElementProps } from './core'
import { cloneJson, writeState } from './path'
import { findRenderNode, projectRendererSpec } from './projection'
import { createSpecStream } from './stream'
import { validateRendererSpec } from './validation'

/** 创建与页面生命周期解耦的渲染会话；动作只通过上下文提交有效状态更新。 */
export function createJsonRenderer<C extends RendererCatalog, State extends object>(options: RendererOptions<C, State>) {
  const state = reactive(cloneJson(options.initialState)) as State
  const spec = shallowRef<RendererSpec>(validateRendererSpec(options.spec, options.catalog, state, options.limits).spec)
  const error = shallowRef<string | null>(null)
  const pending = shallowRef<string[]>([])
  const tree = computed(() => projectRendererSpec(spec.value, options.catalog, state))
  let disposed = false
  let generation = 0
  let streamGeneration = 0
  let currentStream: ReturnType<typeof createSpecStream> | undefined
  const cleanups = new Set<() => void>()

  function report(reason: unknown) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  }

  function cancel() {
    generation++
    streamGeneration++
    currentStream?.dispose()
    currentStream = undefined
    for (const cleanup of [...cleanups]) {
      try {
        cleanup()
      }
      catch (reason) {
        report(reason)
      }
    }
    cleanups.clear()
    pending.value = []
  }

  function setState(path: string, value: JsonValue) {
    if (disposed) {
      return
    }
    const draft = cloneJson(state)
    writeState(draft, path, value)
    // 同时验证投影，拒绝导致宿主 props 类型不匹配的状态更新。
    projectRendererSpec(spec.value, options.catalog, draft)
    writeState(state, path, value)
  }

  function load(input: unknown, nextState?: State) {
    if (disposed) {
      return false
    }
    try {
      const draftState = cloneJson(nextState ?? state)
      const checked = validateRendererSpec(input, options.catalog, draftState, options.limits)
      cancel()
      if (nextState) {
        for (const key of Object.keys(state)) {
          Reflect.deleteProperty(state, key)
        }
        Object.assign(state, draftState)
      }
      spec.value = checked.spec
      error.value = null
      return true
    }
    catch (reason) {
      report(reason)
      return false
    }
  }

  async function dispatch(event: RendererEvent): Promise<boolean> {
    if (disposed || !findRenderNode(tree.value, event.id)) {
      return false
    }
    const node = spec.value.elements[event.id]!
    const definition = options.catalog.components[node.type]!
    if (!definition.events?.includes(event.name)) {
      return false
    }
    try {
      const bindings = resolveBindings(node.props, { stateModel: state as Record<string, unknown> })
      for (const [prop, name] of Object.entries(definition.bindings ?? {})) {
        if (name === event.name && bindings?.[prop]) {
          if (event.value === undefined) {
            throw new Error(`绑定事件缺少 value：${event.name}`)
          }
          setState(bindings[prop], event.value)
        }
      }
      const binding = node.on?.[event.name]
      if (!binding) {
        return true
      }
      const key = `${event.id}:${binding.action}`
      if (pending.value.includes(key)) {
        return false
      }
      const handler = options.actions[binding.action]
      if (!Object.prototype.hasOwnProperty.call(options.actions, binding.action) || typeof handler !== 'function') {
        throw new TypeError(`动作缺少处理器：${binding.action}`)
      }
      const params = options.catalog.actions[binding.action]!.parse(resolveElementProps(binding.params ?? {}, { stateModel: state as Record<string, unknown> }))
      const ownGeneration = generation
      const isActive = () => !disposed && generation === ownGeneration
      const actionCleanups = new Set<() => void>()
      const context: ActionContext<State> = {
        state,
        event,
        isActive,
        setState(path, value) {
          if (isActive()) {
            setState(path, value)
          }
        },
        onCleanup(cleanup) {
          if (isActive()) {
            cleanups.add(cleanup)
            actionCleanups.add(cleanup)
          }
          else {
            cleanup()
          }
        },
      }
      pending.value = [...pending.value, key]
      error.value = null
      try {
        await handler(params as Parameters<typeof handler>[0], context)
        return isActive()
      }
      catch (reason) {
        if (isActive()) {
          report(reason)
        }
        return false
      }
      finally {
        for (const cleanup of actionCleanups) {
          if (cleanups.delete(cleanup)) {
            try {
              cleanup()
            }
            catch (reason) {
              report(reason)
            }
          }
        }
        if (isActive()) {
          pending.value = pending.value.filter(item => item !== key)
        }
      }
    }
    catch (reason) {
      report(reason)
      return false
    }
  }

  function createStream(initialSpec?: CatalogSpec<C>) {
    const initial = validateRendererSpec(initialSpec ?? spec.value, options.catalog, state, options.limits).spec
    const stream = createSpecStream(initial, options.catalog, state, options.limits)
    currentStream?.dispose()
    const ownGeneration = ++streamGeneration
    spec.value = initial
    currentStream = stream
    error.value = null
    return {
      push(chunk: string, done = false) {
        if (disposed || ownGeneration !== streamGeneration) {
          return false
        }
        try {
          const next = stream.push(chunk, done)
          if (next) {
            spec.value = next
          }
          return next !== null
        }
        catch (reason) {
          report(reason)
          return false
        }
      },
      dispose: () => stream.dispose(),
    }
  }

  return {
    state,
    spec,
    tree,
    error,
    pending,
    setState,
    load,
    dispatch,
    createStream,
    dispose() {
      if (!disposed) {
        disposed = true
        cancel()
      }
    },
  }
}
