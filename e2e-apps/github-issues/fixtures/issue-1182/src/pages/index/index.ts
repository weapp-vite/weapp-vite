import type { InternalRuntimeState, Ref } from 'wevu'
import { createApp, mountRuntimeInstance, ref, teardownRuntimeInstance } from 'wevu'

interface MountState {
  original: Ref<number>
  replacement: Ref<number>
  mounted: InternalRuntimeState['__wevu']
  setups: number
}

const states = new WeakMap<InternalRuntimeState, MountState>()

Page({
  data: { setups: 0, identity: 'initial' },
  onLoad() {
    const target = this as unknown as InternalRuntimeState
    const original = ref(1)
    let setups = 0
    mountRuntimeInstance(target, createApp({}), undefined, () => {
      setups++
      return { value: original }
    })
    states.set(target, { original, replacement: ref(50), mounted: target.__wevu, setups })
    this.setData({ setups })
  },
  incrementOriginal() {
    states.get(this as unknown as InternalRuntimeState)!.original.value++
  },
  replaceMount() {
    const target = this as unknown as InternalRuntimeState
    const state = states.get(target)!
    mountRuntimeInstance(target, createApp({}), undefined, () => {
      state.setups++
      return { value: state.replacement }
    })
    this.setData({ setups: state.setups, identity: target.__wevu === state.mounted ? 'same' : 'changed' })
  },
  incrementReplacement() {
    states.get(this as unknown as InternalRuntimeState)!.replacement.value++
  },
  onUnload() {
    const target = this as unknown as InternalRuntimeState
    teardownRuntimeInstance(target)
    states.delete(target)
  },
})
