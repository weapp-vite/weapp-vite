/**
 * @file 二维码解析内部模块：gf256poly。
 */
import type GF256 from './gf256'

export default class GF256Poly {
  field: GF256
  coefficients: number[]

  constructor(field: GF256, coefficients: number[]) {
    if (coefficients == null || coefficients.length === 0) {
      throw new Error('System.ArgumentException')
    }
    this.field = field
    const coefficientsLength = coefficients.length
    if (coefficientsLength > 1 && coefficients[0] === 0) {
      let firstNonZero = 1
      while (firstNonZero < coefficientsLength && coefficients[firstNonZero] === 0) {
        firstNonZero++
      }
      if (firstNonZero === coefficientsLength) {
        this.coefficients = field.Zero.coefficients
      }
      else {
        this.coefficients = new Array<number>(coefficientsLength - firstNonZero).fill(0)
        for (let ci = 0; ci < this.coefficients.length; ci++) {
          this.coefficients[ci] = coefficients[firstNonZero + ci]
        }
      }
    }
    else {
      this.coefficients = coefficients
    }
  }

  get Zero() {
    return this.coefficients[0] === 0
  }

  get Degree() {
    return this.coefficients.length - 1
  }

  getCoefficient(degree: number) {
    return this.coefficients[this.coefficients.length - 1 - degree]
  }

  evaluateAt(a: number) {
    if (a === 0) {
      return this.getCoefficient(0)
    }
    const size = this.coefficients.length
    if (a === 1) {
      let result = 0
      for (let i = 0; i < size; i++) {
        result = this.field.addOrSubtract(result, this.coefficients[i])
      }
      return result
    }
    let result = this.coefficients[0]
    for (let i = 1; i < size; i++) {
      result = this.field.addOrSubtract(this.field.multiply(a, result), this.coefficients[i])
    }
    return result
  }

  addOrSubtract(other: GF256Poly) {
    if (this.field !== other.field) {
      throw new Error('GF256Polys do not have same GF256 field')
    }
    if (this.Zero) {
      return other
    }
    if (other.Zero) {
      return this
    }
    let smallerCoefficients = this.coefficients
    let largerCoefficients = other.coefficients
    if (smallerCoefficients.length > largerCoefficients.length) {
      const temp = smallerCoefficients
      smallerCoefficients = largerCoefficients
      largerCoefficients = temp
    }
    const sumDiff = Array.from({ length: largerCoefficients.length }, () => 0)
    const lengthDiff = largerCoefficients.length - smallerCoefficients.length
    for (let ci = 0; ci < lengthDiff; ci++) {
      sumDiff[ci] = largerCoefficients[ci]
    }
    for (let i = lengthDiff; i < largerCoefficients.length; i++) {
      sumDiff[i] = this.field.addOrSubtract(smallerCoefficients[i - lengthDiff], largerCoefficients[i])
    }
    return new GF256Poly(this.field, sumDiff)
  }

  multiply1(other: GF256Poly) {
    if (this.field !== other.field) {
      throw new Error('GF256Polys do not have same GF256 field')
    }
    if (this.Zero || other.Zero) {
      return this.field.Zero
    }
    const aCoefficients = this.coefficients
    const aLength = aCoefficients.length
    const bCoefficients = other.coefficients
    const bLength = bCoefficients.length
    const product = Array.from({ length: aLength + bLength - 1 }, () => 0)
    for (let i = 0; i < aLength; i++) {
      const aCoeff = aCoefficients[i]
      for (let j = 0; j < bLength; j++) {
        product[i + j] = this.field.addOrSubtract(product[i + j], this.field.multiply(aCoeff, bCoefficients[j]))
      }
    }
    return new GF256Poly(this.field, product)
  }

  multiply2(scalar: number) {
    if (scalar === 0) {
      return this.field.Zero
    }
    if (scalar === 1) {
      return this
    }
    const size = this.coefficients.length
    const product = new Array<number>(size)
    for (let i = 0; i < size; i++) {
      product[i] = this.field.multiply(this.coefficients[i], scalar)
    }
    return new GF256Poly(this.field, product)
  }

  multiplyByMonomial(degree: number, coefficient: number) {
    if (degree < 0) {
      throw new Error('System.ArgumentException')
    }
    if (coefficient === 0) {
      return this.field.Zero
    }
    const size = this.coefficients.length
    const product = new Array<number>(size + degree).fill(0)
    for (let i = 0; i < size; i++) {
      product[i] = this.field.multiply(this.coefficients[i], coefficient)
    }
    return new GF256Poly(this.field, product)
  }

  divide(other: GF256Poly) {
    if (this.field !== other.field) {
      throw new Error('GF256Polys do not have same GF256 field')
    }
    if (other.Zero) {
      throw new Error('Divide by 0')
    }
    let quotient = this.field.Zero
    let remainder: GF256Poly = this
    const denominatorLeadingTerm = other.getCoefficient(other.Degree)
    const inverseDenominatorLeadingTerm = this.field.inverse(denominatorLeadingTerm)
    while (remainder.Degree >= other.Degree && !remainder.Zero) {
      const degreeDifference = remainder.Degree - other.Degree
      const scale = this.field.multiply(remainder.getCoefficient(remainder.Degree), inverseDenominatorLeadingTerm)
      const term = other.multiplyByMonomial(degreeDifference, scale)
      const iterationQuotient = this.field.buildMonomial(degreeDifference, scale)
      quotient = quotient.addOrSubtract(iterationQuotient)
      remainder = remainder.addOrSubtract(term)
    }
    return [quotient, remainder] as const
  }
}
