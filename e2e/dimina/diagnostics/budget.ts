export const PROTOCOL_CAPTURE_BUDGET = 2000

/** 诊断预算独立于原导航、用例和 hook 的超时，不因采集失败追加重试。 */
export function diagnosticBudget(milliseconds = PROTOCOL_CAPTURE_BUDGET) {
  const deadline = Date.now() + milliseconds
  return async <T>(operation: () => Promise<T>): Promise<T> => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      throw new Error('Diagnostic protocol budget exhausted')
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Diagnostic protocol budget exhausted')), remaining)
        }),
      ])
    }
    finally {
      clearTimeout(timer)
    }
  }
}
