import { expectType } from 'tsd'
import { defineComponent } from '@/index'

const _WithTypeProps = defineComponent({
  __typeProps: {} as { label: string, count?: number },
  setup(props, ctx) {
    expectType<string>(props.label)
    expectType<number | undefined>(props.count)
    expectType<string>(ctx.props.label)
    expectType<number | undefined>(ctx.props.count)
    return {}
  },
})

type WithTypePropsInstance = InstanceType<typeof _WithTypeProps>
declare const instance: WithTypePropsInstance

expectType<string>(instance.$props.label)
expectType<number | undefined>(instance.$props.count)
