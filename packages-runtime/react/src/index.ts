/// <reference types="miniprogram-api-typings" />

export { Button, createNativeComponent, Input, Slot, Text, View } from './components'
export type { NativeComponentProps } from './components'
export { createReactMiniProgramRoot } from './renderer'
export type { ReactMiniProgramRoot, ReactMiniProgramRootOptions } from './renderer'
export type {
  HostEventHandler,
  HostProps,
  MiniProgramEventLike,
  MiniProgramHostProps,
  MiniProgramPageAdapter,
  SerializedHostNode,
} from './types'
