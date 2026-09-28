export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export interface RenderNode {
  id: string
  type: string
  props: Record<string, JsonValue>
  children: RenderNode[]
}

export interface RendererEvent {
  id: string
  name: string
  value?: JsonValue
}
