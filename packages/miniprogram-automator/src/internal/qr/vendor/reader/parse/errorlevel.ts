// @ts-nocheck
/**
 * @file 二维码解析内部模块：errorlevel。
 */
export default function ErrorCorrectionLevel(ordinal, bits, name) {
  this.ordinal_Renamed_Field = ordinal
  this.bits = bits
  this.name = name
}
ErrorCorrectionLevel.prototype.ordinal = function () {
  return this.ordinal_Renamed_Field
}
ErrorCorrectionLevel.forBits = function (bits) {
  if (bits < 0 || bits >= FOR_BITS.length) {
    throw 'ArgumentException'
  }
  return FOR_BITS[bits]
}
var FOR_BITS = [
  new ErrorCorrectionLevel(1, 0x00, 'M'),
  new ErrorCorrectionLevel(0, 0x01, 'L'),
  new ErrorCorrectionLevel(3, 0x02, 'H'),
  new ErrorCorrectionLevel(2, 0x03, 'Q'),
]
