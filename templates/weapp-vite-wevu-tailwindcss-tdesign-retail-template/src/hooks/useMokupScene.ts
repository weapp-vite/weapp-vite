import type { RetailMokupScene } from '@/types/retail'
import { onLoad, ref } from 'wevu'
import { getRetailMokupScene } from '@/mokup/client'

export function useMokupScene(route: string) {
  const scene = ref<RetailMokupScene | null>(null)
  const loading = ref(false)

  async function refresh() {
    loading.value = true
    try {
      scene.value = await getRetailMokupScene(route)
    }
    finally {
      loading.value = false
    }
  }

  onLoad(() => {
    refresh()
  })

  return {
    scene,
    loading,
    refresh,
  }
}
