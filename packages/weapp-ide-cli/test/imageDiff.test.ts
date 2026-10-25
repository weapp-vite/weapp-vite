import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { PNG } from 'pngjs'
import { afterEach, describe, expect, it } from 'vitest'
import { comparePngWithBaseline } from '../src/cli/imageDiff'

function createPngBuffer(color: [number, number, number, number], width = 2, height = 2) {
  const png = new PNG({ width, height })
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = color[0]
    png.data[index + 1] = color[1]
    png.data[index + 2] = color[2]
    png.data[index + 3] = color[3]
  }
  return PNG.sync.write(png)
}

describe('comparePngWithBaseline', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.map(dir => fs.rm(dir, { recursive: true, force: true })))
    tempDirs.length = 0
  })

  it('returns zero diff for identical images', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-ide-cli-image-diff-'))
    tempDirs.push(dir)
    const baselinePath = path.join(dir, 'baseline.png')
    const buffer = createPngBuffer([255, 0, 0, 255])
    await fs.writeFile(baselinePath, buffer)

    const result = await comparePngWithBaseline({
      baselinePath,
      currentPngBuffer: buffer,
      threshold: 0.1,
    })

    expect(result.diffPixels).toBe(0)
    expect(result.diffRatio).toBe(0)
    expect(result.width).toBe(2)
    expect(result.height).toBe(2)
  })

  it('writes current and diff images when output paths are provided', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-ide-cli-image-diff-'))
    tempDirs.push(dir)
    const baselinePath = path.join(dir, 'baseline.png')
    const currentPath = path.join(dir, 'current.png')
    const diffPath = path.join(dir, 'diff.png')
    await fs.writeFile(baselinePath, createPngBuffer([255, 0, 0, 255]))

    const result = await comparePngWithBaseline({
      baselinePath,
      currentPngBuffer: createPngBuffer([0, 255, 0, 255]),
      currentOutputPath: currentPath,
      diffOutputPath: diffPath,
      threshold: 0.1,
    })

    expect(result.diffPixels).toBeGreaterThan(0)
    await expect(fs.readFile(currentPath)).resolves.toBeInstanceOf(Buffer)
    await expect(fs.readFile(diffPath)).resolves.toBeInstanceOf(Buffer)
  })

  it.each([
    { name: 'luminance', baseline: [80, 80, 80, 255], current: [180, 180, 180, 255], threshold: 0.1, pixels: 4 },
    { name: 'chromatic difference', baseline: [255, 0, 0, 255], current: [0, 255, 0, 255], threshold: 0.1, pixels: 4 },
    { name: 'perceptual blue luminance', baseline: [0, 0, 255, 255], current: [0, 0, 180, 255], threshold: 0.1, pixels: 4 },
    { name: 'hidden transparent color', baseline: [255, 0, 0, 0], current: [0, 255, 0, 0], threshold: 0.1, pixels: 0 },
    { name: 'alpha difference', baseline: [0, 0, 0, 0], current: [0, 0, 0, 255], threshold: 0.1, pixels: 4 },
    { name: 'zero threshold', baseline: [100, 100, 100, 255], current: [110, 110, 110, 255], threshold: 0, pixels: 4 },
    { name: 'maximum threshold', baseline: [100, 100, 100, 255], current: [110, 110, 110, 255], threshold: 1, pixels: 0 },
  ])('compares $name with the perceptual algorithm', async ({ baseline, current, threshold, pixels }) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-ide-cli-perceptual-diff-'))
    tempDirs.push(dir)
    const baselinePath = path.join(dir, 'baseline.png')
    await fs.writeFile(baselinePath, createPngBuffer(baseline as [number, number, number, number]))

    const result = await comparePngWithBaseline({
      baselinePath,
      currentPngBuffer: createPngBuffer(current as [number, number, number, number]),
      threshold,
    })

    expect(result.diffPixels).toBe(pixels)
    expect(result.diffRatio).toBe(pixels / 4)
  })

  it('marks anti-aliased edges without counting them as visual differences', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-ide-cli-antialias-diff-'))
    tempDirs.push(dir)
    const baselinePath = path.join(dir, 'baseline.png')
    const diffPath = path.join(dir, 'diff.png')
    const edge = (level: number) => {
      const png = new PNG({ width: 5, height: 5 })
      for (let index = 0; index < 25; index++) {
        const value = index % 5 < 2 ? 0 : index % 5 === 2 ? level : 255
        png.data.set([value, value, value, 255], index * 4)
      }
      return PNG.sync.write(png)
    }
    await fs.writeFile(baselinePath, edge(40))

    const result = await comparePngWithBaseline({
      baselinePath,
      currentPngBuffer: edge(180),
      diffOutputPath: diffPath,
      threshold: 0.1,
    })

    expect(result.diffPixels).toBe(0)
    expect(result.diffRatio).toBe(0)
    const diff = PNG.sync.read(await fs.readFile(diffPath))
    for (let row = 0; row < 5; row++) {
      expect([...diff.data.subarray((row * 5 + 2) * 4, (row * 5 + 3) * 4)]).toEqual([255, 255, 0, 255])
    }
  })

  it('throws when baseline file does not exist', async () => {
    await expect(comparePngWithBaseline({
      baselinePath: '/missing/baseline.png',
      currentPngBuffer: createPngBuffer([255, 0, 0, 255]),
      threshold: 0.1,
    })).rejects.toThrow('基准图')
  })

  it('throws when baseline is not a valid png', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-ide-cli-image-diff-'))
    tempDirs.push(dir)
    const baselinePath = path.join(dir, 'baseline.txt')
    await fs.writeFile(baselinePath, 'not-a-png')

    await expect(comparePngWithBaseline({
      baselinePath,
      currentPngBuffer: createPngBuffer([255, 0, 0, 255]),
      threshold: 0.1,
    })).rejects.toThrow('PNG')
  })

  it('throws when image dimensions do not match', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-ide-cli-image-diff-'))
    tempDirs.push(dir)
    const baselinePath = path.join(dir, 'baseline.png')
    await fs.writeFile(baselinePath, createPngBuffer([255, 0, 0, 255], 2, 2))

    await expect(comparePngWithBaseline({
      baselinePath,
      currentPngBuffer: createPngBuffer([255, 0, 0, 255], 1, 1),
      threshold: 0.1,
    })).rejects.toThrow('尺寸')
  })
})
