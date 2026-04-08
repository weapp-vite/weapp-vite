import { expectType } from 'tsd'
import { defineEmits, defineModel, defineOptions, defineProps, withDefaults } from '@/index'

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
// @ts-expect-error invalid event name should be rejected
emitByArray('close')

const emitByObject = defineEmits({
  change: (value: number) => value > 0,
  open: null,
})
emitByObject('change', 1)
emitByObject('change', 1, { bubbles: true, composed: true })
emitByObject('open')
// @ts-expect-error invalid payload type should be rejected
emitByObject('change', '1')

const emitByCallable = defineEmits<{
  (e: 'save'): void
  (e: 'update', value: number): void
}>()
emitByCallable('save')
emitByCallable('update', 1)
// @ts-expect-error missing payload should be rejected
emitByCallable('update')
// @ts-expect-error invalid event name should be rejected
emitByCallable('cancel')

const emitByNamedTuple = defineEmits<{
  change: []
  update: [value: number]
  rename: [value: string, force?: boolean]
}>()
emitByNamedTuple('change')
emitByNamedTuple('change', undefined, { bubbles: true })
emitByNamedTuple('update', 1)
emitByNamedTuple('update', 1, { bubbles: true, composed: true })
emitByNamedTuple('rename', 'name')
emitByNamedTuple('rename', 'name', true)
// @ts-expect-error missing tuple payload should be rejected
emitByNamedTuple('update')
// @ts-expect-error invalid payload type should be rejected
emitByNamedTuple('update', '1')
// @ts-expect-error invalid event name should be rejected
emitByNamedTuple('unknown')

const singleModel = defineModel<string>()
expectType<string | undefined>(singleModel.value)

const [tupleModel, tupleModifiers] = defineModel<string, 'trim' | 'uppercase'>()
expectType<string | undefined>(tupleModel.value)
expectType<true | undefined>(tupleModifiers.trim)
expectType<true | undefined>(tupleModifiers.uppercase)
// @ts-expect-error unknown modifier should be rejected
void tupleModifiers.randomFlag

const requiredModel = defineModel<number>({ required: true })
expectType<number>(requiredModel.value)

const defaultModel = defineModel<number>({ default: 1 })
expectType<number>(defaultModel.value)

const [namedModel, namedModifiers] = defineModel<string, 'trim'>('title')
expectType<string | undefined>(namedModel.value)
expectType<true | undefined>(namedModifiers.trim)

const transformedModel = defineModel<string, 'trim', string, number>({
  get(value, modifiers) {
    return `${value ?? ''}:${modifiers.trim ? 'trim' : 'raw'}`
  },
  set(value, modifiers) {
    return modifiers.trim ? String(value).trim() : String(value)
  },
})
expectType<string | undefined>(transformedModel.value)
transformedModel.value = 12

interface ScriptSetupMacroData {
  label: string
}

type ScriptSetupMacroProperties = Record<string, WechatMiniprogram.Component.AllProperty> & {
  count: {
    type: NumberConstructor
  }
}

type ScriptSetupMacroMethods = Record<string, (...args: any[]) => any> & {
  onTap: (this: ScriptSetupMacroInstance) => void
}

type ScriptSetupMacroInstance = WechatMiniprogram.Component.Instance<
  ScriptSetupMacroData,
  ScriptSetupMacroProperties,
  ScriptSetupMacroMethods,
  []
>

defineOptions<ScriptSetupMacroData, never, ScriptSetupMacroMethods, ScriptSetupMacroProperties>({
  setupLifecycle: 'created',
  options: {
    multipleSlots: true,
  },
  properties: {
    count: {
      type: Number,
      observer(this: ScriptSetupMacroInstance, newVal, oldVal, changedPath) {
        expectType<number>(newVal)
        expectType<number>(oldVal)
        expectType<Array<string | number>>(changedPath)
        expectType<number>(this.data.count)
        expectType<number>(this.properties.count)
        expectType<string>(this.data.label)
        this.setData({
          count: newVal + oldVal,
          label: changedPath.join('.'),
        })
      },
    },
  },
  data() {
    return {
      label: 'ready',
    }
  },
  methods: {
    onTap(this: ScriptSetupMacroInstance) {
      expectType<number>(this.data.count)
      expectType<number>(this.properties.count)
      expectType<string>(this.data.label)
      this.setData({
        count: this.data.count + 1,
        label: 'done',
      })
      this.onTap()
    },
  },
})

defineOptions(() => ({
  externalClasses: ['custom-class'],
  options: {
    addGlobalClass: true,
  },
}))

defineOptions({
  externalClasses: ['plain-class'],
  options: {
    multipleSlots: true,
  },
})

defineOptions(async () => ({
  options: {
    styleIsolation: 'shared',
  },
}))
