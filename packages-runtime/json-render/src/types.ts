import type { JsonValue, RendererEvent } from '@wevu/json-render-components/types'
import type { z } from 'zod'

export type { JsonValue, RendererEvent, RenderNode } from '@wevu/json-render-components/types'

export interface StateExpression { $state: string }
export interface BindingExpression { $bindState: string }
export type Visibility = boolean | { $state: string, eq?: JsonValue, not?: true }

export interface ComponentDefinition {
  props: z.ZodType<Record<string, unknown>>
  container?: boolean
  events?: readonly string[]
  bindings?: Readonly<Record<string, string>>
}

export interface RendererCatalog {
  components: Record<string, ComponentDefinition>
  actions: Record<string, z.ZodType<Record<string, unknown>>>
}

export interface ActionBinding {
  action: string
  params?: Record<string, JsonValue | StateExpression>
}

export interface SpecElement {
  type: string
  props: Record<string, unknown>
  children?: string[]
  visible?: Visibility
  on?: Record<string, ActionBinding>
}

export interface RendererSpec {
  root: string
  elements: Record<string, SpecElement>
}

type ComponentProps<D extends ComponentDefinition> = z.input<D['props']>
type BindingKeys<D> = D extends { bindings: infer Bindings } ? keyof Bindings : never
type ExpressionParams<Params> = { [Key in keyof Params]: Params[Key] | StateExpression }
type TypedElement<C extends RendererCatalog> = {
  [Name in keyof C['components'] & string]: Omit<SpecElement, 'type' | 'props' | 'on'> & {
    type: Name
    props: { [Key in keyof ComponentProps<C['components'][Name]>]: ComponentProps<C['components'][Name]>[Key] | StateExpression | (Key extends BindingKeys<C['components'][Name]> ? BindingExpression : never) }
    on?: Record<string, {
      [Action in keyof C['actions'] & string]: {
        action: Action
        params?: ExpressionParams<z.input<C['actions'][Action]>>
      }
    }[keyof C['actions'] & string]>
  }
}[keyof C['components'] & string]

export interface CatalogSpec<C extends RendererCatalog> {
  root: string
  elements: Record<string, TypedElement<C>>
}

export interface RendererLimits {
  maxNodes?: number
  maxDepth?: number
  maxBufferedCharacters?: number
}

export interface ActionContext<State extends object> {
  readonly state: State
  readonly event: RendererEvent
  setState: (path: string, value: JsonValue) => void
  isActive: () => boolean
  onCleanup: (cleanup: () => void) => void
}

export type ActionHandlers<C extends RendererCatalog, State extends object> = {
  [Name in keyof C['actions']]: (params: z.output<C['actions'][Name]>, context: ActionContext<State>) => void | Promise<void>
}

export interface RendererOptions<C extends RendererCatalog, State extends object> {
  catalog: C
  spec: CatalogSpec<C>
  initialState: State
  actions: ActionHandlers<C, State>
  limits?: RendererLimits
}
