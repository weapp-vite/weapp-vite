import { computed, ref } from 'wevu'

const count = ref(10)
const from = ref('direct')

export const independentState = {
  count,
  from,
  double: computed(() => count.value * 2),
}
