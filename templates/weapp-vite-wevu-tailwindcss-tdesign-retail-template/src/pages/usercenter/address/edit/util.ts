interface DeferredAddress {
  resolver: (address: unknown) => void
  rejecter: (error: Error) => void
}

let addressPromise: DeferredAddress[] = []

/** 地址编辑Promise */
export function getAddressPromise() {
  let resolver!: (address: unknown) => void
  let rejecter!: (error: Error) => void
  const nextPromise = new Promise((resolve, reject) => {
    resolver = resolve
    rejecter = reject
  })

  addressPromise.push({ resolver, rejecter })

  return nextPromise
}

/** 用户保存了一个地址 */
export function resolveAddress(address: unknown) {
  const allAddress = [...addressPromise]
  addressPromise = []

  console.info('用户保存了一个地址', address)

  allAddress.forEach(({ resolver }) => resolver(address))
}

/** 取消编辑 */
export function rejectAddress() {
  const allAddress = [...addressPromise]
  addressPromise = []

  allAddress.forEach(({ rejecter }) => rejecter(new Error('cancel')))
}
