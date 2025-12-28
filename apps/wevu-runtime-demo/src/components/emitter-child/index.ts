import type { PropType } from 'wevu'
import { defineComponent } from 'wevu'

interface Book {
  title: string
  author: string
  year: number
}

type Transformer = (value: number) => string

defineComponent({
  props: {
    step: { type: Number, default: 1 },
    book: {
      // provide more specific type to `Object`
      type: Object as PropType<Book>,
      required: true,
    },
    tags: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    featured: Boolean,
    rating: {
      type: Number as PropType<1 | 2 | 3 | 4 | 5>,
      default: 5,
    },
    variant: {
      type: [String, Number] as PropType<string | number>,
      value: 'primary',
    },
    transformer: {
      type: Function as PropType<Transformer>,
      default: (value: number) => `#${value}`,
    },
    publishedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  setup(props, { emit }) {
    function emitPlus() {
      const step = props.step ?? 1
      const label = props.transformer(step)

      emit('plus', {
        step,
        label,
        bookTitle: props.book.title,
        featured: props.featured ?? false,
        rating: props.rating,
        variant: props.variant,
        tagsLength: props.tags.length,
        publishedAt: props.publishedAt,
      })
    }
    return {
      emitPlus,
    }
  },
})
