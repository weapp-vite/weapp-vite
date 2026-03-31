/* eslint-disable e18e/prefer-array-fill */
/**
 * @file 二维码解析内部模块：datablock。
 */
import type ErrorCorrectionLevel from './errorlevel'
import type Version from './version'

export default class DataBlock {
  static getDataBlocks(rawCodewords: number[], version: Version, ecLevel: ErrorCorrectionLevel) {
    if (rawCodewords.length !== version.totalCodewords) {
      throw new Error('ArgumentException')
    }

    const ecBlocks = version.getECBlocksForLevel(ecLevel)
    let totalBlocks = 0
    const ecBlockArray = ecBlocks.getECBlocks()
    for (let i = 0; i < ecBlockArray.length; i++) {
      totalBlocks += ecBlockArray[i].count
    }

    const result = Array.from({ length: totalBlocks }, () => null as unknown as DataBlock)
    let numResultBlocks = 0
    for (let j = 0; j < ecBlockArray.length; j++) {
      const ecBlock = ecBlockArray[j]
      for (let i = 0; i < ecBlock.count; i++) {
        const numDataCodewords = ecBlock.dataCodewords
        const numBlockCodewords = ecBlocks.ecCodewordsPerBlock + numDataCodewords
        result[numResultBlocks++] = new DataBlock(numDataCodewords, Array.from({ length: numBlockCodewords }, (): number => 0))
      }
    }

    const shorterBlocksTotalCodewords = result[0].codewords.length
    let longerBlocksStartAt = result.length - 1
    while (longerBlocksStartAt >= 0) {
      const numCodewords = result[longerBlocksStartAt].codewords.length
      if (numCodewords === shorterBlocksTotalCodewords) {
        break
      }
      longerBlocksStartAt--
    }
    longerBlocksStartAt++

    const shorterBlocksNumDataCodewords = shorterBlocksTotalCodewords - ecBlocks.ecCodewordsPerBlock
    let rawCodewordsOffset = 0
    for (let i = 0; i < shorterBlocksNumDataCodewords; i++) {
      for (let j = 0; j < numResultBlocks; j++) {
        result[j].codewords[i] = rawCodewords[rawCodewordsOffset++]
      }
    }
    for (let j = longerBlocksStartAt; j < numResultBlocks; j++) {
      result[j].codewords[shorterBlocksNumDataCodewords] = rawCodewords[rawCodewordsOffset++]
    }
    const max = result[0].codewords.length
    for (let i = shorterBlocksNumDataCodewords; i < max; i++) {
      for (let j = 0; j < numResultBlocks; j++) {
        const iOffset = j < longerBlocksStartAt ? i : i + 1
        result[j].codewords[iOffset] = rawCodewords[rawCodewordsOffset++]
      }
    }
    return result
  }

  numDataCodewords: number
  codewords: number[]

  constructor(numDataCodewords: number, codewords: number[]) {
    this.numDataCodewords = numDataCodewords
    this.codewords = codewords
  }
}
