// @ts-nocheck
/**
 * @file 二维码解析内部模块：alignpat。
 */
export default function AlignmentPattern(posX, posY, estimatedModuleSize) {
  this.x = posX
  this.y = posY
  this.count = 1
  this.estimatedModuleSize = estimatedModuleSize
}
Object.defineProperty(AlignmentPattern.prototype, 'X', {
  get() {
    return Math.floor(this.x)
  },
})
Object.defineProperty(AlignmentPattern.prototype, 'Y', {
  get() {
    return Math.floor(this.y)
  },
})
AlignmentPattern.prototype.incrementCount = function () {
  this.count++
}
AlignmentPattern.prototype.aboutEquals = function (moduleSize, i, j) {
  if (Math.abs(i - this.y) <= moduleSize && Math.abs(j - this.x) <= moduleSize) {
    const moduleSizeDiff = Math.abs(moduleSize - this.estimatedModuleSize)
    return moduleSizeDiff <= 1.0 || moduleSizeDiff / this.estimatedModuleSize <= 1.0
  }
  return false
}
export function AlignmentPatternFinder(image, startX, startY, width, height, moduleSize, resultPointCallback) {
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
AlignmentPatternFinder.prototype.centerFromEnd = function (stateCount, end) {
  return (end - stateCount[2]) - stateCount[1] / 2.0
}
AlignmentPatternFinder.prototype.foundPatternCross = function (stateCount) {
  const moduleSize = this.moduleSize
  const maxVariance = moduleSize / 2.0
  for (let i = 0; i < 3; i++) {
    if (Math.abs(moduleSize - stateCount[i]) >= maxVariance) {
      return false
    }
  }
  return true
}
AlignmentPatternFinder.prototype.crossCheckVertical = function (startI, centerJ, maxCount, originalStateCountTotal) {
  const image = this.image
  const maxI = image.height
  const stateCount = this.crossCheckStateCount
  stateCount[0] = 0
  stateCount[1] = 0
  stateCount[2] = 0
  let i = startI
  while (i >= 0 && image.data[centerJ + i * image.width] && stateCount[1] <= maxCount) {
    stateCount[1]++
    i--
  }
  if (i < 0 || stateCount[1] > maxCount) {
    return Number.NaN
  }
  while (i >= 0 && !image.data[centerJ + i * image.width] && stateCount[0] <= maxCount) {
    stateCount[0]++
    i--
  }
  if (stateCount[0] > maxCount) {
    return Number.NaN
  }
  i = startI + 1
  while (i < maxI && image.data[centerJ + i * image.width] && stateCount[1] <= maxCount) {
    stateCount[1]++
    i++
  }
  if (i == maxI || stateCount[1] > maxCount) {
    return Number.NaN
  }
  while (i < maxI && !image.data[centerJ + i * image.width] && stateCount[2] <= maxCount) {
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
AlignmentPatternFinder.prototype.handlePossibleCenter = function (stateCount, i, j) {
  const stateCountTotal = stateCount[0] + stateCount[1] + stateCount[2]
  const centerJ = this.centerFromEnd(stateCount, j)
  const centerI = this.crossCheckVertical(i, Math.floor(centerJ), 2 * stateCount[1], stateCountTotal)
  if (!isNaN(centerI)) {
    const estimatedModuleSize = (stateCount[0] + stateCount[1] + stateCount[2]) / 3.0
    const max = this.possibleCenters.length
    for (let index = 0; index < max; index++) {
      const center = this.possibleCenters[index]
      if (center.aboutEquals(estimatedModuleSize, centerI, centerJ)) {
        return new AlignmentPattern(centerJ, centerI, estimatedModuleSize)
      }
    }
    const point = new AlignmentPattern(centerJ, centerI, estimatedModuleSize)
    this.possibleCenters.push(point)
    if (this.resultPointCallback != null) {
      this.resultPointCallback.foundPossibleResultPoint(point)
    }
  }
  return null
}
AlignmentPatternFinder.prototype.find = function () {
  const image = this.image
  const startX = this.startX
  const height = this.height
  const maxJ = startX + this.width
  const middleI = this.startY + (height >> 1)
  const stateCount = [0, 0, 0]
  for (let iGen = 0; iGen < height; iGen++) {
    const i = middleI + ((iGen & 0x01) == 0 ? ((iGen + 1) >> 1) : -((iGen + 1) >> 1))
    stateCount[0] = 0
    stateCount[1] = 0
    stateCount[2] = 0
    let j = startX
    while (j < maxJ && !image.data[j + image.width * i]) {
      j++
    }
    let currentState = 0
    while (j < maxJ) {
      if (image.data[j + i * image.width]) {
        if (currentState == 1) {
          stateCount[currentState]++
        }
        else {
          if (currentState == 2) {
            if (this.foundPatternCross(stateCount)) {
              var confirmed = this.handlePossibleCenter(stateCount, i, j)
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
      }
      else {
        if (currentState == 1) {
          currentState++
        }
        stateCount[currentState]++
      }
      j++
    }
    if (this.foundPatternCross(stateCount)) {
      var confirmed = this.handlePossibleCenter(stateCount, i, maxJ)
      if (confirmed != null) {
        return confirmed
      }
    }
  }
  if (!(this.possibleCenters.length == 0)) {
    return this.possibleCenters[0]
  }
  throw 'Couldn\'t find enough alignment patterns'
}
