// @ts-nocheck
/**
 * @file 二维码解析内部模块：datablock。
 */
export default function DataBlock(numDataCodewords, codewords) {
  this.numDataCodewords = numDataCodewords
  this.codewords = codewords
}
DataBlock.getDataBlocks = function (rawCodewords, version, ecLevel) {
  if (rawCodewords.length != version.totalCodewords) {
    throw 'ArgumentException'
  }
  const ecBlocks = version.getECBlocksForLevel(ecLevel)
  let totalBlocks = 0
  const ecBlockArray = ecBlocks.getECBlocks()
  for (var i = 0; i < ecBlockArray.length; i++) {
    totalBlocks += ecBlockArray[i].count
  }
  const result = new Array(totalBlocks)
  let numResultBlocks = 0
  for (var j = 0; j < ecBlockArray.length; j++) {
    const ecBlock = ecBlockArray[j]
    for (var i = 0; i < ecBlock.count; i++) {
      const numDataCodewords = ecBlock.dataCodewords
      const numBlockCodewords = ecBlocks.ecCodewordsPerBlock + numDataCodewords
      result[numResultBlocks++] = new DataBlock(numDataCodewords, new Array(numBlockCodewords))
    }
  }
  const shorterBlocksTotalCodewords = result[0].codewords.length
  let longerBlocksStartAt = result.length - 1
  while (longerBlocksStartAt >= 0) {
    const numCodewords = result[longerBlocksStartAt].codewords.length
    if (numCodewords == shorterBlocksTotalCodewords) {
      break
    }
    longerBlocksStartAt--
  }
  longerBlocksStartAt++
  const shorterBlocksNumDataCodewords = shorterBlocksTotalCodewords - ecBlocks.ecCodewordsPerBlock
  let rawCodewordsOffset = 0
  for (var i = 0; i < shorterBlocksNumDataCodewords; i++) {
    for (var j = 0; j < numResultBlocks; j++) {
      result[j].codewords[i] = rawCodewords[rawCodewordsOffset++]
    }
  }
  for (var j = longerBlocksStartAt; j < numResultBlocks; j++) {
    result[j].codewords[shorterBlocksNumDataCodewords] = rawCodewords[rawCodewordsOffset++]
  }
  const max = result[0].codewords.length
  for (var i = shorterBlocksNumDataCodewords; i < max; i++) {
    for (var j = 0; j < numResultBlocks; j++) {
      const iOffset = j < longerBlocksStartAt ? i : i + 1
      result[j].codewords[iOffset] = rawCodewords[rawCodewordsOffset++]
    }
  }
  return result
}
