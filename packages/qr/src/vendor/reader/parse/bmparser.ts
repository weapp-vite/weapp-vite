// @ts-nocheck
import DataMask from './datamask'
/**
 * @file 二维码解析内部模块：bmparser。
 */
import FormatInformation from './formatinf'
import Version from './version'

export default function BitMatrixParser(bitMatrix) {
  const dimension = bitMatrix.Dimension
  if (dimension < 21 || (dimension & 0x03) != 1) {
    throw 'Error BitMatrixParser'
  }
  this.bitMatrix = bitMatrix
  this.parsedVersion = null
  this.parsedFormatInfo = null
}
BitMatrixParser.prototype.copyBit = function (i, j, versionBits) {
  return this.bitMatrix.get_Renamed(i, j) ? (versionBits << 1) | 0x1 : versionBits << 1
}
BitMatrixParser.prototype.readFormatInformation = function () {
  if (this.parsedFormatInfo != null) {
    return this.parsedFormatInfo
  }
  let formatInfoBits = 0
  for (var i = 0; i < 6; i++) {
    formatInfoBits = this.copyBit(i, 8, formatInfoBits)
  }
  formatInfoBits = this.copyBit(7, 8, formatInfoBits)
  formatInfoBits = this.copyBit(8, 8, formatInfoBits)
  formatInfoBits = this.copyBit(8, 7, formatInfoBits)
  for (var j = 5; j >= 0; j--) {
    formatInfoBits = this.copyBit(8, j, formatInfoBits)
  }
  this.parsedFormatInfo = FormatInformation.decodeFormatInformation(formatInfoBits)
  if (this.parsedFormatInfo != null) {
    return this.parsedFormatInfo
  }
  const dimension = this.bitMatrix.Dimension
  formatInfoBits = 0
  const iMin = dimension - 8
  for (var i = dimension - 1; i >= iMin; i--) {
    formatInfoBits = this.copyBit(i, 8, formatInfoBits)
  }
  for (var j = dimension - 7; j < dimension; j++) {
    formatInfoBits = this.copyBit(8, j, formatInfoBits)
  }
  this.parsedFormatInfo = FormatInformation.decodeFormatInformation(formatInfoBits)
  if (this.parsedFormatInfo != null) {
    return this.parsedFormatInfo
  }
  throw 'Error readFormatInformation'
}
BitMatrixParser.prototype.readVersion = function () {
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
  for (var j = 5; j >= 0; j--) {
    for (var i = dimension - 9; i >= ijMin; i--) {
      versionBits = this.copyBit(i, j, versionBits)
    }
  }
  this.parsedVersion = Version.decodeVersionInformation(versionBits)
  if (this.parsedVersion != null && this.parsedVersion.DimensionForVersion == dimension) {
    return this.parsedVersion
  }
  versionBits = 0
  for (var i = 5; i >= 0; i--) {
    for (var j = dimension - 9; j >= ijMin; j--) {
      versionBits = this.copyBit(i, j, versionBits)
    }
  }
  this.parsedVersion = Version.decodeVersionInformation(versionBits)
  if (this.parsedVersion != null && this.parsedVersion.DimensionForVersion == dimension) {
    return this.parsedVersion
  }
  throw 'Error readVersion'
}
BitMatrixParser.prototype.readCodewords = function () {
  const formatInfo = this.readFormatInformation()
  const version = this.readVersion()
  const dataMask = DataMask.forReference(formatInfo.dataMask)
  const dimension = this.bitMatrix.Dimension
  dataMask.unmaskBitMatrix(this.bitMatrix, dimension)
  const functionPattern = version.buildFunctionPattern()
  let readingUp = true
  const result = new Array(version.totalCodewords)
  let resultOffset = 0
  let currentByte = 0
  let bitsRead = 0
  for (let j = dimension - 1; j > 0; j -= 2) {
    if (j == 6) {
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
          if (bitsRead == 8) {
            result[resultOffset++] = currentByte
            bitsRead = 0
            currentByte = 0
          }
        }
      }
    }
    readingUp ^= true
  }
  if (resultOffset != version.totalCodewords) {
    throw 'Error readCodewords'
  }
  return result
}
