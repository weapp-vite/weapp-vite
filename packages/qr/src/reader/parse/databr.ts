/**
 * @file 二维码解析内部模块：databr。
 */
import { qrcode } from '../core/qrcode'

type DataByteChunk = number[] | string

const MODE_NUMBER = 1
const MODE_ROMAN_AND_NUMBER = 2
const MODE_8BIT_BYTE = 4
const MODE_KANJI = 8
const TABLE_ROMAN_AND_FIGURE = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', ' ', '$', '%', '*', '+', '-', '.', '/', ':']

export default class QRCodeDataBlockReader {
  blockPointer: number
  bitPointer: number
  dataLength: number
  blocks: number[]
  numErrorCorrectionCode: number
  dataLengthMode: 0 | 1 | 2

  constructor(blocks: number[], version: number, numErrorCorrectionCode: number) {
    this.blockPointer = 0
    this.bitPointer = 7
    this.dataLength = 0
    this.blocks = blocks
    this.numErrorCorrectionCode = numErrorCorrectionCode

    if (version <= 9) {
      this.dataLengthMode = 0
    }
    else if (version <= 26) {
      this.dataLengthMode = 1
    }
    else {
      this.dataLengthMode = 2
    }
  }

  getNextBits(numBits: number) {
    let bits = 0
    if (numBits < this.bitPointer + 1) {
      let mask = 0
      for (let i = 0; i < numBits; i++) {
        mask += 1 << i
      }
      mask <<= this.bitPointer - numBits + 1
      bits = (this.blocks[this.blockPointer] & mask) >> (this.bitPointer - numBits + 1)
      this.bitPointer -= numBits
      return bits
    }

    if (numBits < this.bitPointer + 1 + 8) {
      let mask1 = 0
      for (let i = 0; i < this.bitPointer + 1; i++) {
        mask1 += 1 << i
      }
      bits = (this.blocks[this.blockPointer] & mask1) << (numBits - (this.bitPointer + 1))
      this.blockPointer++
      bits += this.blocks[this.blockPointer] >> (8 - (numBits - (this.bitPointer + 1)))
      this.bitPointer -= numBits % 8
      if (this.bitPointer < 0) {
        this.bitPointer = 8 + this.bitPointer
      }
      return bits
    }

    if (numBits < this.bitPointer + 1 + 16) {
      let mask1 = 0
      let mask3 = 0
      for (let i = 0; i < this.bitPointer + 1; i++) {
        mask1 += 1 << i
      }
      const bitsFirstBlock = (this.blocks[this.blockPointer] & mask1) << (numBits - (this.bitPointer + 1))
      this.blockPointer++
      const bitsSecondBlock = this.blocks[this.blockPointer] << (numBits - (this.bitPointer + 1 + 8))
      this.blockPointer++
      for (let i = 0; i < numBits - (this.bitPointer + 1 + 8); i++) {
        mask3 += 1 << i
      }
      mask3 <<= 8 - (numBits - (this.bitPointer + 1 + 8))
      const bitsThirdBlock = (this.blocks[this.blockPointer] & mask3) >> (8 - (numBits - (this.bitPointer + 1 + 8)))
      bits = bitsFirstBlock + bitsSecondBlock + bitsThirdBlock
      this.bitPointer -= (numBits - 8) % 8
      if (this.bitPointer < 0) {
        this.bitPointer = 8 + this.bitPointer
      }
      return bits
    }

    return 0
  }

  NextMode() {
    if (this.blockPointer > this.blocks.length - this.numErrorCorrectionCode - 2) {
      return 0
    }
    return this.getNextBits(4)
  }

  getDataLength(modeIndicator: number) {
    let index = 0
    while (true) {
      if ((modeIndicator >> index) === 1) {
        break
      }
      index++
    }
    return this.getNextBits(qrcode.sizeOfDataLengthInfo[this.dataLengthMode][index])
  }

  getRomanAndFigureString(dataLength: number) {
    let length = dataLength
    let intData = 0
    let strData = ''
    do {
      if (length > 1) {
        intData = this.getNextBits(11)
        const firstLetter = Math.floor(intData / 45)
        const secondLetter = intData % 45
        strData += TABLE_ROMAN_AND_FIGURE[firstLetter]
        strData += TABLE_ROMAN_AND_FIGURE[secondLetter]
        length -= 2
      }
      else if (length === 1) {
        intData = this.getNextBits(6)
        strData += TABLE_ROMAN_AND_FIGURE[intData]
        length -= 1
      }
    } while (length > 0)
    return strData
  }

  getFigureString(dataLength: number) {
    let length = dataLength
    let intData = 0
    let strData = ''
    do {
      if (length >= 3) {
        intData = this.getNextBits(10)
        if (intData < 100) {
          strData += '0'
        }
        if (intData < 10) {
          strData += '0'
        }
        length -= 3
      }
      else if (length === 2) {
        intData = this.getNextBits(7)
        if (intData < 10) {
          strData += '0'
        }
        length -= 2
      }
      else if (length === 1) {
        intData = this.getNextBits(4)
        length -= 1
      }
      strData += intData
    } while (length > 0)
    return strData
  }

  get8bitByteArray(dataLength: number) {
    let length = dataLength
    let intData = 0
    const output: number[] = []
    do {
      intData = this.getNextBits(8)
      output.push(intData)
      length--
    } while (length > 0)
    return output
  }

  getKanjiString(dataLength: number) {
    let length = dataLength
    let intData = 0
    let unicodeString = ''
    do {
      intData = this.getNextBits(13)
      const lowerByte = intData % 0xC0
      const higherByte = Math.floor(intData / 0xC0)
      const tempWord = (higherByte << 8) + lowerByte
      let shiftjisWord = 0
      if (tempWord + 0x8140 <= 0x9FFC) {
        shiftjisWord = tempWord + 0x8140
      }
      else {
        shiftjisWord = tempWord + 0xC140
      }
      unicodeString += String.fromCharCode(shiftjisWord)
      length--
    } while (length > 0)
    return unicodeString
  }

  get DataByte(): DataByteChunk[] {
    const output: DataByteChunk[] = []
    do {
      const mode = this.NextMode()
      if (mode === 0) {
        if (output.length > 0) {
          break
        }
        throw new Error('Empty data block')
      }
      if (mode !== MODE_NUMBER && mode !== MODE_ROMAN_AND_NUMBER && mode !== MODE_8BIT_BYTE && mode !== MODE_KANJI && mode !== 7) {
        throw new Error(`Invalid mode: ${mode} in (block:${this.blockPointer} bit:${this.bitPointer})`)
      }
      const dataLength = this.getDataLength(mode)
      if (dataLength < 1) {
        throw new Error(`Invalid data length: ${dataLength}`)
      }
      switch (mode) {
        case MODE_NUMBER: {
          const temp = this.getFigureString(dataLength)
          output.push(Array.from(temp, char => char.charCodeAt(0)))
          break
        }
        case MODE_ROMAN_AND_NUMBER: {
          const temp = this.getRomanAndFigureString(dataLength)
          output.push(Array.from(temp, char => char.charCodeAt(0)))
          break
        }
        case MODE_8BIT_BYTE:
          output.push(this.get8bitByteArray(dataLength))
          break
        case MODE_KANJI:
          output.push(this.getKanjiString(dataLength))
          break
      }
    } while (true)
    return output
  }
}
