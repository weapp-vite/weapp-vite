/* eslint-disable */
// biome-ignore lint: disable
// oxlint-disable
// ------
// 由 weapp-vite autoImportComponents 生成
import type { ComponentOptionsMixin, DefineComponent, PublicProps } from 'wevu'
import type { ComponentProp } from 'weapp-vite/typed-components'

export {}

type WeappComponent<Props = Record<string, any>> = new (...args: any[]) => InstanceType<DefineComponent<{}, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}, string, PublicProps, Props, {}>>
type __WeappComponentImport<TModule, Fallback = {}> = 0 extends 1 & TModule ? Fallback : TModule extends { default: infer Component } ? Component & Fallback : Fallback

declare module 'wevu' {
  export interface GlobalComponents {
    HelloWorld: typeof import("./src/components/HelloWorld/index.vue")['default'];
    InfoBanner: typeof import("./src/components/InfoBanner/index.vue")['default'];
  }
}

// 用于 TSX 支持
declare global {
  const HelloWorld: typeof import("./src/components/HelloWorld/index.vue")['default']
  const InfoBanner: typeof import("./src/components/InfoBanner/index.vue")['default']
}
