/** Wevu JSX island 使用的内部节点结构。 */
export interface WevuJsxVNode {
  children?: unknown
  props?: Record<string, unknown> | null
  type: unknown
}
