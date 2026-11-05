const INVENTORY_PROTOCOL = 'weapp-vite-devtools-project-inventory-v1'

export function inventoryScanResult(rootDirectory: string, nonce: string) {
  return { protocol: INVENTORY_PROTOCOL, rootDirectory, nonce, status: 'ok' } as const
}

/** 只接受本次请求的一条完整成功消息，额外输出不能成为创建 journal 的依据。 */
export function assertInventoryScanResult(output: string, rootDirectory: string, nonce: string): void {
  let result: unknown
  try {
    result = JSON.parse(output) as unknown
  }
  catch (error) {
    throw new Error('Managed DevTools inventory scanner did not return one valid result.', { cause: error })
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)
    || Object.keys(result).sort().join(',') !== 'nonce,protocol,rootDirectory,status'
    || !('protocol' in result) || result.protocol !== INVENTORY_PROTOCOL
    || !('rootDirectory' in result) || result.rootDirectory !== rootDirectory
    || !('nonce' in result) || result.nonce !== nonce
    || !('status' in result) || result.status !== 'ok') {
    throw new Error('Managed DevTools inventory scanner result does not match the owned request.')
  }
}
