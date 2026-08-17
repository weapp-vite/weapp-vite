import type { Ref } from 'wevu'
import { mount, mountComponent, mountComposable } from '@wevu/test-utils'
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

interface SfcInstance {
  $props: { count?: number }
  doubled: Ref<number>
  increment: () => void
}
const sfc = {} as new () => SfcInstance
const sfcWrapper = mountComponent(sfc, { props: { count: 2 } })
expectType<Ref<number>>(sfcWrapper.vm.doubled)
expectType<void>(sfcWrapper.vm.increment())
expectType<number | undefined>(sfcWrapper.vm.$props.count)
expectType<Promise<void>>(sfcWrapper.setProps({ count: 3 }))

const optionsWrapper = mount<{ label: string }, { label: string }>({
  props: { label: { type: String, default: 'label' } },
  setup: (props: { label: string }) => ({ label: props.label }),
})
expectType<string>(optionsWrapper.vm.label)
