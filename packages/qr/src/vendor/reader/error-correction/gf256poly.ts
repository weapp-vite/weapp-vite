// @ts-nocheck
/**
 * @file 二维码解析内部模块：gf256poly。
 */
export default function GF256Poly(field, coefficients) {
  if (coefficients == null || coefficients.length == 0) {
    throw 'System.ArgumentException'
  }
  this.field = field
  const coefficientsLength = coefficients.length
  if (coefficientsLength > 1 && coefficients[0] == 0) {
    let firstNonZero = 1
    while (firstNonZero < coefficientsLength && coefficients[firstNonZero] == 0) {
      firstNonZero++
    }
    if (firstNonZero == coefficientsLength) {
      this.coefficients = field.Zero.coefficients
    }
    else {
      this.coefficients = new Array(coefficientsLength - firstNonZero)
      for (let i = 0; i < this.coefficients.length; i++) { this.coefficients[i] = 0 }
      for (let ci = 0; ci < this.coefficients.length; ci++) { this.coefficients[ci] = coefficients[firstNonZero + ci] }
    }
  }
  else {
    this.coefficients = coefficients
  }
}
Object.defineProperty(GF256Poly.prototype, 'Zero', {
  get() {
    return this.coefficients[0] == 0
  },
})
Object.defineProperty(GF256Poly.prototype, 'Degree', {
  get() {
    return this.coefficients.length - 1
  },
})
GF256Poly.prototype.getCoefficient = function (degree) {
  return this.coefficients[this.coefficients.length - 1 - degree]
}
GF256Poly.prototype.evaluateAt = function (a) {
  if (a == 0) {
    return this.getCoefficient(0)
  }
  const size = this.coefficients.length
  if (a == 1) {
    let result = 0
    for (var i = 0; i < size; i++) {
      result = this.field.addOrSubtract(result, this.coefficients[i])
    }
    return result
  }
  let result2 = this.coefficients[0]
  for (var i = 1; i < size; i++) {
    result2 = this.field.addOrSubtract(this.field.multiply(a, result2), this.coefficients[i])
  }
  return result2
}
GF256Poly.prototype.addOrSubtract = function (other) {
  if (this.field != other.field) {
    throw 'GF256Polys do not have same GF256 field'
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
  const sumDiff = Array.from({ length: largerCoefficients.length })
  const lengthDiff = largerCoefficients.length - smallerCoefficients.length
  for (let ci = 0; ci < lengthDiff; ci++) { sumDiff[ci] = largerCoefficients[ci] }
  for (let i = lengthDiff; i < largerCoefficients.length; i++) {
    sumDiff[i] = this.field.addOrSubtract(smallerCoefficients[i - lengthDiff], largerCoefficients[i])
  }
  return new GF256Poly(this.field, sumDiff)
}
GF256Poly.prototype.multiply1 = function (other) {
  if (this.field != other.field) {
    throw 'GF256Polys do not have same GF256 field'
  }
  if (this.Zero || other.Zero) {
    return this.field.Zero
  }
  const aCoefficients = this.coefficients
  const aLength = aCoefficients.length
  const bCoefficients = other.coefficients
  const bLength = bCoefficients.length
  const product = Array.from({ length: aLength + bLength - 1 })
  for (let i = 0; i < aLength; i++) {
    const aCoeff = aCoefficients[i]
    for (let j = 0; j < bLength; j++) {
      product[i + j] = this.field.addOrSubtract(product[i + j], this.field.multiply(aCoeff, bCoefficients[j]))
    }
  }
  return new GF256Poly(this.field, product)
}
GF256Poly.prototype.multiply2 = function (scalar) {
  if (scalar == 0) {
    return this.field.Zero
  }
  if (scalar == 1) {
    return this
  }
  const size = this.coefficients.length
  const product = new Array(size)
  for (let i = 0; i < size; i++) {
    product[i] = this.field.multiply(this.coefficients[i], scalar)
  }
  return new GF256Poly(this.field, product)
}
GF256Poly.prototype.multiplyByMonomial = function (degree, coefficient) {
  if (degree < 0) {
    throw 'System.ArgumentException'
  }
  if (coefficient == 0) {
    return this.field.Zero
  }
  const size = this.coefficients.length
  const product = new Array(size + degree)
  for (var i = 0; i < product.length; i++) { product[i] = 0 }
  for (var i = 0; i < size; i++) {
    product[i] = this.field.multiply(this.coefficients[i], coefficient)
  }
  return new GF256Poly(this.field, product)
}
GF256Poly.prototype.divide = function (other) {
  if (this.field != other.field) {
    throw 'GF256Polys do not have same GF256 field'
  }
  if (other.Zero) {
    throw 'Divide by 0'
  }
  let quotient = this.field.Zero
  let remainder = this
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
  return [quotient, remainder]
}
