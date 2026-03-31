// @ts-nocheck
/**
 * @file 二维码解析内部模块：rsdecoder。
 */
import GF256 from './gf256'
import GF256Poly from './gf256poly'

export default function ReedSolomonDecoder(field) {
  this.field = field
}
ReedSolomonDecoder.prototype.decode = function (received, twoS) {
  const poly = new GF256Poly(this.field, received)
  const syndromeCoefficients = new Array(twoS)
  for (var i = 0; i < syndromeCoefficients.length; i++) { syndromeCoefficients[i] = 0 }
  const dataMatrix = false
  let noError = true
  for (var i = 0; i < twoS; i++) {
    const _eval = poly.evaluateAt(this.field.exp(dataMatrix ? i + 1 : i))
    syndromeCoefficients[syndromeCoefficients.length - 1 - i] = _eval
    if (_eval != 0) {
      noError = false
    }
  }
  if (noError) {
    return
  }
  const syndrome = new GF256Poly(this.field, syndromeCoefficients)
  const sigmaOmega = this.runEuclideanAlgorithm(this.field.buildMonomial(twoS, 1), syndrome, twoS)
  const sigma = sigmaOmega[0]
  const omega = sigmaOmega[1]
  const errorLocations = this.findErrorLocations(sigma)
  const errorMagnitudes = this.findErrorMagnitudes(omega, errorLocations, dataMatrix)
  for (var i = 0; i < errorLocations.length; i++) {
    const position = received.length - 1 - this.field.log(errorLocations[i])
    if (position < 0) {
      throw 'ReedSolomonException Bad error location'
    }
    received[position] = GF256.prototype.addOrSubtract(received[position], errorMagnitudes[i])
  }
}
ReedSolomonDecoder.prototype.runEuclideanAlgorithm = function (a, b, R) {
  if (a.Degree < b.Degree) {
    const temp = a
    a = b
    b = temp
  }
  let rLast = a
  let r = b
  let sLast = this.field.One
  let s = this.field.Zero
  let tLast = this.field.Zero
  let t = this.field.One
  while (r.Degree >= Math.floor(R / 2)) {
    const rLastLast = rLast
    const sLastLast = sLast
    const tLastLast = tLast
    rLast = r
    sLast = s
    tLast = t
    if (rLast.Zero) {
      throw 'r_{i-1} was zero'
    }
    r = rLastLast
    let q = this.field.Zero
    const denominatorLeadingTerm = rLast.getCoefficient(rLast.Degree)
    const dltInverse = this.field.inverse(denominatorLeadingTerm)
    while (r.Degree >= rLast.Degree && !r.Zero) {
      const degreeDiff = r.Degree - rLast.Degree
      const scale = this.field.multiply(r.getCoefficient(r.Degree), dltInverse)
      q = q.addOrSubtract(this.field.buildMonomial(degreeDiff, scale))
      r = r.addOrSubtract(rLast.multiplyByMonomial(degreeDiff, scale))
    }
    s = q.multiply1(sLast).addOrSubtract(sLastLast)
    t = q.multiply1(tLast).addOrSubtract(tLastLast)
  }
  const sigmaTildeAtZero = t.getCoefficient(0)
  if (sigmaTildeAtZero == 0) {
    throw 'ReedSolomonException sigmaTilde(0) was zero'
  }
  const inverse = this.field.inverse(sigmaTildeAtZero)
  const sigma = t.multiply2(inverse)
  const omega = r.multiply2(inverse)
  return [sigma, omega]
}
ReedSolomonDecoder.prototype.findErrorLocations = function (errorLocator) {
  const numErrors = errorLocator.Degree
  if (numErrors == 1) {
    return new Array(errorLocator.getCoefficient(1))
  }
  const result = new Array(numErrors)
  let e = 0
  for (let i = 1; i < 256 && e < numErrors; i++) {
    if (errorLocator.evaluateAt(i) == 0) {
      result[e] = this.field.inverse(i)
      e++
    }
  }
  if (e != numErrors) {
    throw 'Error locator degree does not match number of roots'
  }
  return result
}
ReedSolomonDecoder.prototype.findErrorMagnitudes = function (errorEvaluator, errorLocations, dataMatrix) {
  const s = errorLocations.length
  const result = new Array(s)
  for (let i = 0; i < s; i++) {
    const xiInverse = this.field.inverse(errorLocations[i])
    let denominator = 1
    for (let j = 0; j < s; j++) {
      if (i != j) {
        denominator = this.field.multiply(denominator, GF256.prototype.addOrSubtract(1, this.field.multiply(errorLocations[j], xiInverse)))
      }
    }
    result[i] = this.field.multiply(errorEvaluator.evaluateAt(xiInverse), this.field.inverse(denominator))
    if (dataMatrix) {
      result[i] = this.field.multiply(result[i], xiInverse)
    }
  }
  return result
}
