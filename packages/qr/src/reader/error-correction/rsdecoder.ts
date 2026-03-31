/* eslint-disable e18e/prefer-array-fill */
/**
 * @file 二维码解析内部模块：rsdecoder。
 */
import type GF256 from './gf256'
import GF256Poly from './gf256poly'

export default class ReedSolomonDecoder {
  field: GF256

  constructor(field: GF256) {
    this.field = field
  }

  decode(received: number[], twoS: number) {
    const poly = new GF256Poly(this.field, received)
    const syndromeCoefficients = Array.from({ length: twoS }, (): number => 0)
    const dataMatrix = false
    let noError = true
    for (let i = 0; i < twoS; i++) {
      const evaluation = poly.evaluateAt(this.field.exp(dataMatrix ? i + 1 : i))
      syndromeCoefficients[syndromeCoefficients.length - 1 - i] = evaluation
      if (evaluation !== 0) {
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
    for (let i = 0; i < errorLocations.length; i++) {
      const position = received.length - 1 - this.field.log(errorLocations[i])
      if (position < 0) {
        throw new Error('ReedSolomonException Bad error location')
      }
      received[position] = this.field.addOrSubtract(received[position], errorMagnitudes[i])
    }
  }

  runEuclideanAlgorithm(a: GF256Poly, b: GF256Poly, rValue: number) {
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
    while (r.Degree >= Math.floor(rValue / 2)) {
      const rLastLast = rLast
      const sLastLast = sLast
      const tLastLast = tLast
      rLast = r
      sLast = s
      tLast = t
      if (rLast.Zero) {
        throw new Error('r_{i-1} was zero')
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
    if (sigmaTildeAtZero === 0) {
      throw new Error('ReedSolomonException sigmaTilde(0) was zero')
    }
    const inverse = this.field.inverse(sigmaTildeAtZero)
    const sigma = t.multiply2(inverse)
    const omega = r.multiply2(inverse)
    return [sigma, omega] as const
  }

  findErrorLocations(errorLocator: GF256Poly) {
    const numErrors = errorLocator.Degree
    if (numErrors === 1) {
      return [errorLocator.getCoefficient(1)]
    }
    const result = Array.from({ length: numErrors }, (): number => 0)
    let errorIndex = 0
    for (let i = 1; i < 256 && errorIndex < numErrors; i++) {
      if (errorLocator.evaluateAt(i) === 0) {
        result[errorIndex] = this.field.inverse(i)
        errorIndex++
      }
    }
    if (errorIndex !== numErrors) {
      throw new Error('Error locator degree does not match number of roots')
    }
    return result
  }

  findErrorMagnitudes(errorEvaluator: GF256Poly, errorLocations: number[], dataMatrix: boolean) {
    const size = errorLocations.length
    const result = Array.from({ length: size }, (): number => 0)
    for (let i = 0; i < size; i++) {
      const xiInverse = this.field.inverse(errorLocations[i])
      let denominator = 1
      for (let j = 0; j < size; j++) {
        if (i !== j) {
          denominator = this.field.multiply(denominator, this.field.addOrSubtract(1, this.field.multiply(errorLocations[j], xiInverse)))
        }
      }
      result[i] = this.field.multiply(errorEvaluator.evaluateAt(xiInverse), this.field.inverse(denominator))
      if (dataMatrix) {
        result[i] = this.field.multiply(result[i], xiInverse)
      }
    }
    return result
  }
}
