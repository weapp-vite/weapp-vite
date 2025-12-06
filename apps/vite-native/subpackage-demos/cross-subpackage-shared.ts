import chunk from 'lodash-es/chunk'

const sharedPets = ['cat', 'dog', 'parrot', 'hamster', 'alpaca', 'panda']

export function getCrossSharedMessage(scope: string) {
  const groups = chunk(sharedPets, 2)
  return `${scope} 看到 ${groups.length} 组共享数据：${groups.map(group => group.join('+')).join(' / ')}`
}

export function getNodeModulesPreview() {
  return [
    'lodash-es/chunk',
    'lodash-es/_Symbol.js',
    'lodash-es/_freeGlobal.js',
  ]
}

export function getSharedPets() {
  return sharedPets
}
