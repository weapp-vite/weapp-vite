/* eslint-disable ts/no-unused-vars */
import { expectError, expectType } from 'tsd'
import { defineComponent, ref } from '@/index'

const Demo = defineComponent({
  setup() {
    const count = ref(0)
    const label = ref('hello')
    const rename = (value: string) => {
      label.value = value
    }
    return {
      count,
      label,
      rename,
    }
  },
})

type DemoInstance = InstanceType<typeof Demo>
declare const demo: DemoInstance

expectType<number>(demo.count)
expectType<string>(demo.label)
expectType<(value: string) => void>(demo.rename)

const EmptySetup = defineComponent({
  setup() {
    const hidden = ref(0)
    hidden.value += 1
  },
})

type EmptySetupInstance = InstanceType<typeof EmptySetup>
declare const emptySetup: EmptySetupInstance

expectError(emptySetup.hidden)
expectError(emptySetup.nonexistent)
