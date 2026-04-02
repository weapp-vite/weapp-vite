import { describe, expect, it } from 'vitest'
import { computed, ref } from '@/reactivity'

describe('reactivity (arrays)', () => {
  it('computed invalidates when pushing new items', () => {
    const todos = ref(['a', 'b', 'c'])
    const todoOptions = computed(() =>
      todos.value.map((todo, index) => ({
        label: todo,
        value: index,
      })),
    )

    expect(todoOptions.value.map(o => o.label)).toEqual(['a', 'b', 'c'])

    todos.value.push('d')
    expect(todoOptions.value.map(o => o.label)).toEqual(['a', 'b', 'c', 'd'])
  })
})
