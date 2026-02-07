/* eslint-disable */
// biome-ignore lint: disable
// oxlint-disable
// ------
// 由 weapp-vite autoImportComponents 生成
import type { ComponentOptionsMixin, DefineComponent, PublicProps } from 'wevu'
import type { ComponentProp } from 'weapp-vite/typed-components'

export {}

type WeappComponent<Props = Record<string, any>> = new (...args: any[]) => InstanceType<DefineComponent<{}, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}, string, PublicProps, Props, {}>>
type __WeappComponentImport<T, Fallback = {}> = 0 extends 1 & T ? Fallback : T

declare module 'vue' {
  export interface GlobalComponents {
    AutoCard: __WeappComponentImport<typeof import("./src/components/AutoCard/index.vue")> & WeappComponent<ComponentProp<"AutoCard">>;
    NativeCard: __WeappComponentImport<typeof import("./src/components/NativeCard/index")> & WeappComponent<ComponentProp<"NativeCard">>;
    ResolverCard: WeappComponent<ComponentProp<"ResolverCard">>;
  }
}

// 用于 TSX 支持
declare global {
  const AutoCard: __WeappComponentImport<typeof import("./src/components/AutoCard/index.vue")> & WeappComponent<ComponentProp<"AutoCard">>
  const NativeCard: __WeappComponentImport<typeof import("./src/components/NativeCard/index")> & WeappComponent<ComponentProp<"NativeCard">>
  const ResolverCard: WeappComponent<ComponentProp<"ResolverCard">>
}
