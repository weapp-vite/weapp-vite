import { computed, onShareAppMessage, ref, unref } from 'wevu'

export function useRootImportHmr() {
  const title = ref('ROOT-IMPORT-HMR-BASE')
  const label = computed(() => `root:${unref(title)}`)
  onShareAppMessage(() => ({ title: unref(label) }))
  return { label }
}
