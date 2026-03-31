/**
 * @file 二维码解析内部模块：gf256。
 */
import GF256Poly from './gf256poly'

export default class GF256 {
  static QR_CODE_FIELD: GF256
  static DATA_MATRIX_FIELD: GF256

  expTable: number[]
  logTable: number[]
  zero: GF256Poly
  one: GF256Poly

  constructor(primitive: number) {
    this.expTable = Array.from({ length: 256 }, () => 0)
    this.logTable = Array.from({ length: 256 }, () => 0)
    let x = 1
    for (let i = 0; i < 256; i++) {
      this.expTable[i] = x
      x <<= 1
      if (x >= 0x100) {
        x ^= primitive
      }
    }
    for (let i = 0; i < 255; i++) {
      this.logTable[this.expTable[i]] = i
    }
    this.zero = new GF256Poly(this, [0])
    this.one = new GF256Poly(this, [1])
  }

  get Zero() {
    return this.zero
  }

  get One() {
    return this.one
  }

  buildMonomial(degree: number, coefficient: number) {
    if (degree < 0) {
      throw new Error('System.ArgumentException')
    }
    if (coefficient === 0) {
      return this.zero
    }
    const coefficients = new Array<number>(degree + 1).fill(0)
    coefficients[0] = coefficient
    return new GF256Poly(this, coefficients)
  }

  exp(a: number) {
    return this.expTable[a]
  }

  log(a: number) {
    if (a === 0) {
      throw new Error('System.ArgumentException')
    }
    return this.logTable[a]
  }

  inverse(a: number) {
    if (a === 0) {
      throw new Error('System.ArithmeticException')
    }
    return this.expTable[255 - this.logTable[a]]
  }

  addOrSubtract(a: number, b: number) {
    return a ^ b
  }

  multiply(a: number, b: number) {
    if (a === 0 || b === 0) {
      return 0
    }
    if (a === 1) {
      return b
    }
    if (b === 1) {
      return a
    }
    return this.expTable[(this.logTable[a] + this.logTable[b]) % 255]
  }
}

GF256.QR_CODE_FIELD = new GF256(0x011D)
GF256.DATA_MATRIX_FIELD = new GF256(0x012D)
