import type {
  HostEventHandler,
  MiniProgramPageAdapter,
  ReactMiniProgramRoot,
  ReactMiniProgramRootOptions,
} from '@weapp-vite/react'
import type { ReactElement } from 'react'
import { Button, createReactMiniProgramRoot, Text, View } from '@weapp-vite/react'
import { expectAssignable, expectType } from 'tsd'

const adapter: MiniProgramPageAdapter = {
  setData() {},
}
const options: ReactMiniProgramRootOptions = {
  renderMode: 'static-bindings',
}
const root = createReactMiniProgramRoot(adapter, options)

expectType<ReactMiniProgramRoot>(root)
expectAssignable<HostEventHandler>(() => {})
expectAssignable<ReactElement>(View({ children: 'view' }))
expectAssignable<ReactElement>(Text({ children: 'text' }))
expectAssignable<ReactElement>(Button({ children: 'button' }))
