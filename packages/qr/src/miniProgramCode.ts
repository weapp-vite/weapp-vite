/**
 * @file 微信小程序码结构识别封装。
 */
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'

interface MiniProgramCodePoint {
  x: number
  y: number
}

interface MiniProgramCodeBounds {
  left: number
  top: number
  width: number
  height: number
}

interface MiniProgramCodeComponent extends MiniProgramCodeBounds {
  count: number
  center: MiniProgramCodePoint
  averageColor: [number, number, number]
}

/** MiniProgramCodeDetectionResult 的类型定义。 */
export interface MiniProgramCodeDetectionResult {
  kind: 'wechat-mini-program-code'
  width: number
  height: number
  confidence: number
  locatorPoints: readonly [MiniProgramCodePoint, MiniProgramCodePoint, MiniProgramCodePoint]
  badgeBounds?: MiniProgramCodeBounds
  logoBounds?: MiniProgramCodeBounds
}

function isForeground(r: number, g: number, b: number) {
  return ((255 - r) + (255 - g) + (255 - b)) > 80
}

function getQuadrant(point: MiniProgramCodePoint, width: number, height: number) {
  const normalizedX = point.x / width
  const normalizedY = point.y / height

  if (normalizedX < 0.35 && normalizedY < 0.35) {
    return 'top-left'
  }
  if (normalizedX > 0.65 && normalizedY < 0.35) {
    return 'top-right'
  }
  if (normalizedX < 0.35 && normalizedY > 0.65) {
    return 'bottom-left'
  }
  if (normalizedX > 0.65 && normalizedY > 0.65) {
    return 'bottom-right'
  }

  return 'other'
}

function isSquareLike(component: MiniProgramCodeComponent) {
  const ratio = component.width / component.height
  return ratio >= 0.7 && ratio <= 1.3
}

function findConnectedComponents(
  data: Buffer,
  width: number,
  height: number,
) {
  const visited = new Uint8Array(width * height)
  const components: MiniProgramCodeComponent[] = []

  function isForegroundIndex(index: number) {
    const offset = index * 4
    return isForeground(data[offset], data[offset + 1], data[offset + 2])
  }

  for (let index = 0; index < width * height; index += 1) {
    if (visited[index] || !isForegroundIndex(index)) {
      continue
    }

    const queue = [index]
    visited[index] = 1
    let cursor = 0
    let count = 0
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    let sumX = 0
    let sumY = 0
    let sumR = 0
    let sumG = 0
    let sumB = 0

    while (cursor < queue.length) {
      const current = queue[cursor]
      cursor += 1

      const x = current % width
      const y = Math.floor(current / width)
      const offset = current * 4

      count += 1
      sumX += x
      sumY += y
      sumR += data[offset]
      sumG += data[offset + 1]
      sumB += data[offset + 2]
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)

      const neighbors = [current - 1, current + 1, current - width, current + width]
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= width * height || visited[neighbor]) {
          continue
        }

        const neighborX = neighbor % width
        const neighborY = Math.floor(neighbor / width)
        if ((Math.abs(neighborX - x) + Math.abs(neighborY - y)) !== 1) {
          continue
        }

        if (!isForegroundIndex(neighbor)) {
          continue
        }

        visited[neighbor] = 1
        queue.push(neighbor)
      }
    }

    components.push({
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      count,
      center: {
        x: sumX / count,
        y: sumY / count,
      },
      averageColor: [sumR / count, sumG / count, sumB / count],
    })
  }

  return components.sort((a, b) => b.count - a.count)
}

function findLocatorPoints(components: MiniProgramCodeComponent[], width: number, height: number) {
  const minSide = Math.min(width, height)
  const candidates = components.filter((component) => {
    const normalizedSize = Math.max(component.width, component.height) / minSide
    return normalizedSize >= 0.05
      && normalizedSize <= 0.16
      && component.count >= minSide * 0.6
      && isSquareLike(component)
  })

  const topLeft = candidates.find(component => getQuadrant(component.center, width, height) === 'top-left')
  const topRight = candidates.find(component => getQuadrant(component.center, width, height) === 'top-right')
  const bottomLeft = candidates.find(component => getQuadrant(component.center, width, height) === 'bottom-left')

  if (!topLeft || !topRight || !bottomLeft) {
    return undefined
  }

  return [topLeft.center, topRight.center, bottomLeft.center] as const
}

