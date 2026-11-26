import type { ActionPayload } from '@a2ui/web_core'

/** 可安全交给小程序视图层的 JSON 值。 */
export type A2uiJsonValue = string | number | boolean | null | A2uiJsonValue[] | { [key: string]: A2uiJsonValue }

/** 组件属性值；嵌套对象或数组可以携带投影后的子节点。 */
export type A2uiPropValue = A2uiJsonValue | A2uiNode | A2uiPropValue[] | { [key: string]: A2uiPropValue }

/** 由协议树投影出的组件无关节点；id 仅在当前 generation 内稳定。 */
export interface A2uiNode {
  readonly id: string
  readonly componentId: string
  readonly type: string
  readonly props: { readonly [key: string]: A2uiPropValue }
  readonly children: readonly A2uiNode[]
  /** 携带动作的属性名；触发方式由消费方组件决定。 */
  readonly actions: readonly string[]
}

export interface A2uiSurfaceView {
  readonly id: string
  readonly root: A2uiNode
}

export type A2uiInteraction
  = | { readonly type: 'input', readonly nodeId: string, readonly value: A2uiJsonValue, readonly bindingName?: string }
    | { readonly type: 'action', readonly nodeId: string, readonly actionName?: string }

export interface A2uiActionMessage {
  readonly version: '1.0'
  readonly action: ActionPayload
}

/** Core 通过 surface 事件上报的运行时或消息处理错误。 */
export interface A2uiErrorMessage {
  readonly code: string
  readonly message: string
  readonly surfaceId?: string
  readonly functionCallId?: string
  readonly expression?: string
  readonly details?: Record<string, unknown>
  readonly [key: string]: unknown
}

export interface A2uiSessionListeners {
  onSurfaces: (views: A2uiSurfaceView[]) => void
  onAction: (message: A2uiActionMessage) => void | Promise<void>
  onError?: (error: A2uiErrorMessage) => void | Promise<void>
}

export type A2uiFunctionHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>

export interface A2uiSessionOptions extends A2uiSessionListeners {
  /** A2UI 1.0 catalog 文档；组件与函数由消费方声明。 */
  catalog: Record<string, any>
  /** 可选 catalog 函数实现；未提供的已声明函数在调用时通过 onError 报错。 */
  functionImplementations?: Readonly<Record<string, A2uiFunctionHandler>>
}

export interface A2uiSession {
  receive: (message: unknown) => void
  interact: (surfaceId: string, event: A2uiInteraction) => Promise<void>
  dispose: () => void
}
