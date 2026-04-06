import type { Address, DeliveryAddress } from '../../model/address'

export type SelectableAddress = Address | DeliveryAddress

interface DeferredAddress {
  resolver: (address: SelectableAddress | undefined) => void
  rejecter: (error: Error) => void
}

let addressPromise: DeferredAddress[] = []

/** 获取一个地址选择Promise */
export function getAddressPromise() {
  let resolver!: (address: SelectableAddress | undefined) => void
  let rejecter!: (error: Error) => void
  const nextPromise = new Promise<SelectableAddress | undefined>((resolve, reject) => {
    resolver = resolve
    rejecter = reject
  })

  addressPromise.push({ resolver, rejecter })

  return nextPromise
}

/** 用户选择了一个地址 */
export function resolveAddress(address: SelectableAddress | undefined) {
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
