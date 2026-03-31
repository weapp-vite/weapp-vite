/**
 * @file 二维码解析内部模块：errorlevel。
 */
export default class ErrorCorrectionLevel {
  static forBits(bits: number) {
    if (bits < 0 || bits >= FOR_BITS.length) {
      throw new Error('ArgumentException')
    }
    return FOR_BITS[bits]
  }

  ordinal_Renamed_Field: number
  bits: number
  name: string

  constructor(ordinal: number, bits: number, name: string) {
    this.ordinal_Renamed_Field = ordinal
    this.bits = bits
    this.name = name
  }

  ordinal() {
    return this.ordinal_Renamed_Field
  }
}

const FOR_BITS = [
  new ErrorCorrectionLevel(1, 0x00, 'M'),
  new ErrorCorrectionLevel(0, 0x01, 'L'),
  new ErrorCorrectionLevel(3, 0x02, 'H'),
  new ErrorCorrectionLevel(2, 0x03, 'Q'),
]
