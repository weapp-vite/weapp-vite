import type { ComponentInternalInstance, SetupContext } from '@vue/runtime-core'
import { normalizeEmitPayload } from '../runtime/emit'

/** 虚拟 SFC 事件保留小程序 detail；model 更新监听直接接收单一 detail。 */
export function createNativeEmit(instance: ComponentInternalInstance, emit: SetupContext['emit']) {
  return (name: string, ...args: any[]) => {
    const { detail, options } = normalizeEmitPayload(args)
    if (options?.bubbles || options?.capturePhase || options?.composed) {
      throw new Error('[wevu] native-dom 的虚拟 SFC emit 暂不支持 bubbles/capturePhase/composed')
    }
    if (name.startsWith('update:')) {
      emit(name, detail)
      return
    }
    const event = { type: name, detail, target: instance.proxy, currentTarget: instance.proxy }
    const key = `on${name[0]?.toUpperCase() ?? ''}${name.slice(1).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}Capture`
    const capture = instance.vnode.props?.[key]
    for (const handler of Array.isArray(capture) ? capture : [capture]) {
      handler?.(event)
    }
    emit(name, event)
  }
}
