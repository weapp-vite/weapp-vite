/**
 * @file 二维码解析内部模块：alignpat。
 */
interface BinaryImage {
  width: number
  height: number
  data: ArrayLike<boolean | number>
}

interface ResultPointCallback {
  foundPossibleResultPoint?: (point: AlignmentPattern) => void
}

export default class AlignmentPattern {
  x: number
  y: number
  count: number
  estimatedModuleSize: number

  constructor(posX: number, posY: number, estimatedModuleSize: number) {
    this.x = posX
    this.y = posY
    this.count = 1
    this.estimatedModuleSize = estimatedModuleSize
  }

  get X() {
    return Math.floor(this.x)
  }

  get Y() {
    return Math.floor(this.y)
  }

  incrementCount() {
    this.count++
  }

  aboutEquals(moduleSize: number, i: number, j: number) {
    if (Math.abs(i - this.y) <= moduleSize && Math.abs(j - this.x) <= moduleSize) {
      const moduleSizeDiff = Math.abs(moduleSize - this.estimatedModuleSize)
      return moduleSizeDiff <= 1 || moduleSizeDiff / this.estimatedModuleSize <= 1
    }
    return false
  }
}

export class AlignmentPatternFinder {
  image: BinaryImage
  possibleCenters: AlignmentPattern[]
  startX: number
  startY: number
  width: number
  height: number
  moduleSize: number
  crossCheckStateCount: [number, number, number]
  resultPointCallback: ResultPointCallback | null

  constructor(image: BinaryImage, startX: number, startY: number, width: number, height: number, moduleSize: number, resultPointCallback: ResultPointCallback | null) {
    this.image = image
    this.possibleCenters = []
    this.startX = startX
    this.startY = startY
    this.width = width
    this.height = height
    this.moduleSize = moduleSize
    this.crossCheckStateCount = [0, 0, 0]
    this.resultPointCallback = resultPointCallback
  }

  centerFromEnd(stateCount: [number, number, number], end: number) {
    return (end - stateCount[2]) - stateCount[1] / 2
  }

  foundPatternCross(stateCount: [number, number, number]) {
    const maxVariance = this.moduleSize / 2
    for (let i = 0; i < 3; i++) {
      if (Math.abs(this.moduleSize - stateCount[i]) >= maxVariance) {
        return false
      }
    }
    return true
  }

  crossCheckVertical(startI: number, centerJ: number, maxCount: number, originalStateCountTotal: number) {
    const maxI = this.image.height
    const stateCount = this.crossCheckStateCount
    stateCount[0] = 0
    stateCount[1] = 0
    stateCount[2] = 0
    let i = startI
    while (i >= 0 && this.image.data[centerJ + i * this.image.width] && stateCount[1] <= maxCount) {
      stateCount[1]++
      i--
    }
    if (i < 0 || stateCount[1] > maxCount) {
      return Number.NaN
    }
    while (i >= 0 && !this.image.data[centerJ + i * this.image.width] && stateCount[0] <= maxCount) {
      stateCount[0]++
      i--
    }
    if (stateCount[0] > maxCount) {
      return Number.NaN
    }
    i = startI + 1
    while (i < maxI && this.image.data[centerJ + i * this.image.width] && stateCount[1] <= maxCount) {
      stateCount[1]++
      i++
    }
    if (i === maxI || stateCount[1] > maxCount) {
      return Number.NaN
    }
    while (i < maxI && !this.image.data[centerJ + i * this.image.width] && stateCount[2] <= maxCount) {
      stateCount[2]++
      i++
    }
    if (stateCount[2] > maxCount) {
      return Number.NaN
    }
    const stateCountTotal = stateCount[0] + stateCount[1] + stateCount[2]
    if (5 * Math.abs(stateCountTotal - originalStateCountTotal) >= 2 * originalStateCountTotal) {
      return Number.NaN
    }
    return this.foundPatternCross(stateCount) ? this.centerFromEnd(stateCount, i) : Number.NaN
  }

  handlePossibleCenter(stateCount: [number, number, number], i: number, j: number) {
    const stateCountTotal = stateCount[0] + stateCount[1] + stateCount[2]
    const centerJ = this.centerFromEnd(stateCount, j)
    const centerI = this.crossCheckVertical(i, Math.floor(centerJ), 2 * stateCount[1], stateCountTotal)
    if (!Number.isNaN(centerI)) {
      const estimatedModuleSize = stateCountTotal / 3
      for (let index = 0; index < this.possibleCenters.length; index++) {
        const center = this.possibleCenters[index]
        if (center.aboutEquals(estimatedModuleSize, centerI, centerJ)) {
          return new AlignmentPattern(centerJ, centerI, estimatedModuleSize)
        }
      }
      const point = new AlignmentPattern(centerJ, centerI, estimatedModuleSize)
      this.possibleCenters.push(point)
      this.resultPointCallback?.foundPossibleResultPoint?.(point)
      return point
    }
    return null
  }

  find() {
    const startX = this.startX
    const maxJ = startX + this.width
    const middleI = this.startY + (this.height >> 1)
    const stateCount: [number, number, number] = [0, 0, 0]
    for (let iGen = 0; iGen < this.height; iGen++) {
      const i = middleI + ((iGen & 0x01) === 0 ? ((iGen + 1) >> 1) : -((iGen + 1) >> 1))
      stateCount[0] = 0
      stateCount[1] = 0
      stateCount[2] = 0
      let j = startX
      while (j < maxJ && !this.image.data[j + this.image.width * i]) {
        j++
      }
      let currentState = 0
      while (j < maxJ) {
        if (this.image.data[j + i * this.image.width]) {
          if (currentState === 1) {
            stateCount[currentState]++
          }
          else if (currentState === 2) {
            if (this.foundPatternCross(stateCount)) {
              const confirmed = this.handlePossibleCenter(stateCount, i, j)
              if (confirmed != null) {
                return confirmed
              }
            }
            stateCount[0] = stateCount[2]
            stateCount[1] = 1
            stateCount[2] = 0
            currentState = 1
          }
          else {
            stateCount[++currentState]++
          }
        }
        else {
          if (currentState === 1) {
            currentState++
          }
          stateCount[currentState]++
        }
        j++
      }
      if (this.foundPatternCross(stateCount)) {
        const confirmed = this.handlePossibleCenter(stateCount, i, maxJ)
        if (confirmed != null) {
          return confirmed
        }
      }
    }
    if (this.possibleCenters.length > 0) {
      return this.possibleCenters[0]
    }
    throw new Error('Couldn\'t find enough alignment patterns')
  }
}
