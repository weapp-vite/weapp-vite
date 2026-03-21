// @ts-nocheck
let addressPromise = []

/** 获取一个地址选择Promise */
export function getAddressPromise() {
  let resolver
  let rejecter
  const nextPromise = new Promise((resolve, reject) => {
    resolver = resolve
    rejecter = reject
  })

  addressPromise.push({ resolver, rejecter })

  return nextPromise
}

/** 用户选择了一个地址 */
export function resolveAddress(address) {
  const allAddress = [...addressPromise]
  addressPromise = []

  allAddress.forEach(({ resolver }) => resolver(address))
}

/** 用户没有选择任何地址只是返回上一页了 */
export function rejectAddress() {
  const allAddress = [...addressPromise]
  addressPromise = []

  allAddress.forEach(({ rejecter }) => rejecter(new Error('cancel')))
}
