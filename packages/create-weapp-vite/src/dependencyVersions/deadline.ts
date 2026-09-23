/** 将整个查询批次约束在同一时间预算内，并清理未完成的请求。 */
export async function queryWithDeadline<T>(query: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        const error = new Error('registry 查询超时')
        controller.abort(error)
        reject(error)
      }, timeoutMs)
    })
    return await Promise.race([query(controller.signal), deadline])
  }
  catch (error) {
    controller.abort(error)
    throw error
  }
  finally {
    clearTimeout(timer)
  }
}
