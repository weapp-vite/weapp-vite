import type {
  HostEventHandler,
  MiniProgramPageAdapter,
  NativeComponentProps,
  ReactMiniProgramRoot,
  ReactMiniProgramRootOptions,
} from '@weapp-vite/react'
import type { ReactElement } from 'react'
import { Button, createNativeComponent, createReactMiniProgramRoot, Slot, Text, View } from '@weapp-vite/react'
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
expectAssignable<ReactElement>(Slot({}))

interface NativeCardProps {
  label: string
  onValueChange?: HostEventHandler
}

const NativeCard = createNativeComponent<NativeCardProps>('native-card')
expectAssignable<ReactElement>(NativeCard({
  children: 'slot content',
  label: 'typed',
  onValueChange() {},
}))
expectAssignable<NativeComponentProps<NativeCardProps>>({ label: 'typed' })
expectAssignable<NativeComponentProps<NativeCardProps>>({
  className: 'card',
  id: 'native-card',
  label: 'typed',
})
