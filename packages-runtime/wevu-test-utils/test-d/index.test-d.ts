import type { Ref } from 'wevu'
import { mountComposable } from '@wevu/test-utils'
import { expectType } from 'tsd'

const wrapper = mountComposable<{ count: Ref<number>, increment: () => void }, { initial: number }>((props) => {
  return {
    count: { value: props.initial } as Ref<number>,
    increment() {},
  }
}, { props: { initial: 1 } })

expectType<Ref<number>>(wrapper.vm.count)
expectType<void>(wrapper.vm.increment())
expectType<Promise<void>>(wrapper.nextTick())
expectType<Promise<void>>(wrapper.setProps({ initial: 2 }))
expectType<Promise<void>>(wrapper.setData({ count: 2 }))
expectType<unknown[][] | undefined>(wrapper.emitted('change'))
expectType<boolean>(wrapper.isUnmounted)
