import crypto from 'node:crypto'

export function md5(data: crypto.BinaryLike) {
  const input = data instanceof ArrayBuffer || data instanceof SharedArrayBuffer
    ? new Uint8Array(data)
    : data

  return crypto.createHash('md5').update(input).digest('hex')
}
