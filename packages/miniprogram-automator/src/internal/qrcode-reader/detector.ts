// @ts-nocheck
import { AlignmentPatternFinder } from './alignpat'
import { FinderPatternFinder } from './findpat'
import GridSampler from './grid'
/**
 * @file 二维码解析内部模块：detector。
 */
import Version from './version'

function PerspectiveTransform(a11, a21, a31, a12, a22, a32, a13, a23, a33) {
  this.a11 = a11
  this.a12 = a12
  this.a13 = a13
  this.a21 = a21
  this.a22 = a22
  this.a23 = a23
  this.a31 = a31
  this.a32 = a32
  this.a33 = a33
}
PerspectiveTransform.prototype.transformPoints1 = function (points) {
  const max = points.length
  const a11 = this.a11
  const a12 = this.a12
  const a13 = this.a13
  const a21 = this.a21
  const a22 = this.a22
  const a23 = this.a23
  const a31 = this.a31
  const a32 = this.a32
  const a33 = this.a33
  for (let i = 0; i < max; i += 2) {
    const x = points[i]
    const y = points[i + 1]
    const denominator = a13 * x + a23 * y + a33
    points[i] = (a11 * x + a21 * y + a31) / denominator
    points[i + 1] = (a12 * x + a22 * y + a32) / denominator
  }
}
PerspectiveTransform.prototype.transformPoints2 = function (xValues, yValues) {
  const n = xValues.length
  for (let i = 0; i < n; i++) {
    const x = xValues[i]
    const y = yValues[i]
    const denominator = this.a13 * x + this.a23 * y + this.a33
    xValues[i] = (this.a11 * x + this.a21 * y + this.a31) / denominator
    yValues[i] = (this.a12 * x + this.a22 * y + this.a32) / denominator
  }
}
PerspectiveTransform.prototype.buildAdjoint = function () {
  return new PerspectiveTransform(this.a22 * this.a33 - this.a23 * this.a32, this.a23 * this.a31 - this.a21 * this.a33, this.a21 * this.a32 - this.a22 * this.a31, this.a13 * this.a32 - this.a12 * this.a33, this.a11 * this.a33 - this.a13 * this.a31, this.a12 * this.a31 - this.a11 * this.a32, this.a12 * this.a23 - this.a13 * this.a22, this.a13 * this.a21 - this.a11 * this.a23, this.a11 * this.a22 - this.a12 * this.a21)
}
PerspectiveTransform.prototype.times = function (other) {
  return new PerspectiveTransform(this.a11 * other.a11 + this.a21 * other.a12 + this.a31 * other.a13, this.a11 * other.a21 + this.a21 * other.a22 + this.a31 * other.a23, this.a11 * other.a31 + this.a21 * other.a32 + this.a31 * other.a33, this.a12 * other.a11 + this.a22 * other.a12 + this.a32 * other.a13, this.a12 * other.a21 + this.a22 * other.a22 + this.a32 * other.a23, this.a12 * other.a31 + this.a22 * other.a32 + this.a32 * other.a33, this.a13 * other.a11 + this.a23 * other.a12 + this.a33 * other.a13, this.a13 * other.a21 + this.a23 * other.a22 + this.a33 * other.a23, this.a13 * other.a31 + this.a23 * other.a32 + this.a33 * other.a33)
}
PerspectiveTransform.quadrilateralToQuadrilateral = function (x0, y0, x1, y1, x2, y2, x3, y3, x0p, y0p, x1p, y1p, x2p, y2p, x3p, y3p) {
  const qToS = this.quadrilateralToSquare(x0, y0, x1, y1, x2, y2, x3, y3)
  const sToQ = this.squareToQuadrilateral(x0p, y0p, x1p, y1p, x2p, y2p, x3p, y3p)
  return sToQ.times(qToS)
}
PerspectiveTransform.squareToQuadrilateral = function (x0, y0, x1, y1, x2, y2, x3, y3) {
  const dy2 = y3 - y2
  const dy3 = y0 - y1 + y2 - y3
  if (dy2 == 0.0 && dy3 == 0.0) {
    return new PerspectiveTransform(x1 - x0, x2 - x1, x0, y1 - y0, y2 - y1, y0, 0.0, 0.0, 1.0)
  }
  else {
    const dx1 = x1 - x2
    const dx2 = x3 - x2
    const dx3 = x0 - x1 + x2 - x3
    const dy1 = y1 - y2
    const denominator = dx1 * dy2 - dx2 * dy1
    const a13 = (dx3 * dy2 - dx2 * dy3) / denominator
    const a23 = (dx1 * dy3 - dx3 * dy1) / denominator
    return new PerspectiveTransform(x1 - x0 + a13 * x1, x3 - x0 + a23 * x3, x0, y1 - y0 + a13 * y1, y3 - y0 + a23 * y3, y0, a13, a23, 1.0)
  }
}
PerspectiveTransform.quadrilateralToSquare = function (x0, y0, x1, y1, x2, y2, x3, y3) {
  return this.squareToQuadrilateral(x0, y0, x1, y1, x2, y2, x3, y3).buildAdjoint()
}
function DetectorResult(bits, points) {
  this.bits = bits
  this.points = points
}
export default function Detector(image) {
  this.image = image
  this.resultPointCallback = null
}
Detector.prototype.sizeOfBlackWhiteBlackRun = function (fromX, fromY, toX, toY) {
  const steep = Math.abs(toY - fromY) > Math.abs(toX - fromX)
  if (steep) {
    let temp = fromX
    fromX = fromY
    fromY = temp
    temp = toX
    toX = toY
    toY = temp
  }
  const dx = Math.abs(toX - fromX)
  const dy = Math.abs(toY - fromY)
  let error = -dx >> 1
  const ystep = fromY < toY ? 1 : -1
  const xstep = fromX < toX ? 1 : -1
  let state = 0
  for (let x = fromX, y = fromY; x != toX; x += xstep) {
    const realX = steep ? y : x
    const realY = steep ? x : y
    if (state == 1) {
      if (this.image.data[realX + realY * this.image.width]) {
        state++
      }
    }
    else {
      if (!this.image.data[realX + realY * this.image.width]) {
        state++
      }
    }
    if (state == 3) {
      const diffX = x - fromX
      const diffY = y - fromY
      return Math.sqrt((diffX * diffX + diffY * diffY))
    }
    error += dy
    if (error > 0) {
      if (y == toY) {
        break
      }
      y += ystep
      error -= dx
    }
  }
  const diffX2 = toX - fromX
  const diffY2 = toY - fromY
  return Math.sqrt((diffX2 * diffX2 + diffY2 * diffY2))
}
Detector.prototype.sizeOfBlackWhiteBlackRunBothWays = function (fromX, fromY, toX, toY) {
  let result = this.sizeOfBlackWhiteBlackRun(fromX, fromY, toX, toY)
  let scale = 1.0
  let otherToX = fromX - (toX - fromX)
  if (otherToX < 0) {
    scale = fromX / (fromX - otherToX)
    otherToX = 0
  }
  else if (otherToX >= this.image.width) {
    scale = (this.image.width - 1 - fromX) / (otherToX - fromX)
    otherToX = this.image.width - 1
  }
  let otherToY = Math.floor(fromY - (toY - fromY) * scale)
  scale = 1.0
  if (otherToY < 0) {
    scale = fromY / (fromY - otherToY)
    otherToY = 0
  }
  else if (otherToY >= this.image.height) {
    scale = (this.image.height - 1 - fromY) / (otherToY - fromY)
    otherToY = this.image.height - 1
  }
  otherToX = Math.floor(fromX + (otherToX - fromX) * scale)
  result += this.sizeOfBlackWhiteBlackRun(fromX, fromY, otherToX, otherToY)
  return result - 1.0
}
Detector.prototype.calculateModuleSizeOneWay = function (pattern, otherPattern) {
  const moduleSizeEst1 = this.sizeOfBlackWhiteBlackRunBothWays(Math.floor(pattern.X), Math.floor(pattern.Y), Math.floor(otherPattern.X), Math.floor(otherPattern.Y))
  const moduleSizeEst2 = this.sizeOfBlackWhiteBlackRunBothWays(Math.floor(otherPattern.X), Math.floor(otherPattern.Y), Math.floor(pattern.X), Math.floor(pattern.Y))
  if (isNaN(moduleSizeEst1)) {
    return moduleSizeEst2 / 7.0
  }
  if (isNaN(moduleSizeEst2)) {
    return moduleSizeEst1 / 7.0
  }
  return (moduleSizeEst1 + moduleSizeEst2) / 14.0
}
Detector.prototype.calculateModuleSize = function (topLeft, topRight, bottomLeft) {
  return (this.calculateModuleSizeOneWay(topLeft, topRight) + this.calculateModuleSizeOneWay(topLeft, bottomLeft)) / 2.0
}
Detector.prototype.distance = function (pattern1, pattern2) {
  const xDiff = pattern1.X - pattern2.X
  const yDiff = pattern1.Y - pattern2.Y
  return Math.sqrt((xDiff * xDiff + yDiff * yDiff))
}
Detector.prototype.computeDimension = function (topLeft, topRight, bottomLeft, moduleSize) {
  const tltrCentersDimension = Math.round(this.distance(topLeft, topRight) / moduleSize)
  const tlblCentersDimension = Math.round(this.distance(topLeft, bottomLeft) / moduleSize)
  let dimension = ((tltrCentersDimension + tlblCentersDimension) >> 1) + 7
  switch (dimension & 0x03) {
    case 0:
      dimension++
      break
    case 2:
      dimension--
      break
    case 3:
      throw 'Error'
  }
  return dimension
}
Detector.prototype.findAlignmentInRegion = function (overallEstModuleSize, estAlignmentX, estAlignmentY, allowanceFactor) {
  const allowance = Math.floor(allowanceFactor * overallEstModuleSize)
  const alignmentAreaLeftX = Math.max(0, estAlignmentX - allowance)
  const alignmentAreaRightX = Math.min(this.image.width - 1, estAlignmentX + allowance)
  if (alignmentAreaRightX - alignmentAreaLeftX < overallEstModuleSize * 3) {
    throw 'Error'
  }
  const alignmentAreaTopY = Math.max(0, estAlignmentY - allowance)
  const alignmentAreaBottomY = Math.min(this.image.height - 1, estAlignmentY + allowance)
  const alignmentFinder = new AlignmentPatternFinder(this.image, alignmentAreaLeftX, alignmentAreaTopY, alignmentAreaRightX - alignmentAreaLeftX, alignmentAreaBottomY - alignmentAreaTopY, overallEstModuleSize, this.resultPointCallback)
  return alignmentFinder.find()
}
Detector.prototype.createTransform = function (topLeft, topRight, bottomLeft, alignmentPattern, dimension) {
  const dimMinusThree = dimension - 3.5
  let bottomRightX
  let bottomRightY
  let sourceBottomRightX
  let sourceBottomRightY
  if (alignmentPattern != null) {
    bottomRightX = alignmentPattern.X
    bottomRightY = alignmentPattern.Y
    sourceBottomRightX = sourceBottomRightY = dimMinusThree - 3.0
  }
  else {
    bottomRightX = (topRight.X - topLeft.X) + bottomLeft.X
    bottomRightY = (topRight.Y - topLeft.Y) + bottomLeft.Y
    sourceBottomRightX = sourceBottomRightY = dimMinusThree
  }
  const transform = PerspectiveTransform.quadrilateralToQuadrilateral(3.5, 3.5, dimMinusThree, 3.5, sourceBottomRightX, sourceBottomRightY, 3.5, dimMinusThree, topLeft.X, topLeft.Y, topRight.X, topRight.Y, bottomRightX, bottomRightY, bottomLeft.X, bottomLeft.Y)
  return transform
}
Detector.prototype.sampleGrid = function (image, transform, dimension) {
  const sampler = GridSampler
  return sampler.sampleGrid3(image, dimension, transform)
}
Detector.prototype.processFinderPatternInfo = function (info) {
  const topLeft = info.topLeft
  const topRight = info.topRight
  const bottomLeft = info.bottomLeft
  const moduleSize = this.calculateModuleSize(topLeft, topRight, bottomLeft)
  if (moduleSize < 1.0) {
    throw 'Error'
  }
  const dimension = this.computeDimension(topLeft, topRight, bottomLeft, moduleSize)
  const provisionalVersion = Version.getProvisionalVersionForDimension(dimension)
  const modulesBetweenFPCenters = provisionalVersion.DimensionForVersion - 7
  let alignmentPattern = null
  if (provisionalVersion.alignmentPatternCenters.length > 0) {
    const bottomRightX = topRight.X - topLeft.X + bottomLeft.X
    const bottomRightY = topRight.Y - topLeft.Y + bottomLeft.Y
    const correctionToTopLeft = 1.0 - 3.0 / modulesBetweenFPCenters
    const estAlignmentX = Math.floor(topLeft.X + correctionToTopLeft * (bottomRightX - topLeft.X))
    const estAlignmentY = Math.floor(topLeft.Y + correctionToTopLeft * (bottomRightY - topLeft.Y))
    for (let i = 4; i <= 16; i <<= 1) {
      alignmentPattern = this.findAlignmentInRegion(moduleSize, estAlignmentX, estAlignmentY, i)
      break
    }
  }
  const transform = this.createTransform(topLeft, topRight, bottomLeft, alignmentPattern, dimension)
  const bits = this.sampleGrid(this.image, transform, dimension)
  let points
  if (alignmentPattern == null) {
    points = [bottomLeft, topLeft, topRight]
  }
  else {
    points = [bottomLeft, topLeft, topRight, alignmentPattern]
  }
  return new DetectorResult(bits, points)
}
Detector.prototype.detect = function () {
  const info = new FinderPatternFinder().findFinderPattern(this.image)
  return this.processFinderPatternInfo(info)
}
