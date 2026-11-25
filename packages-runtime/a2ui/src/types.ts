import type { ActionPayload } from '@a2ui/web_core'

/** 可安全交给小程序视图层的 JSON 值。 */
export type A2uiJsonValue = string | number | boolean | null | A2uiJsonValue[] | { [key: string]: A2uiJsonValue }

/** 由协议树投影出的组件无关节点；id 仅在当前 generation 内稳定。 */
export interface A2uiNode {
  readonly id: string
  readonly componentId: string
  readonly type: string
  readonly props: { readonly [key: string]: A2uiJsonValue }
  readonly children: readonly A2uiNode[]
  /** 携带动作的属性名；触发方式由消费方组件决定。 */
  readonly actions: readonly string[]
}

export interface A2uiSurfaceView {
  readonly id: string
  readonly root: A2uiNode
}

export type A2uiInteraction
  = | { readonly type: 'input', readonly nodeId: string, readonly value: string }
    | { readonly type: 'action', readonly nodeId: string }

export interface A2uiActionMessage {
  readonly version: '1.0'
  readonly action: ActionPayload
}

export interface A2uiSessionListeners {
  onSurfaces: (views: A2uiSurfaceView[]) => void
  onAction: (message: A2uiActionMessage) => void | Promise<void>
}

export interface A2uiSessionOptions extends A2uiSessionListeners {
  /** A2UI 1.0 catalog 文档；组件与函数由消费方声明。 */
  catalog: Record<string, any>
}

export interface A2uiSession {
  receive: (message: unknown) => void
  interact: (surfaceId: string, event: A2uiInteraction) => Promise<void>
  dispose: () => void
}
