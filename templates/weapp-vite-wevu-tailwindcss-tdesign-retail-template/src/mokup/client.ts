import type { RetailMokupScene } from '@/types/retail'

const modules = import.meta.glob<{ default: RetailMokupScene }>('./routes/**/*.get.ts', {
  eager: true,
})

const scenes = new Map<string, RetailMokupScene>()

for (const [key, mod] of Object.entries(modules)) {
  const route = key
    .replace('./routes/', '')
    .replace('.get.ts', '')
  scenes.set(route, mod.default)
}

export async function getRetailMokupScene(route: string): Promise<RetailMokupScene> {
  const fallback = scenes.get('pages/home/home')
  const scene = scenes.get(route) || fallback
  if (!scene) {
    throw new Error('缺少默认场景数据')
  }
  await new Promise(resolve => setTimeout(resolve, 60))
  return scene
}
