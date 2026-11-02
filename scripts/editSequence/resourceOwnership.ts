interface ClosableResource {
  close: () => unknown
}

/** 保留每代真实资源直到其 close 完成，不能用当前宿主指针覆盖未关闭的旧实例。 */
export class SequenceResourceOwnership {
  private readonly resources = new Set<ClosableResource>()
  private readonly tracked = new WeakSet<ClosableResource>()
  private readonly failures = new Map<ClosableResource, unknown>()

  track(resource: ClosableResource) {
    if (this.tracked.has(resource)) {
      return
    }
    this.tracked.add(resource)
    this.resources.add(resource)
    const close = resource.close.bind(resource)
    let closing: Promise<unknown> | undefined
    // 先缓存同一结果再调用原生关闭；失败保留 owner，不在重复调用时隐式重试。
    resource.close = () => {
      if (closing) {
        return closing
      }
      const result = Promise.withResolvers<unknown>()
      closing = result.promise
      const fail = (error: unknown) => {
        this.failures.set(resource, error)
        result.reject(error)
      }
      try {
        Promise.resolve(close()).then((value) => {
          this.resources.delete(resource)
          result.resolve(value)
        }, fail)
      }
      catch (error) {
        fail(error)
      }
      return closing
    }
  }

  get size() {
    return this.resources.size
  }

  get errors(): readonly unknown[] {
    return [...this.failures.values()]
  }

  assertReleased() {
    const errors = [...this.errors]
    if (this.resources.size > this.failures.size) {
      errors.push(new Error(`Sequence ownership retained ${this.resources.size} resource(s) without successful close`))
    }
    if (errors.length === 1) {
      throw errors[0]
    }
    if (errors.length) {
      throw new AggregateError(errors, 'Sequence resource cleanup failed', { cause: errors[0] })
    }
  }
}
