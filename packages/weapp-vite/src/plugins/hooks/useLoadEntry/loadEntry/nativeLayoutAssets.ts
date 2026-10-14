import { collectNativeLayoutAssets } from '../../../vue/transform/pageLayout'

/** 每次入口加载独立创建，只复用文件发现；源码读取和依赖登记仍属于各自阶段。 */
export function createNativeLayoutAssetResolver(): typeof collectNativeLayoutAssets {
  const pending = new Map<string, ReturnType<typeof collectNativeLayoutAssets>>()
  return (basePath, platform) => {
    const key = JSON.stringify([platform, basePath])
    let task = pending.get(key)
    if (!task) {
      task = collectNativeLayoutAssets(basePath, platform).catch((error: unknown) => {
        if (pending.get(key) === task) {
          pending.delete(key)
        }
        throw error
      })
      pending.set(key, task)
    }
    return task
  }
}