function findBadgeBounds(components: MiniProgramCodeComponent[], width: number, height: number) {
  const minSide = Math.min(width, height)
  return components.find((component) => {
    const normalizedSize = Math.max(component.width, component.height) / minSide
    const [r, g, b] = component.averageColor
    return getQuadrant(component.center, width, height) === 'bottom-right'
      && normalizedSize >= 0.08
      && normalizedSize <= 0.24
      && isSquareLike(component)
      && g > r + 18
      && g > b + 18
  })
}

function findLogoBounds(components: MiniProgramCodeComponent[], width: number, height: number) {
  const centerX = width / 2
  const centerY = height / 2
  const limit = Math.min(width, height) * 0.22
  const nearCenter = components.filter((component) => {
    const distance = Math.hypot(component.center.x - centerX, component.center.y - centerY)
    return distance <= limit
      && component.width <= width * 0.5
      && component.height <= height * 0.5
      && component.count >= Math.min(width, height) * 0.3
  })

  if (nearCenter.length === 0) {
    return undefined
  }

  const left = Math.min(...nearCenter.map(component => component.left))
  const top = Math.min(...nearCenter.map(component => component.top))
  const right = Math.max(...nearCenter.map(component => component.left + component.width))
  const bottom = Math.max(...nearCenter.map(component => component.top + component.height))

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  }
}

function calculateAnnulusCoverage(data: Buffer, width: number, height: number) {
  const centerX = (width - 1) / 2
  const centerY = (height - 1) / 2
  const minSide = Math.min(width, height)
  const innerRadius = minSide * 0.24
  const outerRadius = minSide * 0.49
  const bins = Array.from({ length: 36 }).fill(0) as number[]

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const radius = Math.hypot(x - centerX, y - centerY)
      if (radius < innerRadius || radius > outerRadius) {
        continue
      }

      const offset = (y * width + x) * 4
      if (!isForeground(data[offset], data[offset + 1], data[offset + 2])) {
        continue
      }

      const angle = Math.atan2(y - centerY, x - centerX)
      const normalizedAngle = (angle + Math.PI) / (Math.PI * 2)
      const index = Math.min(bins.length - 1, Math.floor(normalizedAngle * bins.length))
      bins[index] += 1
    }
  }

  return bins.filter(value => value > minSide * 0.02).length / bins.length
}

/** detectMiniProgramCodeFromBuffer 的方法封装。 */
export async function detectMiniProgramCodeFromBuffer(buffer: Buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const components = findConnectedComponents(data, info.width, info.height)
  const locatorPoints = findLocatorPoints(components, info.width, info.height)
  const badge = findBadgeBounds(components, info.width, info.height)
  const logoBounds = findLogoBounds(components, info.width, info.height)
  const annulusCoverage = calculateAnnulusCoverage(data, info.width, info.height)

  if (!locatorPoints || !badge || annulusCoverage < 0.55) {
    return null
  }

  const aspectRatio = info.width / info.height
  const confidence = Math.min(0.99, 0.45
    + (Math.abs(aspectRatio - 1) <= 0.05 ? 0.1 : 0)
    + 0.15
    + 0.15
    + 0.15
    + 0.05
    + Math.min(0.09, annulusCoverage * 0.09))

  return {
    kind: 'wechat-mini-program-code',
    width: info.width,
    height: info.height,
    confidence,
    locatorPoints,
    badgeBounds: badge && {
      left: badge.left,
      top: badge.top,
      width: badge.width,
      height: badge.height,
    },
    logoBounds,
  } satisfies MiniProgramCodeDetectionResult
}

/** detectMiniProgramCodeFromBase64 的方法封装。 */
export async function detectMiniProgramCodeFromBase64(content: string) {
  return await detectMiniProgramCodeFromBuffer(Buffer.from(content, 'base64'))
}

/** detectMiniProgramCodeFromFile 的方法封装。 */
export async function detectMiniProgramCodeFromFile(filePath: string) {
  const buffer = await readFile(filePath)
  return await detectMiniProgramCodeFromBuffer(buffer)
}
