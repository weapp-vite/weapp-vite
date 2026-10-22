/** 原生宿主仍拥有资源；测试只记录原生关闭入口与正在返回的 acquisition。 */
export function createHostResources() {
  const resources = new Map()
  const pending = new Set()
  const failures = new Set()
  let closing

  function own(resource, close) {
    if (!resources.has(resource)) {
      let stopped
      resources.set(resource, () => stopped ??= Promise.resolve().then(close))
    }
    if (closing && !pending.size) {
      return resources.get(resource)().catch((error) => {
        failures.add(error)
        throw error
      })
    }
  }

  function acquire(action) {
    if (closing) {
      return Promise.reject(new Error('Cannot acquire native host resources after shutdown was requested'))
    }
    // 先登记 acquisition，关闭请求不能漏掉下一微任务才产生的 watcher。
    const task = Promise.resolve().then(action)
    pending.add(task)
    void task.then(() => pending.delete(task), (error) => {
      pending.delete(task)
      if (closing) {
        failures.add(error)
      }
    })
    return task
  }

  function close() {
    if (!closing) {
      const completion = Promise.withResolvers()
      closing = completion.promise
      void (async () => {
        const stopped = new Set()
        while (pending.size || stopped.size < resources.size) {
          if (pending.size) {
            // restart 会替换 server 的实际 close；完整 acquisition 结束前不能耗尽旧入口。
            for (const result of await Promise.allSettled([...pending])) {
              if (result.status === 'rejected') {
                failures.add(result.reason)
              }
            }
            continue
          }
          const tasks = []
          for (const [resource, stop] of resources) {
            if (!stopped.has(resource)) {
              stopped.add(resource)
              tasks.push(stop())
            }
          }
          for (const result of await Promise.allSettled(tasks)) {
            if (result.status === 'rejected') {
              failures.add(result.reason)
            }
          }
        }
        if (failures.size) {
          const errors = [...failures]
          throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Native host resource shutdown failed', { cause: errors[0] })
        }
      })().then(completion.resolve, completion.reject)
    }
    return closing
  }

  return { own, acquire, close }
}
