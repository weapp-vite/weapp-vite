/* eslint-disable e18e/prefer-array-fill */
import type BitMatrix from './bitmat'
/**
 * @file 二维码解析内部模块：decoder。
 */
import GF256 from '../error-correction/gf256'
import ReedSolomonDecoder from '../error-correction/rsdecoder'
import BitMatrixParser from './bmparser'
import DataBlock from './datablock'
import QRCodeDataBlockReader from './databr'

const rsDecoder = new ReedSolomonDecoder(GF256.QR_CODE_FIELD)

const Decoder = {
  rsDecoder,
  correctErrors(codewordBytes: number[], numDataCodewords: number) {
    const numCodewords = codewordBytes.length
    const codewordsInts = Array.from({ length: numCodewords }, (): number => 0)
    for (let i = 0; i < numCodewords; i++) {
      codewordsInts[i] = codewordBytes[i] & 0xFF
    }

    const numECCodewords = codewordBytes.length - numDataCodewords
    rsDecoder.decode(codewordsInts, numECCodewords)

    for (let i = 0; i < numDataCodewords; i++) {
      codewordBytes[i] = codewordsInts[i]
    }
  },

  decode(bits: BitMatrix) {
    const parser = new BitMatrixParser(bits)
    const version = parser.readVersion()
    const ecLevel = parser.readFormatInformation().errorCorrectionLevel
    const codewords = parser.readCodewords()
    const dataBlocks = DataBlock.getDataBlocks(codewords, version, ecLevel)
    let totalBytes = 0
    for (let i = 0; i < dataBlocks.length; i++) {
      totalBytes += dataBlocks[i].numDataCodewords
    }
    const resultBytes = Array.from({ length: totalBytes }, (): number => 0)
    let resultOffset = 0
    for (let j = 0; j < dataBlocks.length; j++) {
      const dataBlock = dataBlocks[j]
      const codewordBytes = dataBlock.codewords
      const numDataCodewords = dataBlock.numDataCodewords
      Decoder.correctErrors(codewordBytes, numDataCodewords)
      for (let i = 0; i < numDataCodewords; i++) {
        resultBytes[resultOffset++] = codewordBytes[i]
      }
    }
    return new QRCodeDataBlockReader(resultBytes, version.versionNumber, ecLevel.bits)
  },
}

export default Decoder
