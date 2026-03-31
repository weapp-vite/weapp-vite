/**
 * @file 二维码解析内部模块：detector。
 */
import AlignmentPattern, { AlignmentPatternFinder } from './alignpat'
import { FinderPattern, FinderPatternFinder, FinderPatternInfo } from './findpat'
import GridSampler from './grid'
import Version from '../parse/version'
import type BitMatrix from '../parse/bitmat'

interface BinaryImage {
  width: number
  height: number
  data: ArrayLike<boolean | number>
}

class PerspectiveTransform {
  static quadrilateralToQuadrilateral(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x0p: number, y0p: number, x1p: number, y1p: number, x2p: number, y2p: number, x3p: number, y3p: number) {
    const qToS = PerspectiveTransform.quadrilateralToSquare(x0, y0, x1, y1, x2, y2, x3, y3)
    const sToQ = PerspectiveTransform.squareToQuadrilateral(x0p, y0p, x1p, y1p, x2p, y2p, x3p, y3p)
    return sToQ.times(qToS)
  }

  static squareToQuadrilateral(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    const dy2 = y3 - y2
    const dy3 = y0 - y1 + y2 - y3
    if (dy2 === 0 && dy3 === 0) {
      return new PerspectiveTransform(x1 - x0, x2 - x1, x0, y1 - y0, y2 - y1, y0, 0, 0, 1)
    }
    const dx1 = x1 - x2
    const dx2 = x3 - x2
    const dx3 = x0 - x1 + x2 - x3
    const dy1 = y1 - y2
    const denominator = dx1 * dy2 - dx2 * dy1
    const a13 = (dx3 * dy2 - dx2 * dy3) / denominator
    const a23 = (dx1 * dy3 - dx3 * dy1) / denominator
    return new PerspectiveTransform(x1 - x0 + a13 * x1, x3 - x0 + a23 * x3, x0, y1 - y0 + a13 * y1, y3 - y0 + a23 * y3, y0, a13, a23, 1)
  }

  static quadrilateralToSquare(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    return PerspectiveTransform.squareToQuadrilateral(x0, y0, x1, y1, x2, y2, x3, y3).buildAdjoint()
  }

  a11: number
  a12: number
  a13: number
  a21: number
  a22: number
  a23: number
  a31: number
  a32: number
  a33: number

  constructor(a11: number, a21: number, a31: number, a12: number, a22: number, a32: number, a13: number, a23: number, a33: number) {
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

  transformPoints1(points: number[]) {
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i]
      const y = points[i + 1]
      const denominator = this.a13 * x + this.a23 * y + this.a33
      points[i] = (this.a11 * x + this.a21 * y + this.a31) / denominator
      points[i + 1] = (this.a12 * x + this.a22 * y + this.a32) / denominator
    }
  }

  transformPoints2(xValues: number[], yValues: number[]) {
    for (let i = 0; i < xValues.length; i++) {
      const x = xValues[i]
      const y = yValues[i]
      const denominator = this.a13 * x + this.a23 * y + this.a33
      xValues[i] = (this.a11 * x + this.a21 * y + this.a31) / denominator
      yValues[i] = (this.a12 * x + this.a22 * y + this.a32) / denominator
    }
  }

  buildAdjoint() {
    return new PerspectiveTransform(
      this.a22 * this.a33 - this.a23 * this.a32,
      this.a23 * this.a31 - this.a21 * this.a33,
      this.a21 * this.a32 - this.a22 * this.a31,
      this.a13 * this.a32 - this.a12 * this.a33,
      this.a11 * this.a33 - this.a13 * this.a31,
      this.a12 * this.a31 - this.a11 * this.a32,
      this.a12 * this.a23 - this.a13 * this.a22,
      this.a13 * this.a21 - this.a11 * this.a23,
      this.a11 * this.a22 - this.a12 * this.a21,
    )
  }

  times(other: PerspectiveTransform) {
    return new PerspectiveTransform(
      this.a11 * other.a11 + this.a21 * other.a12 + this.a31 * other.a13,
      this.a11 * other.a21 + this.a21 * other.a22 + this.a31 * other.a23,
      this.a11 * other.a31 + this.a21 * other.a32 + this.a31 * other.a33,
      this.a12 * other.a11 + this.a22 * other.a12 + this.a32 * other.a13,
      this.a12 * other.a21 + this.a22 * other.a22 + this.a32 * other.a23,
      this.a12 * other.a31 + this.a22 * other.a32 + this.a32 * other.a33,
      this.a13 * other.a11 + this.a23 * other.a12 + this.a33 * other.a13,
      this.a13 * other.a21 + this.a23 * other.a22 + this.a33 * other.a23,
      this.a13 * other.a31 + this.a23 * other.a32 + this.a33 * other.a33,
    )
  }
}

