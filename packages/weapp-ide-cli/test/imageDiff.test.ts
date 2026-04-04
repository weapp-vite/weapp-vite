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
