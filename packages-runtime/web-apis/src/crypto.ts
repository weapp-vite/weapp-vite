import { getMiniProgramRuntimeGlobalKeys } from '@weapp-core/shared'

const MAX_RANDOM_VALUES_BYTE_LENGTH = 65536

type IntegerTypedArray
  = | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | BigInt64Array
    | BigUint64Array

function isIntegerTypedArray(value: unknown): value is IntegerTypedArray {
  return value instanceof Int8Array
    || value instanceof Uint8Array
    || value instanceof Uint8ClampedArray
    || value instanceof Int16Array
    || value instanceof Uint16Array
    || value instanceof Int32Array
    || value instanceof Uint32Array
    || value instanceof BigInt64Array
    || value instanceof BigUint64Array
}

function getNativeCrypto() {
  const candidate = (globalThis as Record<string, any>).crypto
  if (candidate && typeof candidate.getRandomValues === 'function') {
    return candidate as Crypto
  }
  return undefined
}

function fillArrayWithMathRandom(target: IntegerTypedArray) {
  const bytes = new Uint8Array(target.buffer, target.byteOffset, target.byteLength)
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Math.floor(Math.random() * 256)
  }
}

function fillArrayWithHostRandomValues(target: IntegerTypedArray) {
  for (const hostKey of getMiniProgramRuntimeGlobalKeys()) {
    const host = (globalThis as Record<string, any>)[hostKey]
    if (!host || typeof host.getRandomValues !== 'function') {
      continue
    }

    try {
      host.getRandomValues(target)
      return true
    }
    catch {
    }
  }

  return false
}

export function getRandomValuesPolyfill<T extends IntegerTypedArray>(typedArray: T) {
  if (!isIntegerTypedArray(typedArray)) {
    throw new TypeError('Failed to execute \'getRandomValues\': input must be an integer TypedArray')
  }

  if (typedArray.byteLength > MAX_RANDOM_VALUES_BYTE_LENGTH) {
    throw new TypeError('Failed to execute \'getRandomValues\': byteLength exceeds 65536')
  }

  const nativeCrypto = getNativeCrypto()
  if (nativeCrypto && nativeCrypto.getRandomValues !== getRandomValuesPolyfill) {
    return nativeCrypto.getRandomValues(typedArray as never)
  }

  if (!fillArrayWithHostRandomValues(typedArray)) {
    fillArrayWithMathRandom(typedArray)
  }

  return typedArray
}

export const cryptoPolyfill = {
  getRandomValues: getRandomValuesPolyfill,
}
