import { expectError, expectType } from 'tsd'
import { defineEmits, defineProps, withDefaults } from '@/index'

const propsByArray = defineProps(['foo', 'bar'])
expectType<any>(propsByArray.foo)
expectType<any>(propsByArray.bar)

const propsByObject = defineProps({
  foo: String,
  bar: {
    type: Number,
    required: true,
  },
  active: Boolean,
})
expectType<string | undefined>(propsByObject.foo)
expectType<number>(propsByObject.bar)
expectType<boolean>(propsByObject.active)

interface ScriptSetupProps {
  msg?: string
  count: number
  enabled?: boolean
}

const propsByType = defineProps<ScriptSetupProps>()
expectType<string | undefined>(propsByType.msg)
expectType<number>(propsByType.count)
expectType<boolean>(propsByType.enabled)

const { msg = 'hello' } = defineProps<{
  msg?: string
}>()
expectType<string>(msg)

const propsWithDefaults = withDefaults(defineProps<{
  label?: string
  size?: 'sm' | 'md'
}>(), {
  label: 'demo',
  size: 'md',
})
expectType<string>(propsWithDefaults.label)
expectType<'sm' | 'md'>(propsWithDefaults.size)

const emitByArray = defineEmits(['change', 'update'])
emitByArray('change')
emitByArray('update', 1)
expectError(emitByArray('close'))

const emitByObject = defineEmits({
  change: (value: number) => value > 0,
  open: null,
})
emitByObject('change', 1)
emitByObject('open')
expectError(emitByObject('change', '1'))

const emitByCallable = defineEmits<{
  (e: 'save'): void
  (e: 'update', value: number): void
}>()
emitByCallable('save')
emitByCallable('update', 1)
expectError(emitByCallable('update'))
expectError(emitByCallable('cancel'))

const emitByNamedTuple = defineEmits<{
  change: []
  update: [value: number]
  rename: [value: string, force?: boolean]
}>()
emitByNamedTuple('change')
emitByNamedTuple('update', 1)
emitByNamedTuple('rename', 'name')
emitByNamedTuple('rename', 'name', true)
expectError(emitByNamedTuple('update'))
expectError(emitByNamedTuple('update', '1'))
expectError(emitByNamedTuple('unknown'))