class DetectorResult {
  bits: BitMatrix
  points: Array<FinderPattern | AlignmentPattern>

  constructor(bits: BitMatrix, points: Array<FinderPattern | AlignmentPattern>) {
    this.bits = bits
    this.points = points
  }
}

export default class Detector {
  image: BinaryImage
  resultPointCallback: object | null

  constructor(image: BinaryImage) {
    this.image = image
    this.resultPointCallback = null
  }

  sizeOfBlackWhiteBlackRun(fromX: number, fromY: number, toX: number, toY: number) {
    const steep = Math.abs(toY - fromY) > Math.abs(toX - fromX)
    if (steep) {
      ;[fromX, fromY] = [fromY, fromX]
      ;[toX, toY] = [toY, toX]
    }
    const dx = Math.abs(toX - fromX)
    const dy = Math.abs(toY - fromY)
    let error = (-dx) >> 1
    const ystep = fromY < toY ? 1 : -1
    const xstep = fromX < toX ? 1 : -1
    let state = 0
    for (let x = fromX, y = fromY; x !== toX; x += xstep) {
      const realX = steep ? y : x
      const realY = steep ? x : y
      if (state === 1) {
        if (this.image.data[realX + realY * this.image.width]) {
          state++
        }
      }
      else if (!this.image.data[realX + realY * this.image.width]) {
        state++
      }
      if (state === 3) {
        const diffX = x - fromX
        const diffY = y - fromY
        return Math.sqrt(diffX * diffX + diffY * diffY)
      }
      error += dy
      if (error > 0) {
        if (y === toY) {
          break
        }
        y += ystep
        error -= dx
      }
    }
    const diffX2 = toX - fromX
    const diffY2 = toY - fromY
    return Math.sqrt(diffX2 * diffX2 + diffY2 * diffY2)
  }

  sizeOfBlackWhiteBlackRunBothWays(fromX: number, fromY: number, toX: number, toY: number) {
    let result = this.sizeOfBlackWhiteBlackRun(fromX, fromY, toX, toY)
    let scale = 1
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
    scale = 1
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
    return result - 1
  }

  calculateModuleSizeOneWay(pattern: FinderPattern, otherPattern: FinderPattern) {
    const moduleSizeEst1 = this.sizeOfBlackWhiteBlackRunBothWays(Math.floor(pattern.X), Math.floor(pattern.Y), Math.floor(otherPattern.X), Math.floor(otherPattern.Y))
    const moduleSizeEst2 = this.sizeOfBlackWhiteBlackRunBothWays(Math.floor(otherPattern.X), Math.floor(otherPattern.Y), Math.floor(pattern.X), Math.floor(pattern.Y))
    if (Number.isNaN(moduleSizeEst1)) {
      return moduleSizeEst2 / 7
    }
    if (Number.isNaN(moduleSizeEst2)) {
      return moduleSizeEst1 / 7
    }
    return (moduleSizeEst1 + moduleSizeEst2) / 14
  }

  calculateModuleSize(topLeft: FinderPattern, topRight: FinderPattern, bottomLeft: FinderPattern) {
    return (this.calculateModuleSizeOneWay(topLeft, topRight) + this.calculateModuleSizeOneWay(topLeft, bottomLeft)) / 2
  }

  distance(pattern1: FinderPattern, pattern2: FinderPattern) {
    const xDiff = pattern1.X - pattern2.X
    const yDiff = pattern1.Y - pattern2.Y
    return Math.sqrt(xDiff * xDiff + yDiff * yDiff)
  }

