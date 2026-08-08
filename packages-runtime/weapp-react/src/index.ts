/// <reference types="miniprogram-api-typings" />

export { Button, Input, Text, View } from './components'
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
