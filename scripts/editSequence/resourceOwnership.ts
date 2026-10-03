interface ClosableResource {
  close: () => unknown
}

/** 保留每代真实资源直到其 close 完成，不能用当前宿主指针覆盖未关闭的旧实例。 */
export class SequenceResourceOwnership {
  private readonly resources = new Set<ClosableResource>()

  track(resource: ClosableResource) {
    if (this.resources.has(resource)) {
      return
    }
    this.resources.add(resource)
    const close = resource.close.bind(resource)
    resource.close = async () => {
      try {
        return await close()
      }
      finally {
        this.resources.delete(resource)
      }
    }
  }

  get size() {
    return this.resources.size
  }
}
