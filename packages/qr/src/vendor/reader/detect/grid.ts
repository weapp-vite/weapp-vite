// @ts-nocheck
/**
 * @file 二维码解析内部模块：grid。
 */
import BitMatrix from '../parse/bitmat'

const GridSampler = {}
GridSampler.checkAndNudgePoints = function (image, points) {
  const width = image.width
  const height = image.height
  let nudged = true
  for (var offset = 0; offset < points.length && nudged; offset += 2) {
    var x = Math.floor(points[offset])
    var y = Math.floor(points[offset + 1])
    if (x < -1 || x > width || y < -1 || y > height) {
      throw 'Error.checkAndNudgePoints '
    }
    nudged = false
    if (x == -1) {
      points[offset] = 0.0
      nudged = true
    }
    else if (x == width) {
      points[offset] = width - 1
      nudged = true
    }
    if (y == -1) {
      points[offset + 1] = 0.0
      nudged = true
    }
    else if (y == height) {
      points[offset + 1] = height - 1
      nudged = true
    }
  }
  nudged = true
  for (var offset = points.length - 2; offset >= 0 && nudged; offset -= 2) {
    var x = Math.floor(points[offset])
    var y = Math.floor(points[offset + 1])
    if (x < -1 || x > width || y < -1 || y > height) {
      throw 'Error.checkAndNudgePoints '
    }
    nudged = false
    if (x == -1) {
      points[offset] = 0.0
      nudged = true
    }
    else if (x == width) {
      points[offset] = width - 1
      nudged = true
    }
    if (y == -1) {
      points[offset + 1] = 0.0
      nudged = true
    }
    else if (y == height) {
      points[offset + 1] = height - 1
      nudged = true
    }
  }
}
GridSampler.sampleGrid3 = function (image, dimension, transform) {
  const bits = new BitMatrix(dimension)
  const points = Array.from({ length: dimension << 1 })
  for (let y = 0; y < dimension; y++) {
    const max = points.length
    const iValue = y + 0.5
    for (var x = 0; x < max; x += 2) {
      points[x] = (x >> 1) + 0.5
      points[x + 1] = iValue
    }
    transform.transformPoints1(points)
    GridSampler.checkAndNudgePoints(image, points)
    try {
      for (var x = 0; x < max; x += 2) {
        const bit = image.data[Math.floor(points[x]) + image.width * Math.floor(points[x + 1])]
        if (bit) { bits.set_Renamed(x >> 1, y) }
      }
    }
    catch (aioobe) {
      throw 'Error.checkAndNudgePoints'
    }
  }
  return bits
}
export default GridSampler
