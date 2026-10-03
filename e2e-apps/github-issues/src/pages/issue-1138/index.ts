import type { SetDataDebugInfo } from 'wevu'
import { defineComponent, nextTick, ref } from 'wevu'

const events: SetDataDebugInfo[] = []

defineComponent({
  setData: {
    debugPhases: true,
    debugWhen: 'always',
    debug(info) {
      if (info.phase) {
        events.push(info)
      }
    },
  },
  setup() {
    events.length = 0
    const count = ref(0)
    function increment() {
      count.value += 1
    }
    async function _beginE2E() {
      events.length = 0
      increment()
      await nextTick()
      return events
    }
    function _readE2E() {
      return events
    }
    return { count, increment, _beginE2E, _readE2E }
  },
})
