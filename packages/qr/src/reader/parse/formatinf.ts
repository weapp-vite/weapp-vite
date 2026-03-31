/**
 * @file 二维码解析内部模块：formatinf。
 */
import { URShift } from '../core/qrcode'
import ErrorCorrectionLevel from './errorlevel'

const FORMAT_INFO_MASK_QR = 0x5412
const FORMAT_INFO_DECODE_LOOKUP = [
  [0x5412, 0x00],
  [0x5125, 0x01],
  [0x5E7C, 0x02],
  [0x5B4B, 0x03],
  [0x45F9, 0x04],
  [0x40CE, 0x05],
  [0x4F97, 0x06],
  [0x4AA0, 0x07],
  [0x77C4, 0x08],
  [0x72F3, 0x09],
  [0x7DAA, 0x0A],
  [0x789D, 0x0B],
  [0x662F, 0x0C],
  [0x6318, 0x0D],
  [0x6C41, 0x0E],
  [0x6976, 0x0F],
  [0x1689, 0x10],
  [0x13BE, 0x11],
  [0x1CE7, 0x12],
  [0x19D0, 0x13],
  [0x0762, 0x14],
  [0x0255, 0x15],
  [0x0D0C, 0x16],
  [0x083B, 0x17],
  [0x355F, 0x18],
  [0x3068, 0x19],
  [0x3F31, 0x1A],
  [0x3A06, 0x1B],
  [0x24B4, 0x1C],
  [0x2183, 0x1D],
  [0x2EDA, 0x1E],
  [0x2BED, 0x1F],
] as const
const BITS_SET_IN_HALF_BYTE = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4]

export default class FormatInformation {
  static numBitsDiffering(a: number, b: number) {
    a ^= b
    return BITS_SET_IN_HALF_BYTE[a & 0x0F]
      + BITS_SET_IN_HALF_BYTE[(URShift(a, 4) & 0x0F)]
      + BITS_SET_IN_HALF_BYTE[(URShift(a, 8) & 0x0F)]
      + BITS_SET_IN_HALF_BYTE[(URShift(a, 12) & 0x0F)]
      + BITS_SET_IN_HALF_BYTE[(URShift(a, 16) & 0x0F)]
      + BITS_SET_IN_HALF_BYTE[(URShift(a, 20) & 0x0F)]
      + BITS_SET_IN_HALF_BYTE[(URShift(a, 24) & 0x0F)]
      + BITS_SET_IN_HALF_BYTE[(URShift(a, 28) & 0x0F)]
  }

  static decodeFormatInformation(maskedFormatInfo: number) {
    const formatInfo = FormatInformation.doDecodeFormatInformation(maskedFormatInfo)
    if (formatInfo != null) {
      return formatInfo
    }
    return FormatInformation.doDecodeFormatInformation(maskedFormatInfo ^ FORMAT_INFO_MASK_QR)
  }

  static doDecodeFormatInformation(maskedFormatInfo: number) {
    let bestDifference = 0xFFFFFFFF
    let bestFormatInfo = 0
    for (let i = 0; i < FORMAT_INFO_DECODE_LOOKUP.length; i++) {
      const decodeInfo = FORMAT_INFO_DECODE_LOOKUP[i]
      const targetInfo = decodeInfo[0]
      if (targetInfo === maskedFormatInfo) {
        return new FormatInformation(decodeInfo[1])
      }
      const bitsDifference = this.numBitsDiffering(maskedFormatInfo, targetInfo)
      if (bitsDifference < bestDifference) {
        bestFormatInfo = decodeInfo[1]
        bestDifference = bitsDifference
      }
    }
    if (bestDifference <= 3) {
      return new FormatInformation(bestFormatInfo)
    }
    return null
  }

  errorCorrectionLevel: ErrorCorrectionLevel
  dataMask: number

  constructor(formatInfo: number) {
    this.errorCorrectionLevel = ErrorCorrectionLevel.forBits((formatInfo >> 3) & 0x03)
    this.dataMask = (formatInfo & 0x07)
  }

  GetHashCode() {
    return (this.errorCorrectionLevel.ordinal() << 3) | this.dataMask
  }

  Equals(o: FormatInformation) {
    return this.errorCorrectionLevel === o.errorCorrectionLevel && this.dataMask === o.dataMask
  }
}
