// @ts-nocheck
/**
 * @file 二维码解析内部模块：bitmat。
 */
import { URShift } from './qrcode'

export default function BitMatrix(width, height) {
  if (!height) { height = width }
  if (width < 1 || height < 1) {
    throw 'Both dimensions must be greater than 0'
  }
  this.width = width
  this.height = height
  let rowSize = width >> 5
  if ((width & 0x1F) != 0) {
    rowSize++
  }
  this.rowSize = rowSize
  this.bits = new Array(rowSize * height)
  for (let i = 0; i < this.bits.length; i++) { this.bits[i] = 0 }
}
Object.defineProperty(BitMatrix.prototype, 'Dimension', {
  get() {
    if (this.width != this.height) {
      throw 'Can\'t call getDimension() on a non-square matrix'
    }
    return this.width
  },
})
BitMatrix.prototype.get_Renamed = function (x, y) {
  const offset = y * this.rowSize + (x >> 5)
  return ((URShift(this.bits[offset], (x & 0x1F))) & 1) != 0
}
BitMatrix.prototype.set_Renamed = function (x, y) {
  const offset = y * this.rowSize + (x >> 5)
  this.bits[offset] |= 1 << (x & 0x1F)
}
BitMatrix.prototype.flip = function (x, y) {
  const offset = y * this.rowSize + (x >> 5)
  this.bits[offset] ^= 1 << (x & 0x1F)
}
BitMatrix.prototype.clear = function () {
  const max = this.bits.length
  for (let i = 0; i < max; i++) {
    this.bits[i] = 0
  }
}
BitMatrix.prototype.setRegion = function (left, top, width, height) {
  if (top < 0 || left < 0) {
    throw 'Left and top must be nonnegative'
  }
  if (height < 1 || width < 1) {
    throw 'Height and width must be at least 1'
  }
  const right = left + width
  const bottom = top + height
  if (bottom > this.height || right > this.width) {
    throw 'The region must fit inside the matrix'
  }
  for (let y = top; y < bottom; y++) {
    const offset = y * this.rowSize
    for (let x = left; x < right; x++) {
      this.bits[offset + (x >> 5)] |= 1 << (x & 0x1F)
    }
  }
}