  computeDimension(topLeft: FinderPattern, topRight: FinderPattern, bottomLeft: FinderPattern, moduleSize: number) {
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
        throw new Error('Error')
    }
    return dimension
  }

  findAlignmentInRegion(overallEstModuleSize: number, estAlignmentX: number, estAlignmentY: number, allowanceFactor: number) {
    const allowance = Math.floor(allowanceFactor * overallEstModuleSize)
    const alignmentAreaLeftX = Math.max(0, estAlignmentX - allowance)
    const alignmentAreaRightX = Math.min(this.image.width - 1, estAlignmentX + allowance)
    if (alignmentAreaRightX - alignmentAreaLeftX < overallEstModuleSize * 3) {
      throw new Error('Error')
    }
    const alignmentAreaTopY = Math.max(0, estAlignmentY - allowance)
    const alignmentAreaBottomY = Math.min(this.image.height - 1, estAlignmentY + allowance)
    const alignmentFinder = new AlignmentPatternFinder(
      this.image,
      alignmentAreaLeftX,
      alignmentAreaTopY,
      alignmentAreaRightX - alignmentAreaLeftX,
      alignmentAreaBottomY - alignmentAreaTopY,
      overallEstModuleSize,
      this.resultPointCallback,
    )
    return alignmentFinder.find()
  }

  createTransform(topLeft: FinderPattern, topRight: FinderPattern, bottomLeft: FinderPattern, alignmentPattern: AlignmentPattern | null, dimension: number) {
    const dimMinusThree = dimension - 3.5
    let bottomRightX: number
    let bottomRightY: number
    let sourceBottomRightX: number
    let sourceBottomRightY: number
    if (alignmentPattern != null) {
      bottomRightX = alignmentPattern.X
      bottomRightY = alignmentPattern.Y
      sourceBottomRightX = dimMinusThree - 3
      sourceBottomRightY = dimMinusThree - 3
    }
    else {
      bottomRightX = (topRight.X - topLeft.X) + bottomLeft.X
      bottomRightY = (topRight.Y - topLeft.Y) + bottomLeft.Y
      sourceBottomRightX = dimMinusThree
      sourceBottomRightY = dimMinusThree
    }
    return PerspectiveTransform.quadrilateralToQuadrilateral(
      3.5,
      3.5,
      dimMinusThree,
      3.5,
      sourceBottomRightX,
      sourceBottomRightY,
      3.5,
      dimMinusThree,
      topLeft.X,
      topLeft.Y,
      topRight.X,
      topRight.Y,
      bottomRightX,
      bottomRightY,
      bottomLeft.X,
      bottomLeft.Y,
    )
  }

  sampleGrid(image: BinaryImage, transform: PerspectiveTransform, dimension: number) {
    return GridSampler.sampleGrid3(image, dimension, transform)
  }

  processFinderPatternInfo(info: FinderPatternInfo) {
    const topLeft = info.topLeft
    const topRight = info.topRight
    const bottomLeft = info.bottomLeft
    const moduleSize = this.calculateModuleSize(topLeft, topRight, bottomLeft)
    if (moduleSize < 1) {
      throw new Error('Error')
    }
    const dimension = this.computeDimension(topLeft, topRight, bottomLeft, moduleSize)
    const provisionalVersion = Version.getProvisionalVersionForDimension(dimension)
    const modulesBetweenFPCenters = provisionalVersion.DimensionForVersion - 7
    let alignmentPattern: AlignmentPattern | null = null
    if (provisionalVersion.alignmentPatternCenters.length > 0) {
      const bottomRightX = topRight.X - topLeft.X + bottomLeft.X
      const bottomRightY = topRight.Y - topLeft.Y + bottomLeft.Y
      const correctionToTopLeft = 1 - 3 / modulesBetweenFPCenters
      const estAlignmentX = Math.floor(topLeft.X + correctionToTopLeft * (bottomRightX - topLeft.X))
      const estAlignmentY = Math.floor(topLeft.Y + correctionToTopLeft * (bottomRightY - topLeft.Y))
      for (let i = 4; i <= 16; i <<= 1) {
        alignmentPattern = this.findAlignmentInRegion(moduleSize, estAlignmentX, estAlignmentY, i)
        break
      }
    }
    const transform = this.createTransform(topLeft, topRight, bottomLeft, alignmentPattern, dimension)
    const bits = this.sampleGrid(this.image, transform, dimension)
    const points = alignmentPattern == null
      ? [bottomLeft, topLeft, topRight]
      : [bottomLeft, topLeft, topRight, alignmentPattern]
    return new DetectorResult(bits, points)
  }

  detect() {
    const info = new FinderPatternFinder().findFinderPattern(this.image)
    return this.processFinderPatternInfo(info)
  }
}
