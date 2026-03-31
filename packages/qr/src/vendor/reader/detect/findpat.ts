/**
 * @file 二维码解析内部模块：findpat。
 */
const MIN_SKIP = 3
const MAX_MODULES = 57
const INTEGER_MATH_SHIFT = 8
const CENTER_QUORUM = 2

interface BinaryImage {
  width: number
  height: number
  data: ArrayLike<boolean | number>
}

interface ResultPointCallback {
  foundPossibleResultPoint?: (point: FinderPattern) => void
}

function orderBestPatterns(patterns: FinderPattern[]) {
  function distance(pattern1: FinderPattern, pattern2: FinderPattern) {
    const xDiff = pattern1.X - pattern2.X
    const yDiff = pattern1.Y - pattern2.Y
    return Math.sqrt(xDiff * xDiff + yDiff * yDiff)
  }

  function crossProductZ(pointA: FinderPattern, pointB: FinderPattern, pointC: FinderPattern) {
    const bX = pointB.x
    const bY = pointB.y
    return ((pointC.x - bX) * (pointA.y - bY)) - ((pointC.y - bY) * (pointA.x - bX))
  }

  const zeroOneDistance = distance(patterns[0], patterns[1])
  const oneTwoDistance = distance(patterns[1], patterns[2])
  const zeroTwoDistance = distance(patterns[0], patterns[2])
  let pointA: FinderPattern
  let pointB: FinderPattern
  let pointC: FinderPattern
  if (oneTwoDistance >= zeroOneDistance && oneTwoDistance >= zeroTwoDistance) {
    pointB = patterns[0]
    pointA = patterns[1]
    pointC = patterns[2]
  }
  else if (zeroTwoDistance >= oneTwoDistance && zeroTwoDistance >= zeroOneDistance) {
    pointB = patterns[1]
    pointA = patterns[0]
    pointC = patterns[2]
  }
  else {
    pointB = patterns[2]
    pointA = patterns[0]
    pointC = patterns[1]
  }
  if (crossProductZ(pointA, pointB, pointC) < 0) {
    const temp = pointA
    pointA = pointC
    pointC = temp
  }
  patterns[0] = pointA
  patterns[1] = pointB
  patterns[2] = pointC
}

