/**
 * @file 二维码解析内部模块：datamask。
 */
import { URShift } from '../core/qrcode'
import type BitMatrix from './bitmat'

interface DataMaskStrategy {
  unmaskBitMatrix: (bits: BitMatrix, dimension: number) => void
  isMasked: (i: number, j: number) => boolean
}

function createDataMaskStrategy(isMasked: (i: number, j: number) => boolean): DataMaskStrategy {
  return {
    unmaskBitMatrix(bits, dimension) {
      for (let i = 0; i < dimension; i++) {
        for (let j = 0; j < dimension; j++) {
          if (isMasked(i, j)) {
            bits.flip(j, i)
          }
        }
      }
    },
    isMasked,
  }
}

const DATA_MASKS: DataMaskStrategy[] = [
  createDataMaskStrategy((i, j) => ((i + j) & 0x01) === 0),
  createDataMaskStrategy(i => (i & 0x01) === 0),
  createDataMaskStrategy((_i, j) => j % 3 === 0),
  createDataMaskStrategy((i, j) => (i + j) % 3 === 0),
  createDataMaskStrategy((i, j) => ((URShift(i, 1) + Math.floor(j / 3)) & 0x01) === 0),
  createDataMaskStrategy((i, j) => {
    const temp = i * j
    return ((temp & 0x01) + (temp % 3)) === 0
  }),
  createDataMaskStrategy((i, j) => {
    const temp = i * j
    return (((temp & 0x01) + (temp % 3)) & 0x01) === 0
  }),
  createDataMaskStrategy((i, j) => ((((i + j) & 0x01) + ((i * j) % 3)) & 0x01) === 0),
]

const DataMask = {
  DATA_MASKS,
  forReference(reference: number) {
    if (reference < 0 || reference > 7) {
      throw new Error('System.ArgumentException')
    }
    return DATA_MASKS[reference]
  },
}

export default DataMask
