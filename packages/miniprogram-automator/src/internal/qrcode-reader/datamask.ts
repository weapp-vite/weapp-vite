// @ts-nocheck
/**
 * @file 二维码解析内部模块：datamask。
 */
import { URShift } from './qrcode'

const DataMask = {}
DataMask.forReference = function (reference) {
  if (reference < 0 || reference > 7) {
    throw 'System.ArgumentException'
  }
  return DataMask.DATA_MASKS[reference]
}
function DataMask000() {
  this.unmaskBitMatrix = function (bits, dimension) {
    for (let i = 0; i < dimension; i++) {
      for (let j = 0; j < dimension; j++) {
        if (this.isMasked(i, j)) {
          bits.flip(j, i)
        }
      }
    }
  }
  this.isMasked = function (i, j) {
    return ((i + j) & 0x01) == 0
  }
}
function DataMask001() {
  this.unmaskBitMatrix = function (bits, dimension) {
    for (let i = 0; i < dimension; i++) {
      for (let j = 0; j < dimension; j++) {
        if (this.isMasked(i, j)) {
          bits.flip(j, i)
        }
      }
    }
  }
  this.isMasked = function (i, j) {
    return (i & 0x01) == 0
  }
}
function DataMask010() {
  this.unmaskBitMatrix = function (bits, dimension) {
    for (let i = 0; i < dimension; i++) {
      for (let j = 0; j < dimension; j++) {
        if (this.isMasked(i, j)) {
          bits.flip(j, i)
        }
      }
    }
  }
  this.isMasked = function (i, j) {
    return j % 3 == 0
  }
}
function DataMask011() {
  this.unmaskBitMatrix = function (bits, dimension) {
    for (let i = 0; i < dimension; i++) {
      for (let j = 0; j < dimension; j++) {
        if (this.isMasked(i, j)) {
          bits.flip(j, i)
        }
      }
    }
  }
  this.isMasked = function (i, j) {
    return (i + j) % 3 == 0
  }
}
function DataMask100() {
  this.unmaskBitMatrix = function (bits, dimension) {
    for (let i = 0; i < dimension; i++) {
      for (let j = 0; j < dimension; j++) {
        if (this.isMasked(i, j)) {
          bits.flip(j, i)
        }
      }
    }
  }
  this.isMasked = function (i, j) {
    return (((URShift(i, 1)) + (j / 3)) & 0x01) == 0
  }
}
function DataMask101() {
  this.unmaskBitMatrix = function (bits, dimension) {
    for (let i = 0; i < dimension; i++) {
      for (let j = 0; j < dimension; j++) {
        if (this.isMasked(i, j)) {
          bits.flip(j, i)
        }
      }
    }
  }
  this.isMasked = function (i, j) {
    const temp = i * j
    return (temp & 0x01) + (temp % 3) == 0
  }
}
function DataMask110() {
  this.unmaskBitMatrix = function (bits, dimension) {
    for (let i = 0; i < dimension; i++) {
      for (let j = 0; j < dimension; j++) {
        if (this.isMasked(i, j)) {
          bits.flip(j, i)
        }
      }
    }
  }
  this.isMasked = function (i, j) {
    const temp = i * j
    return (((temp & 0x01) + (temp % 3)) & 0x01) == 0
  }
}
function DataMask111() {
  this.unmaskBitMatrix = function (bits, dimension) {
    for (let i = 0; i < dimension; i++) {
      for (let j = 0; j < dimension; j++) {
        if (this.isMasked(i, j)) {
          bits.flip(j, i)
        }
      }
    }
  }
  this.isMasked = function (i, j) {
    return ((((i + j) & 0x01) + ((i * j) % 3)) & 0x01) == 0
  }
}
DataMask.DATA_MASKS = [new DataMask000(), new DataMask001(), new DataMask010(), new DataMask011(), new DataMask100(), new DataMask101(), new DataMask110(), new DataMask111()]
export default DataMask
