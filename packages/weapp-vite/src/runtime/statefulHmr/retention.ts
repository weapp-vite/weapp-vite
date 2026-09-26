export const maxRetainedDeltaCount = 1_000
export const maxRetainedDeltaBytes = 16 * 1024 * 1024

export function shouldResetStatefulHmrRetention(count: number, bytes: number, nextBytes: number): boolean {
  return count >= maxRetainedDeltaCount || bytes + nextBytes >= maxRetainedDeltaBytes
}
