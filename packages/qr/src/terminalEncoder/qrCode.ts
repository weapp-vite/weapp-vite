import QRBitBuffer from './bitBuffer'
/* eslint-disable e18e/prefer-array-fill */
/**
 * @file 终端二维码编码内部模块：qrCode。
 */
import QR8bitByte from './byte'
import QRPolynomial from './polynomial'
import QRRSBlock from './rsBlock'
import QRUtil from './util'

type QRCodeModuleCell = boolean | null
type QRCodeModules = QRCodeModuleCell[][]

interface MovieClipLike {
  beginFill: (color: number, alpha: number) => void
  moveTo: (x: number, y: number) => void
  lineTo: (x: number, y: number) => void
  endFill: () => void
}

interface MovieClipTargetLike {
  createEmptyMovieClip: (instanceName: string, depth: number) => MovieClipLike
}

class QRCode {
  static PAD0 = 0xEC
  static PAD1 = 0x11

  typeNumber: number
  errorCorrectLevel: number
  modules: QRCodeModules
  moduleCount: number
  dataCache: number[] | null
  dataList: QR8bitByte[]

  constructor(typeNumber: number, errorCorrectLevel: number) {
    this.typeNumber = typeNumber
    this.errorCorrectLevel = errorCorrectLevel
    this.modules = []
    this.moduleCount = 0
    this.dataCache = null
    this.dataList = []
  }

  addData(data: string) {
    const newData = new QR8bitByte(data)
    this.dataList.push(newData)
    this.dataCache = null
  }

