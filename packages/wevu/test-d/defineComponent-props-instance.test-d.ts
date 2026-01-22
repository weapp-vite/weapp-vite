import { expectType } from 'tsd'
import { defineComponent } from '@/index'

const _WithProps = defineComponent({
  props: {
    label: String,
    count: { type: Number, required: true },
    flag: Boolean,
  },
  setup() {
    return {}
  },
})

type WithPropsInstance = InstanceType<typeof _WithProps>
declare const inst: WithPropsInstance

expectType<string | undefined>(inst.$props.label)
expectType<number>(inst.$props.count)
expectType<boolean>(inst.$props.flag)
