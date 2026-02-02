import { defineComponent, getCurrentSetupContext, ref, useModel } from 'wevu'

export default defineComponent({
  props: {
    modelValue: String,
    label: String,
  },
  setup(props) {
    const ctx = getCurrentSetupContext<any>()
    const emitLogs = ref<string[]>([])

    if (ctx?.emit) {
      const rawEmit = ctx.emit
      ctx.emit = (event: string, detail?: any, options?: any) => {
        emitLogs.value.push(`${event}:${JSON.stringify(detail ?? null)}`)
        rawEmit(event, detail, options)
      }
    }

    const model = useModel<string>(props, 'modelValue')

    const triggerModel = (next: string) => {
      model.value = next
      return model.value
    }

    const read = () => ({
      value: model.value,
      logs: emitLogs.value.slice(),
    })

    return {
      model,
      emitLogs,
      triggerModel,
      read,
    }
  },
})
