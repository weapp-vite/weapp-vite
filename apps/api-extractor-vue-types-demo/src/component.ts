import type {
  Component,
  ComponentPublicInstance,
  DefineComponent,
  EmitsOptions,
  EmitsToProps,
  ExtractPropTypes,
  FunctionalComponent,
  PropType,
  SlotsType,
} from 'vue'

export type {
  Component,
  ComponentPublicInstance,
  DefineComponent,
  EmitsOptions,
  EmitsToProps,
  ExtractPropTypes,
  FunctionalComponent,
  PropType,
  SlotsType,
}

export type ComponentInstance<T extends Component = Component> = T extends new (
  ...args: any[]
) => infer I
  ? I
  : never

export type ComponentProps<T extends Component = Component> = T extends new (
  ...args: any[]
) => {
  $props: infer P
}
  ? P
  : never
