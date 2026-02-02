import { computed, defineComponent, inject, ref, useAttrs, useSlots, watch } from 'wevu'

export default defineComponent({
  props: {
    title: String,
    count: Number,
    flag: Boolean,
  },
  setup(props, ctx) {
    const attrs = useAttrs()
    const slots = useSlots()
    const injectedValue = inject('runtime:global', 'missing')
    const doubled = computed(() => (props.count ?? 0) * 2)
    const emitCount = ref(0)
    const watchLog = ref<string[]>([])

    watch(
      () => props.count,
      (next, prev) => {
        watchLog.value.push(`${String(prev)}->${String(next)}`)
      },
    )

    const fire = () => {
      emitCount.value += 1
      ctx.emit('ping', { payload: `ping-${emitCount.value}` })
      return emitCount.value
    }

    const attrsSummary = JSON.stringify(Object.keys(attrs ?? {}).sort())
    const slotsSummary = JSON.stringify(Object.keys(slots ?? {}).sort())

    return {
      doubled,
      injectedValue,
      emitCount,
      watchLog,
      fire,
      attrsSummary,
      slotsSummary,
    }
  },
})