  isDark(row: number, col: number) {
    if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
      throw new Error(`${row},${col}`)
    }
    return this.modules[row][col] === true
  }

  getModuleCount() {
    return this.moduleCount
  }

  make() {
    if (this.typeNumber < 1) {
      let typeNumber = 1
      for (typeNumber = 1; typeNumber < 40; typeNumber++) {
        const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel)
        const buffer = new QRBitBuffer()
        let totalDataCount = 0
        for (let i = 0; i < rsBlocks.length; i++) {
          totalDataCount += rsBlocks[i].dataCount
        }
        for (let x = 0; x < this.dataList.length; x++) {
          const data = this.dataList[x]
          buffer.put(data.mode, 4)
          buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber))
          data.write(buffer)
        }
        if (buffer.getLengthInBits() <= totalDataCount * 8) {
          break
        }
      }
      this.typeNumber = typeNumber
    }
    this.makeImpl(false, this.getBestMaskPattern())
  }

  makeImpl(test: boolean, maskPattern: number) {
    this.moduleCount = this.typeNumber * 4 + 17
    this.modules = Array.from({ length: this.moduleCount }, (): QRCodeModuleCell[] => [])
    for (let row = 0; row < this.moduleCount; row++) {
      this.modules[row] = Array.from({ length: this.moduleCount }, (): QRCodeModuleCell => null)
      for (let col = 0; col < this.moduleCount; col++) {
        this.modules[row][col] = null
      }
    }
    this.setupPositionProbePattern(0, 0)
    this.setupPositionProbePattern(this.moduleCount - 7, 0)
    this.setupPositionProbePattern(0, this.moduleCount - 7)
    this.setupPositionAdjustPattern()
    this.setupTimingPattern()
    this.setupTypeInfo(test, maskPattern)
    if (this.typeNumber >= 7) {
      this.setupTypeNumber(test)
    }
    if (this.dataCache === null) {
      this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList)
    }
    this.mapData(this.dataCache, maskPattern)
  }

  setupPositionProbePattern(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) {
        continue
      }
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) {
          continue
        }
        if ((r >= 0 && r <= 6 && (c === 0 || c === 6))
          || (c >= 0 && c <= 6 && (r === 0 || r === 6))
          || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          this.modules[row + r][col + c] = true
        }
        else {
          this.modules[row + r][col + c] = false
        }
      }
    }
  }

  getBestMaskPattern() {
    let minLostPoint = 0
    let pattern = 0
    for (let i = 0; i < 8; i++) {
      this.makeImpl(true, i)
      const lostPoint = QRUtil.getLostPoint(this)
      if (i === 0 || minLostPoint > lostPoint) {
        minLostPoint = lostPoint
        pattern = i
      }
    }
    return pattern
  }

  createMovieClip(target_mc: MovieClipTargetLike, instance_name: string, depth: number) {
    const qr_mc = target_mc.createEmptyMovieClip(instance_name, depth)
    const cs = 1
    this.make()
    for (let row = 0; row < this.modules.length; row++) {
      const y = row * cs
      for (let col = 0; col < this.modules[row].length; col++) {
        const x = col * cs
        const dark = this.modules[row][col]
        if (dark) {
          qr_mc.beginFill(0, 100)
          qr_mc.moveTo(x, y)
          qr_mc.lineTo(x + cs, y)
          qr_mc.lineTo(x + cs, y + cs)
          qr_mc.lineTo(x, y + cs)
          qr_mc.endFill()
        }
      }
    }
    return qr_mc
  }

  setupTimingPattern() {
    for (let r = 8; r < this.moduleCount - 8; r++) {
      if (this.modules[r][6] !== null) {
        continue
      }
      this.modules[r][6] = (r % 2 === 0)
    }
    for (let c = 8; c < this.moduleCount - 8; c++) {
      if (this.modules[6][c] !== null) {
        continue
      }
      this.modules[6][c] = (c % 2 === 0)
    }
  }

  setupPositionAdjustPattern() {
    const pos = QRUtil.getPatternPosition(this.typeNumber)
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const row = pos[i]
        const col = pos[j]
        if (this.modules[row][col] !== null) {
          continue
        }
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            if (Math.abs(r) === 2
              || Math.abs(c) === 2
              || (r === 0 && c === 0)) {
              this.modules[row + r][col + c] = true
            }
            else {
              this.modules[row + r][col + c] = false
            }
          }
        }
      }
    }
  }

  setupTypeNumber(test: boolean) {
    const bits = QRUtil.getBCHTypeNumber(this.typeNumber)
    let mod = false
    for (let i = 0; i < 18; i++) {
      mod = (!test && ((bits >> i) & 1) === 1)
      this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod
    }
    for (let x = 0; x < 18; x++) {
      mod = (!test && ((bits >> x) & 1) === 1)
      this.modules[x % 3 + this.moduleCount - 8 - 3][Math.floor(x / 3)] = mod
    }
  }

  setupTypeInfo(test: boolean, maskPattern: number) {
    const data = (this.errorCorrectLevel << 3) | maskPattern
    const bits = QRUtil.getBCHTypeInfo(data)
    let mod = false
    for (let v = 0; v < 15; v++) {
      mod = (!test && ((bits >> v) & 1) === 1)
      if (v < 6) {
        this.modules[v][8] = mod
      }
      else if (v < 8) {
        this.modules[v + 1][8] = mod
      }
      else {
        this.modules[this.moduleCount - 15 + v][8] = mod
      }
    }
    for (let h = 0; h < 15; h++) {
      mod = (!test && ((bits >> h) & 1) === 1)
      if (h < 8) {
        this.modules[8][this.moduleCount - h - 1] = mod
      }
      else if (h < 9) {
        this.modules[8][15 - h - 1 + 1] = mod
      }
      else {
        this.modules[8][15 - h - 1] = mod
      }
    }
    this.modules[this.moduleCount - 8][8] = (!test)
  }

  mapData(data: number[], maskPattern: number) {
    let inc = -1
    let row = this.moduleCount - 1
    let bitIndex = 7
    let byteIndex = 0
    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) {
        col--
      }
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] === null) {
            let dark = false
            if (byteIndex < data.length) {
              dark = (((data[byteIndex] >>> bitIndex) & 1) === 1)
            }
            const mask = QRUtil.getMask(maskPattern, row, col - c)
            if (mask) {
              dark = !dark
            }
            this.modules[row][col - c] = dark
            bitIndex--
            if (bitIndex === -1) {
              byteIndex++
              bitIndex = 7
            }
          }
        }
        row += inc
        if (row < 0 || this.moduleCount <= row) {
          row -= inc
          inc = -inc
          break
        }
      }
    }
  }

  static createData(typeNumber: number, errorCorrectLevel: number, dataList: QR8bitByte[]) {
    const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel)
    const buffer = new QRBitBuffer()
    for (let i = 0; i < dataList.length; i++) {
      const data = dataList[i]
      buffer.put(data.mode, 4)
      buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber))
      data.write(buffer)
    }
    let totalDataCount = 0
    for (let x = 0; x < rsBlocks.length; x++) {
      totalDataCount += rsBlocks[x].dataCount
    }
    if (buffer.getLengthInBits() > totalDataCount * 8) {
      throw new Error(`code length overflow. (${
        buffer.getLengthInBits()
      }>${
        totalDataCount * 8
      })`)
    }
    if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
      buffer.put(0, 4)
    }
    while (buffer.getLengthInBits() % 8 !== 0) {
      buffer.putBit(false)
    }
    while (true) {
      if (buffer.getLengthInBits() >= totalDataCount * 8) {
        break
      }
      buffer.put(QRCode.PAD0, 8)
      if (buffer.getLengthInBits() >= totalDataCount * 8) {
        break
      }
      buffer.put(QRCode.PAD1, 8)
    }
    return QRCode.createBytes(buffer, rsBlocks)
  }

  static createBytes(buffer: QRBitBuffer, rsBlocks: QRRSBlock[]) {
    let offset = 0
    let maxDcCount = 0
    let maxEcCount = 0
    const dcdata: number[][] = Array.from({ length: rsBlocks.length }, () => [])
    const ecdata: number[][] = Array.from({ length: rsBlocks.length }, () => [])
    for (let r = 0; r < rsBlocks.length; r++) {
      const dcCount = rsBlocks[r].dataCount
      const ecCount = rsBlocks[r].totalCount - dcCount
      maxDcCount = Math.max(maxDcCount, dcCount)
      maxEcCount = Math.max(maxEcCount, ecCount)
      dcdata[r] = Array.from({ length: dcCount }, (): number => 0)
      for (let i = 0; i < dcdata[r].length; i++) {
        dcdata[r][i] = 0xFF & buffer.buffer[i + offset]
      }
      offset += dcCount
      const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount)
      const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1)
      const modPoly = rawPoly.mod(rsPoly)
      ecdata[r] = Array.from({ length: rsPoly.getLength() - 1 }, (): number => 0)
      for (let x = 0; x < ecdata[r].length; x++) {
        const modIndex = x + modPoly.getLength() - ecdata[r].length
        ecdata[r][x] = (modIndex >= 0) ? modPoly.get(modIndex) : 0
      }
    }
    let totalCodeCount = 0
    for (let y = 0; y < rsBlocks.length; y++) {
      totalCodeCount += rsBlocks[y].totalCount
    }
    const data = Array.from({ length: totalCodeCount }, (): number => 0)
    let index = 0
    for (let z = 0; z < maxDcCount; z++) {
      for (let s = 0; s < rsBlocks.length; s++) {
        if (z < dcdata[s].length) {
          data[index++] = dcdata[s][z]
        }
      }
    }
    for (let xx = 0; xx < maxEcCount; xx++) {
      for (let t = 0; t < rsBlocks.length; t++) {
        if (xx < ecdata[t].length) {
          data[index++] = ecdata[t][xx]
        }
      }
    }
    return data
  }
}

export default QRCode
