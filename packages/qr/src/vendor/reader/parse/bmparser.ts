/**
 * @file 二维码解析内部模块：bmparser。
 */
import type BitMatrix from './bitmat'
import DataMask from './datamask'
import FormatInformation from './formatinf'
import Version from './version'

export default class BitMatrixParser {
  bitMatrix: BitMatrix
  parsedVersion: Version | null
  parsedFormatInfo: FormatInformation | null

  constructor(bitMatrix: BitMatrix) {
    const dimension = bitMatrix.Dimension
    if (dimension < 21 || (dimension & 0x03) !== 1) {
      throw new Error('Error BitMatrixParser')
    }
    this.bitMatrix = bitMatrix
    this.parsedVersion = null
    this.parsedFormatInfo = null
  }

  copyBit(i: number, j: number, versionBits: number) {
    return this.bitMatrix.get_Renamed(i, j) ? (versionBits << 1) | 0x1 : versionBits << 1
  }

  readFormatInformation() {
    if (this.parsedFormatInfo != null) {
      return this.parsedFormatInfo
    }

    let formatInfoBits = 0
    for (let i = 0; i < 6; i++) {
      formatInfoBits = this.copyBit(i, 8, formatInfoBits)
    }
    formatInfoBits = this.copyBit(7, 8, formatInfoBits)
    formatInfoBits = this.copyBit(8, 8, formatInfoBits)
    formatInfoBits = this.copyBit(8, 7, formatInfoBits)
    for (let j = 5; j >= 0; j--) {
      formatInfoBits = this.copyBit(8, j, formatInfoBits)
    }
    this.parsedFormatInfo = FormatInformation.decodeFormatInformation(formatInfoBits)
    if (this.parsedFormatInfo != null) {
      return this.parsedFormatInfo
    }

    const dimension = this.bitMatrix.Dimension
    formatInfoBits = 0
    const iMin = dimension - 8
    for (let i = dimension - 1; i >= iMin; i--) {
      formatInfoBits = this.copyBit(i, 8, formatInfoBits)
    }
    for (let j = dimension - 7; j < dimension; j++) {
      formatInfoBits = this.copyBit(8, j, formatInfoBits)
    }
    this.parsedFormatInfo = FormatInformation.decodeFormatInformation(formatInfoBits)
    if (this.parsedFormatInfo != null) {
      return this.parsedFormatInfo
    }
    throw new Error('Error readFormatInformation')
  }

  readVersion() {
    if (this.parsedVersion != null) {
      return this.parsedVersion
    }

    const dimension = this.bitMatrix.Dimension
    const provisionalVersion = (dimension - 17) >> 2
    if (provisionalVersion <= 6) {
      return Version.getVersionForNumber(provisionalVersion)
    }

    let versionBits = 0
    const ijMin = dimension - 11
    for (let j = 5; j >= 0; j--) {
      for (let i = dimension - 9; i >= ijMin; i--) {
        versionBits = this.copyBit(i, j, versionBits)
      }
    }
    this.parsedVersion = Version.decodeVersionInformation(versionBits)
    if (this.parsedVersion != null && this.parsedVersion.DimensionForVersion === dimension) {
      return this.parsedVersion
    }

    versionBits = 0
    for (let i = 5; i >= 0; i--) {
      for (let j = dimension - 9; j >= ijMin; j--) {
        versionBits = this.copyBit(i, j, versionBits)
      }
    }
    this.parsedVersion = Version.decodeVersionInformation(versionBits)
    if (this.parsedVersion != null && this.parsedVersion.DimensionForVersion === dimension) {
      return this.parsedVersion
    }
    throw new Error('Error readVersion')
  }

  readCodewords() {
    const formatInfo = this.readFormatInformation()
    const version = this.readVersion()
    const dataMask = DataMask.forReference(formatInfo.dataMask)
    const dimension = this.bitMatrix.Dimension
    dataMask.unmaskBitMatrix(this.bitMatrix, dimension)
    const functionPattern = version.buildFunctionPattern()
    let readingUp = true
    const result = new Array<number>(version.totalCodewords).fill(0)
    let resultOffset = 0
    let currentByte = 0
    let bitsRead = 0

    for (let j = dimension - 1; j > 0; j -= 2) {
      if (j === 6) {
        j--
      }
      for (let count = 0; count < dimension; count++) {
        const i = readingUp ? dimension - 1 - count : count
        for (let col = 0; col < 2; col++) {
          if (!functionPattern.get_Renamed(j - col, i)) {
            bitsRead++
            currentByte <<= 1
            if (this.bitMatrix.get_Renamed(j - col, i)) {
              currentByte |= 1
            }
            if (bitsRead === 8) {
              result[resultOffset++] = currentByte
              bitsRead = 0
              currentByte = 0
            }
          }
        }
      }
      readingUp = !readingUp
    }

    if (resultOffset !== version.totalCodewords) {
      throw new Error('Error readCodewords')
    }
    return result
  }
}