export class FinderPattern {
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
    return this.x
  }

  get Y() {
    return this.y
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

export class FinderPatternInfo {
  bottomLeft: FinderPattern
  topLeft: FinderPattern
  topRight: FinderPattern

  constructor(patternCenters: FinderPattern[]) {
    this.bottomLeft = patternCenters[0]
    this.topLeft = patternCenters[1]
    this.topRight = patternCenters[2]
  }
}

export class FinderPatternFinder {
  image: BinaryImage | null
  possibleCenters: FinderPattern[]
  hasSkipped: boolean
  crossCheckStateCount: [number, number, number, number, number]
  resultPointCallback: ResultPointCallback | null

  constructor() {
    this.image = null
    this.possibleCenters = []
    this.hasSkipped = false
    this.crossCheckStateCount = [0, 0, 0, 0, 0]
    this.resultPointCallback = null
  }

  get CrossCheckStateCount() {
    this.crossCheckStateCount[0] = 0
    this.crossCheckStateCount[1] = 0
    this.crossCheckStateCount[2] = 0
    this.crossCheckStateCount[3] = 0
    this.crossCheckStateCount[4] = 0
    return this.crossCheckStateCount
  }

  foundPatternCross(stateCount: [number, number, number, number, number]) {
    let totalModuleSize = 0
    for (let i = 0; i < 5; i++) {
      const count = stateCount[i]
      if (count === 0) {
        return false
      }
      totalModuleSize += count
    }
    if (totalModuleSize < 7) {
      return false
    }
    const moduleSize = Math.floor((totalModuleSize << INTEGER_MATH_SHIFT) / 7)
    const maxVariance = Math.floor(moduleSize / 2)
    return Math.abs(moduleSize - (stateCount[0] << INTEGER_MATH_SHIFT)) < maxVariance
      && Math.abs(moduleSize - (stateCount[1] << INTEGER_MATH_SHIFT)) < maxVariance
      && Math.abs(3 * moduleSize - (stateCount[2] << INTEGER_MATH_SHIFT)) < 3 * maxVariance
      && Math.abs(moduleSize - (stateCount[3] << INTEGER_MATH_SHIFT)) < maxVariance
      && Math.abs(moduleSize - (stateCount[4] << INTEGER_MATH_SHIFT)) < maxVariance
  }

  centerFromEnd(stateCount: [number, number, number, number, number], end: number) {
    return (end - stateCount[4] - stateCount[3]) - stateCount[2] / 2
  }

  crossCheckVertical(startI: number, centerJ: number, maxCount: number, originalStateCountTotal: number) {
    if (this.image == null) {
      throw new Error('Image is not initialized')
    }
    const maxI = this.image.height
    const stateCount = this.CrossCheckStateCount
    let i = startI
    while (i >= 0 && this.image.data[centerJ + i * this.image.width]) {
      stateCount[2]++
      i--
    }
    if (i < 0) {
      return Number.NaN
    }
    while (i >= 0 && !this.image.data[centerJ + i * this.image.width] && stateCount[1] <= maxCount) {
      stateCount[1]++
      i--
    }
    if (i < 0 || stateCount[1] > maxCount) {
      return Number.NaN
    }
    while (i >= 0 && this.image.data[centerJ + i * this.image.width] && stateCount[0] <= maxCount) {
      stateCount[0]++
      i--
    }
    if (stateCount[0] > maxCount) {
      return Number.NaN
    }
    i = startI + 1
    while (i < maxI && this.image.data[centerJ + i * this.image.width]) {
      stateCount[2]++
      i++
    }
    if (i === maxI) {
      return Number.NaN
    }
    while (i < maxI && !this.image.data[centerJ + i * this.image.width] && stateCount[3] < maxCount) {
      stateCount[3]++
      i++
    }
    if (i === maxI || stateCount[3] >= maxCount) {
      return Number.NaN
    }
    while (i < maxI && this.image.data[centerJ + i * this.image.width] && stateCount[4] < maxCount) {
      stateCount[4]++
      i++
    }
    if (stateCount[4] >= maxCount) {
      return Number.NaN
    }
    const stateCountTotal = stateCount[0] + stateCount[1] + stateCount[2] + stateCount[3] + stateCount[4]
    if (5 * Math.abs(stateCountTotal - originalStateCountTotal) >= 2 * originalStateCountTotal) {
      return Number.NaN
    }
    return this.foundPatternCross(stateCount) ? this.centerFromEnd(stateCount, i) : Number.NaN
  }

  crossCheckHorizontal(startJ: number, centerI: number, maxCount: number, originalStateCountTotal: number) {
    if (this.image == null) {
      throw new Error('Image is not initialized')
    }
    const maxJ = this.image.width
    const stateCount = this.CrossCheckStateCount
    let j = startJ
    while (j >= 0 && this.image.data[j + centerI * this.image.width]) {
      stateCount[2]++
      j--
    }
    if (j < 0) {
      return Number.NaN
    }
    while (j >= 0 && !this.image.data[j + centerI * this.image.width] && stateCount[1] <= maxCount) {
      stateCount[1]++
      j--
    }
    if (j < 0 || stateCount[1] > maxCount) {
      return Number.NaN
    }
    while (j >= 0 && this.image.data[j + centerI * this.image.width] && stateCount[0] <= maxCount) {
      stateCount[0]++
      j--
    }
    if (stateCount[0] > maxCount) {
      return Number.NaN
    }
    j = startJ + 1
    while (j < maxJ && this.image.data[j + centerI * this.image.width]) {
      stateCount[2]++
      j++
    }
    if (j === maxJ) {
      return Number.NaN
    }
    while (j < maxJ && !this.image.data[j + centerI * this.image.width] && stateCount[3] < maxCount) {
      stateCount[3]++
      j++
    }
    if (j === maxJ || stateCount[3] >= maxCount) {
      return Number.NaN
    }
    while (j < maxJ && this.image.data[j + centerI * this.image.width] && stateCount[4] < maxCount) {
      stateCount[4]++
      j++
    }
    if (stateCount[4] >= maxCount) {
      return Number.NaN
    }
    const stateCountTotal = stateCount[0] + stateCount[1] + stateCount[2] + stateCount[3] + stateCount[4]
    if (5 * Math.abs(stateCountTotal - originalStateCountTotal) >= originalStateCountTotal) {
      return Number.NaN
    }
    return this.foundPatternCross(stateCount) ? this.centerFromEnd(stateCount, j) : Number.NaN
  }

  handlePossibleCenter(stateCount: [number, number, number, number, number], i: number, j: number) {
    const stateCountTotal = stateCount[0] + stateCount[1] + stateCount[2] + stateCount[3] + stateCount[4]
    let centerJ = this.centerFromEnd(stateCount, j)
    const centerI = this.crossCheckVertical(i, Math.floor(centerJ), stateCount[2], stateCountTotal)
    if (!Number.isNaN(centerI)) {
      centerJ = this.crossCheckHorizontal(Math.floor(centerJ), Math.floor(centerI), stateCount[2], stateCountTotal)
      if (!Number.isNaN(centerJ)) {
        const estimatedModuleSize = stateCountTotal / 7
        let found = false
        for (let index = 0; index < this.possibleCenters.length; index++) {
          const center = this.possibleCenters[index]
          if (center.aboutEquals(estimatedModuleSize, centerI, centerJ)) {
            center.incrementCount()
            found = true
            break
          }
        }
        if (!found) {
          const point = new FinderPattern(centerJ, centerI, estimatedModuleSize)
          this.possibleCenters.push(point)
          this.resultPointCallback?.foundPossibleResultPoint?.(point)
        }
        return true
      }
    }
    return false
  }

  selectBestPatterns() {
    const startSize = this.possibleCenters.length
    if (startSize < 3) {
      throw new Error(`Couldn't find enough finder patterns:${startSize} patterns found`)
    }
    if (startSize > 3) {
      let totalModuleSize = 0
      let square = 0
      for (let i = 0; i < startSize; i++) {
        const centerValue = this.possibleCenters[i].estimatedModuleSize
        totalModuleSize += centerValue
        square += centerValue * centerValue
      }
      const average = totalModuleSize / startSize
      this.possibleCenters.sort((center1, center2) => {
        const dA = Math.abs(center2.estimatedModuleSize - average)
        const dB = Math.abs(center1.estimatedModuleSize - average)
        if (dA < dB) {
          return -1
        }
        if (dA === dB) {
          return 0
        }
        return 1
      })
      const stdDev = Math.sqrt(square / startSize - average * average)
      const limit = Math.max(0.2 * average, stdDev)
      for (let i = this.possibleCenters.length - 1; i >= 0; i--) {
        const pattern = this.possibleCenters[i]
        if (Math.abs(pattern.estimatedModuleSize - average) > limit) {
          this.possibleCenters.splice(i, 1)
        }
      }
    }
    if (this.possibleCenters.length > 3) {
      this.possibleCenters.sort((a, b) => {
        if (a.count > b.count) {
          return -1
        }
        if (a.count < b.count) {
          return 1
        }
        return 0
      })
    }
    return [this.possibleCenters[0], this.possibleCenters[1], this.possibleCenters[2]]
  }

  findRowSkip() {
    if (this.possibleCenters.length <= 1) {
      return 0
    }
    let firstConfirmedCenter: FinderPattern | null = null
    for (let i = 0; i < this.possibleCenters.length; i++) {
      const center = this.possibleCenters[i]
      if (center.count >= CENTER_QUORUM) {
        if (firstConfirmedCenter == null) {
          firstConfirmedCenter = center
        }
        else {
          this.hasSkipped = true
          return Math.floor((Math.abs(firstConfirmedCenter.X - center.X) - Math.abs(firstConfirmedCenter.Y - center.Y)) / 2)
        }
      }
    }
    return 0
  }

  haveMultiplyConfirmedCenters() {
    let confirmedCount = 0
    let totalModuleSize = 0
    for (let i = 0; i < this.possibleCenters.length; i++) {
      const pattern = this.possibleCenters[i]
      if (pattern.count >= CENTER_QUORUM) {
        confirmedCount++
        totalModuleSize += pattern.estimatedModuleSize
      }
    }
    if (confirmedCount < 3) {
      return false
    }
    const average = totalModuleSize / this.possibleCenters.length
    let totalDeviation = 0
    for (let i = 0; i < this.possibleCenters.length; i++) {
      const pattern = this.possibleCenters[i]
      totalDeviation += Math.abs(pattern.estimatedModuleSize - average)
    }
    return totalDeviation <= 0.05 * totalModuleSize
  }

  findFinderPattern(image: BinaryImage) {
    const tryHarder = false
    this.image = image
    const maxI = image.height
    const maxJ = image.width
    let iSkip = Math.floor((3 * maxI) / (4 * MAX_MODULES))
    if (iSkip < MIN_SKIP || tryHarder) {
      iSkip = MIN_SKIP
    }
    let done = false
    const stateCount: [number, number, number, number, number] = [0, 0, 0, 0, 0]
    for (let i = iSkip - 1; i < maxI && !done; i += iSkip) {
      stateCount[0] = 0
      stateCount[1] = 0
      stateCount[2] = 0
      stateCount[3] = 0
      stateCount[4] = 0
      let currentState = 0
      for (let j = 0; j < maxJ; j++) {
        if (image.data[j + i * image.width]) {
          if ((currentState & 1) === 1) {
            currentState++
          }
          stateCount[currentState]++
        }
        else if ((currentState & 1) === 0) {
          if (currentState === 4) {
            if (this.foundPatternCross(stateCount)) {
              const confirmed = this.handlePossibleCenter(stateCount, i, j)
              if (confirmed) {
                iSkip = 2
                if (this.hasSkipped) {
                  done = this.haveMultiplyConfirmedCenters()
                }
                else {
                  const rowSkip = this.findRowSkip()
                  if (rowSkip > stateCount[2]) {
                    i += rowSkip - stateCount[2] - iSkip
                    j = maxJ - 1
                  }
                }
              }
              else {
                do {
                  j++
                } while (j < maxJ && !image.data[j + i * image.width])
                j--
              }
              currentState = 0
              stateCount[0] = 0
              stateCount[1] = 0
              stateCount[2] = 0
              stateCount[3] = 0
              stateCount[4] = 0
            }
            else {
              stateCount[0] = stateCount[2]
              stateCount[1] = stateCount[3]
              stateCount[2] = stateCount[4]
              stateCount[3] = 1
              stateCount[4] = 0
              currentState = 3
            }
          }
          else {
            stateCount[++currentState]++
          }
        }
        else {
          stateCount[currentState]++
        }
      }
      if (this.foundPatternCross(stateCount)) {
        const confirmed = this.handlePossibleCenter(stateCount, i, maxJ)
        if (confirmed) {
          iSkip = stateCount[0]
          if (this.hasSkipped) {
            done = this.haveMultiplyConfirmedCenters()
          }
        }
      }
    }
    const patternInfo = this.selectBestPatterns()
    orderBestPatterns(patternInfo)
    return new FinderPatternInfo(patternInfo)
  }
}
