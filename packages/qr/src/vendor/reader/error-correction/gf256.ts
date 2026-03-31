// @ts-nocheck
/**
 * @file 二维码解析内部模块：gf256。
 */
import GF256Poly from './gf256poly'

export default function GF256(primitive) {
  this.expTable = Array.from({ length: 256 })
  this.logTable = Array.from({ length: 256 })
  let x = 1
  for (var i = 0; i < 256; i++) {
    this.expTable[i] = x
    x <<= 1
    if (x >= 0x100) {
      x ^= primitive
    }
  }
  for (var i = 0; i < 255; i++) {
    this.logTable[this.expTable[i]] = i
  }
  const at0 = Array.from({ length: 1 })
  at0[0] = 0
  this.zero = new GF256Poly(this, new Array(at0))
  const at1 = Array.from({ length: 1 })
  at1[0] = 1
  this.one = new GF256Poly(this, new Array(at1))
}
Object.defineProperty(GF256.prototype, 'Zero', {
  get() {
    return this.zero
  },
})
Object.defineProperty(GF256.prototype, 'One', {
  get() {
    return this.one
  },
})
GF256.prototype.buildMonomial = function (degree, coefficient) {
  if (degree < 0) {
    throw 'System.ArgumentException'
  }
  if (coefficient == 0) {
    return this.zero
  }
  const coefficients = new Array(degree + 1)
  for (let i = 0; i < coefficients.length; i++) { coefficients[i] = 0 }
  coefficients[0] = coefficient
  return new GF256Poly(this, coefficients)
}
GF256.prototype.exp = function (a) {
  return this.expTable[a]
}
GF256.prototype.log = function (a) {
  if (a == 0) {
    throw 'System.ArgumentException'
  }
  return this.logTable[a]
}
GF256.prototype.inverse = function (a) {
  if (a == 0) {
    throw 'System.ArithmeticException'
  }
  return this.expTable[255 - this.logTable[a]]
}
GF256.prototype.addOrSubtract = function (a, b) {
  return a ^ b
}
GF256.prototype.multiply = function (a, b) {
  if (a == 0 || b == 0) {
    return 0
  }
  if (a == 1) {
    return b
  }
  if (b == 1) {
    return a
  }
  return this.expTable[(this.logTable[a] + this.logTable[b]) % 255]
}
GF256.QR_CODE_FIELD = new GF256(0x011D)
GF256.DATA_MATRIX_FIELD = new GF256(0x012D)
