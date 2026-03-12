import { computed, ref } from 'wevu'

const count = ref(0)
const from = ref('direct')

export const normalState = {
  count,
  from,
  double: computed(() => count.value * 2),
}
