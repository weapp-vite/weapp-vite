// @ts-nocheck
import BitMatrixParser from './bmparser'
import DataBlock from './datablock'
import QRCodeDataBlockReader from './databr'
import GF256 from './gf256'
/**
 * @file 二维码解析内部模块：decoder。
 */
import ReedSolomonDecoder from './rsdecoder'

const Decoder = {}
Decoder.rsDecoder = new ReedSolomonDecoder(GF256.QR_CODE_FIELD)
Decoder.correctErrors = function (codewordBytes, numDataCodewords) {
  const numCodewords = codewordBytes.length
  const codewordsInts = new Array(numCodewords)
  for (var i = 0; i < numCodewords; i++) {
    codewordsInts[i] = codewordBytes[i] & 0xFF
  }
  const numECCodewords = codewordBytes.length - numDataCodewords
  try {
    Decoder.rsDecoder.decode(codewordsInts, numECCodewords)
  }
  catch (rse) {
    throw rse
  }
  for (var i = 0; i < numDataCodewords; i++) {
    codewordBytes[i] = codewordsInts[i]
  }
}
Decoder.decode = function (bits) {
  const parser = new BitMatrixParser(bits)
  const version = parser.readVersion()
  const ecLevel = parser.readFormatInformation().errorCorrectionLevel
  const codewords = parser.readCodewords()
  const dataBlocks = DataBlock.getDataBlocks(codewords, version, ecLevel)
  let totalBytes = 0
  for (var i = 0; i < dataBlocks.length; i++) {
    totalBytes += dataBlocks[i].numDataCodewords
  }
  const resultBytes = new Array(totalBytes)
  let resultOffset = 0
  for (let j = 0; j < dataBlocks.length; j++) {
    const dataBlock = dataBlocks[j]
    const codewordBytes = dataBlock.codewords
    const numDataCodewords = dataBlock.numDataCodewords
    Decoder.correctErrors(codewordBytes, numDataCodewords)
    for (var i = 0; i < numDataCodewords; i++) {
      resultBytes[resultOffset++] = codewordBytes[i]
    }
  }
  const reader = new QRCodeDataBlockReader(resultBytes, version.versionNumber, ecLevel.bits)
  return reader
}
export default Decoder
