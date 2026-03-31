/**
 * @file 二维码解析内部模块：bitmat。
 */
import { URShift } from '../core/qrcode'

export default class BitMatrix {
  width: number
  height: number
  rowSize: number
  bits: number[]

  constructor(width: number, height?: number) {
    const resolvedHeight = height ?? width
    if (width < 1 || resolvedHeight < 1) {
      throw new Error('Both dimensions must be greater than 0')
    }
    this.width = width
    this.height = resolvedHeight
    let rowSize = width >> 5
    if ((width & 0x1F) !== 0) {
      rowSize++
    }
    this.rowSize = rowSize
    this.bits = new Array<number>(rowSize * resolvedHeight).fill(0)
  }

  get Dimension() {
    if (this.width !== this.height) {
      throw new Error('Can\'t call getDimension() on a non-square matrix')
    }
    return this.width
  }

  get_Renamed(x: number, y: number) {
    const offset = y * this.rowSize + (x >> 5)
    return ((URShift(this.bits[offset], (x & 0x1F))) & 1) !== 0
  }

  set_Renamed(x: number, y: number) {
    const offset = y * this.rowSize + (x >> 5)
    this.bits[offset] |= 1 << (x & 0x1F)
  }

  flip(x: number, y: number) {
    const offset = y * this.rowSize + (x >> 5)
    this.bits[offset] ^= 1 << (x & 0x1F)
  }

  clear() {
    const max = this.bits.length
    for (let i = 0; i < max; i++) {
      this.bits[i] = 0
    }
  }

  setRegion(left: number, top: number, width: number, height: number) {
    if (top < 0 || left < 0) {
      throw new Error('Left and top must be nonnegative')
    }
    if (height < 1 || width < 1) {
      throw new Error('Height and width must be at least 1')
    }
    const right = left + width
    const bottom = top + height
    if (bottom > this.height || right > this.width) {
      throw new Error('The region must fit inside the matrix')
    }
    for (let y = top; y < bottom; y++) {
      const offset = y * this.rowSize
      for (let x = left; x < right; x++) {
        this.bits[offset + (x >> 5)] |= 1 << (x & 0x1F)
      }
    }
  }
}
