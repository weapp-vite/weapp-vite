import { expectError, expectType } from 'tsd'
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

type WithPropsKeys = keyof typeof _WithProps
type HasInternalOptionsKey = '__wevu_options' extends WithPropsKeys ? true : false
type HasInternalRuntimeKey = '__wevu_runtime' extends WithPropsKeys ? true : false

expectType<false>(false as HasInternalOptionsKey)
expectType<false>(false as HasInternalRuntimeKey)
expectError(_WithProps.__wevu_options)
expectError(_WithProps.__wevu_runtime)
