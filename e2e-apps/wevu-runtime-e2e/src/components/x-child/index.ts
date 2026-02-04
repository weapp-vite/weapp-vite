import { computed, defineComponent, inject, onMounted, ref, watch } from 'wevu'

export default defineComponent({
  props: {
    title: String,
    count: Number,
    flag: Boolean,
  },
  setup(props, ctx) {
    const attrsSummary = ref('[]')
    const slotsSummary = ref('[]')
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

    const syncSummaries = () => {
      const attrs = ctx.attrs ?? {}
      const slots = ctx.slots ?? {}
      attrsSummary.value = JSON.stringify(Object.keys(attrs).sort())
      slotsSummary.value = JSON.stringify(Object.keys(slots).sort())
    }

    syncSummaries()
    onMounted(syncSummaries)

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
