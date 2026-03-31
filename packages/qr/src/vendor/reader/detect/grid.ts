/**
 * @file 二维码解析内部模块：grid。
 */
import BitMatrix from '../parse/bitmat'

interface BinaryImage {
  width: number
  height: number
  data: ArrayLike<boolean | number>
}

interface PerspectiveTransformLike {
  transformPoints1: (points: number[]) => void
}

const GridSampler = {
  checkAndNudgePoints(image: BinaryImage, points: number[]) {
    const width = image.width
    const height = image.height
    let nudged = true
    for (let offset = 0; offset < points.length && nudged; offset += 2) {
      const x = Math.floor(points[offset])
      const y = Math.floor(points[offset + 1])
      if (x < -1 || x > width || y < -1 || y > height) {
        throw new Error('Error.checkAndNudgePoints')
      }
      nudged = false
      if (x === -1) {
        points[offset] = 0
        nudged = true
      }
      else if (x === width) {
        points[offset] = width - 1
        nudged = true
      }
      if (y === -1) {
        points[offset + 1] = 0
        nudged = true
      }
      else if (y === height) {
        points[offset + 1] = height - 1
        nudged = true
      }
    }
    nudged = true
    for (let offset = points.length - 2; offset >= 0 && nudged; offset -= 2) {
      const x = Math.floor(points[offset])
      const y = Math.floor(points[offset + 1])
      if (x < -1 || x > width || y < -1 || y > height) {
        throw new Error('Error.checkAndNudgePoints')
      }
      nudged = false
      if (x === -1) {
        points[offset] = 0
        nudged = true
      }
      else if (x === width) {
        points[offset] = width - 1
        nudged = true
      }
      if (y === -1) {
        points[offset + 1] = 0
        nudged = true
      }
      else if (y === height) {
        points[offset + 1] = height - 1
        nudged = true
      }
    }
  },

  sampleGrid3(image: BinaryImage, dimension: number, transform: PerspectiveTransformLike) {
    const bits = new BitMatrix(dimension)
    const points = Array.from({ length: dimension << 1 }, () => 0)
    for (let y = 0; y < dimension; y++) {
      const max = points.length
      const iValue = y + 0.5
      for (let x = 0; x < max; x += 2) {
        points[x] = (x >> 1) + 0.5
        points[x + 1] = iValue
      }
      transform.transformPoints1(points)
      GridSampler.checkAndNudgePoints(image, points)
      try {
        for (let x = 0; x < max; x += 2) {
          const bit = image.data[Math.floor(points[x]) + image.width * Math.floor(points[x + 1])]
          if (bit) {
            bits.set_Renamed(x >> 1, y)
          }
        }
      }
      catch {
        throw new Error('Error.checkAndNudgePoints')
      }
    }
    return bits
  },
}

export default GridSampler
