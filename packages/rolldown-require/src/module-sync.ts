let cachedModuleSyncCondition: boolean | undefined
let moduleSyncConditionPromise: Promise<boolean> | undefined

export async function getModuleSyncConditionEnabled(): Promise<boolean> {
  if (cachedModuleSyncCondition !== undefined) {
    return cachedModuleSyncCondition
  }
  if (!moduleSyncConditionPromise) {
    moduleSyncConditionPromise = import(
      // @ts-ignore
      '#module-sync-enabled',
    )
      .then(mod => Boolean(mod?.default))
      .catch(() => false)
      .then((result) => {
        cachedModuleSyncCondition = result
        return result
      })
      .finally(() => {
        moduleSyncConditionPromise = undefined
      })
  }
  return moduleSyncConditionPromise
}
