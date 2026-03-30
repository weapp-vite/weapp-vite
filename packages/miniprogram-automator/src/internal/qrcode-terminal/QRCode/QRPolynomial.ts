// @ts-nocheck
/**
 * @file 终端二维码编码内部模块：QRPolynomial。
 */
import QRMath from './QRMath'

function QRPolynomial(num, shift) {
  if (num.length === undefined) {
    throw new Error(`${num.length}/${shift}`)
  }
  let offset = 0
  while (offset < num.length && num[offset] === 0) {
    offset++
  }
  this.num = new Array(num.length - offset + shift)
  for (let i = 0; i < num.length - offset; i++) {
    this.num[i] = num[i + offset]
  }
}
QRPolynomial.prototype = {
  get(index) {
    return this.num[index]
  },
  getLength() {
    return this.num.length
  },
  multiply(e) {
    const num = Array.from({ length: this.getLength() + e.getLength() - 1 })
    for (let i = 0; i < this.getLength(); i++) {
      for (let j = 0; j < e.getLength(); j++) {
        num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)))
      }
    }
    return new QRPolynomial(num, 0)
  },
  mod(e) {
    if (this.getLength() - e.getLength() < 0) {
      return this
    }
    const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0))
    const num = new Array(this.getLength())
    for (let i = 0; i < this.getLength(); i++) {
      num[i] = this.get(i)
    }
    for (let x = 0; x < e.getLength(); x++) {
      num[x] ^= QRMath.gexp(QRMath.glog(e.get(x)) + ratio)
    }
    return new QRPolynomial(num, 0).mod(e)
  },
}
export default QRPolynomial
