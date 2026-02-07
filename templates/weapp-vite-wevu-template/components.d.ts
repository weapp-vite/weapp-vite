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

declare module 'wevu' {
  export interface GlobalComponents {
    HelloWorld: __WeappComponentImport<typeof import("./src/components/HelloWorld/index.vue")> & WeappComponent<ComponentProp<"HelloWorld">>;
  }
}

// 用于 TSX 支持
declare global {
  const HelloWorld: __WeappComponentImport<typeof import("./src/components/HelloWorld/index.vue")> & WeappComponent<ComponentProp<"HelloWorld">>
}
