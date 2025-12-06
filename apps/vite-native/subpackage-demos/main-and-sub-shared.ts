import uniq from 'lodash-es/uniq'

const flavorPool = ['vanilla', 'mango', 'berry', 'matcha', 'taro']

export function sharedFlavor(scope: string) {
  return uniq([...flavorPool, scope.toLowerCase()])
}

export function formatSharedFlavor(scope: string) {
  const list = sharedFlavor(scope)
  return list.join(' / ')
}
