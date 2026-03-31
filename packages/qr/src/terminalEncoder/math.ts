/* eslint-disable e18e/prefer-array-fill */
/**
 * @file 终端二维码编码内部模块：math。
 */
const EXP_TABLE = Array.from({ length: 256 }, (): number => 0)
const LOG_TABLE = Array.from({ length: 256 }, (): number => 0)

const QRMath = {
  glog(n: number) {
    if (n < 1) {
      throw new Error(`glog(${n})`)
    }
    return LOG_TABLE[n]
  },
  gexp(n: number) {
    while (n < 0) {
      n += 255
    }
    while (n >= 256) {
      n -= 255
    }
    return EXP_TABLE[n]
  },
}

for (let i = 0; i < 8; i++) {
  EXP_TABLE[i] = 1 << i
}

for (let i = 8; i < 256; i++) {
  EXP_TABLE[i] = EXP_TABLE[i - 4]
    ^ EXP_TABLE[i - 5]
    ^ EXP_TABLE[i - 6]
    ^ EXP_TABLE[i - 8]
}

for (let i = 0; i < 255; i++) {
  LOG_TABLE[EXP_TABLE[i]] = i
}

export default QRMath
