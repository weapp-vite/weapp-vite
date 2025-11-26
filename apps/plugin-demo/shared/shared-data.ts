let loadCount = 0

export const SHARED_ANSWER = 42

/**
 * Returns a string that identifies how many times this shared module has been evaluated.
 * Plugin and miniprogram each log the value to verify their bundles do not reuse code.
 */
export function getSharedLoadMessage(consumer: string) {
  loadCount += 1
  return `[shared:${consumer}] load #${loadCount}`
}
