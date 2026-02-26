import type { InferProps, PropType } from '@/index'
import { expectError, expectType } from 'tsd'
import { defineComponent } from '@/index'

interface Book {
  title: string
  author: string
  year: number
}

type Props = InferProps<{
  step: { type: NumberConstructor, default: 1 }
  optionalStep: NumberConstructor
  requiredStep: { type: NumberConstructor, required: true }
  flag: BooleanConstructor
  withValue: { type: StringConstructor, value: 'foo' }
}>

expectType<number>(({} as Props).step)
expectType<number | undefined>(({} as Props).optionalStep)
expectType<number>(({} as Props).requiredStep)
expectType<boolean>(({} as Props).flag)
expectType<string>(({} as Props).withValue)

defineComponent({
  props: {
    step: { type: Number, default: 1 },
    optionalStep: Number,
    book: {
      type: Object as PropType<Book>,
      required: true,
    },
    variants: {
      type: [String, Number] as PropType<string | number>,
    },
    nullableText: {
      type: [String, null],
    },
    format: {
      type: Function as PropType<(n: number) => string>,
    },
  },
  setup(props) {
    expectType<number>(props.step)
    expectType<number | undefined>(props.optionalStep)
    expectType<Book>(props.book)
    expectType<string | number | undefined>(props.variants)
    expectType<string | null | undefined>(props.nullableText)
    expectType<((n: number) => string) | undefined>(props.format)
    expectError(props.nonexistent)
    expectError(props.book.nonexistent)
    expectError(props.step = undefined)
    return {}
  },
})
