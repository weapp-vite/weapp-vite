import type { HeadlessBrowser } from '@remotion/renderer'
import type { VideoConfig } from 'remotion'
import type { Film } from './paths'
import { Buffer } from 'node:buffer'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { renderStill } from '@remotion/renderer'
import sharp from 'sharp'
import { outputDir, sceneLabels } from './paths'

interface Still {
  frame: number
  label: string
  path: string
}

function labelImage(label: string, width: number) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="44"><rect width="100%" height="100%" fill="#111813"/><text x="16" y="28" fill="#dbe6dd" font-family="sans-serif" font-size="16">${label}</text></svg>`)
}

async function contactSheet(stills: Still[], target: string, portrait: boolean, columns: number) {
  const width = portrait ? 360 : 640
  const height = portrait ? 640 : 360
  const rowHeight = height + 44
  const layers = await Promise.all(stills.map(async (still, index) => {
    const left = (index % columns) * width
    const top = Math.floor(index / columns) * rowHeight
    const frame = await sharp(still.path).resize(width, height).toBuffer()
    return [
      { input: frame, left, top },
      { input: labelImage(still.label, width), left, top: top + height },
    ]
  }))
  await sharp({
    create: {
      width: columns * width,
      height: Math.ceil(stills.length / columns) * rowHeight,
      channels: 3,
      background: '#111813',
    },
  }).composite(layers.flat()).png().toFile(target)
}

export async function renderFilmStills(film: Film, serveUrl: string, composition: VideoConfig, browser: HeadlessBrowser) {
  const folder = path.join(outputDir, 'frames', film.name)
  await mkdir(folder, { recursive: true })
  const middleFrames = film.cuts.slice(0, -1).map((start, index) =>
    Math.floor((start + film.cuts[index + 1]!) * 30),
  )
  const cutFrames = film.cuts.slice(1, -1).flatMap(cut => [cut * 60 - 1, cut * 60, cut * 60 + 1])
  const lastFrame = film.seconds * 60 - 1
  const frames = [...new Set([0, ...middleFrames, ...cutFrames, lastFrame])].sort((a, b) => a - b)
  const stills: Still[] = []
  for (const frame of frames) {
    const target = path.join(folder, `${String(frame).padStart(4, '0')}.png`)
    await renderStill({
      composition,
      serveUrl,
      frame,
      output: target,
      imageFormat: 'png',
      puppeteerInstance: browser,
      logLevel: 'error',
    })
    stills.push({ frame, label: `${film.name} / ${(frame / 60).toFixed(2)}s / frame ${frame}`, path: target })
  }
  const storyboard = middleFrames.map((frame, index) => ({
    ...stills.find(still => still.frame === frame)!,
    label: `${String(index + 1).padStart(2, '0')} / ${sceneLabels[index]} / ${(frame / 60).toFixed(1)}s`,
  }))
  await contactSheet(storyboard, path.join(outputDir, `storyboard-${film.name}.png`), film.name === 'portrait', film.name === 'portrait' ? 3 : 2)
  await contactSheet(stills, path.join(outputDir, `transitions-${film.name}.png`), film.name === 'portrait', 4)
  await sharp(stills.find(still => still.frame === lastFrame)!.path)
    .png()
    .toFile(path.join(outputDir, `cover-${film.name}.png`))
  await writeFile(path.join(folder, 'index.json'), `${JSON.stringify(stills.map(still => ({
    frame: still.frame,
    seconds: still.frame / 60,
    label: still.label,
    file: path.basename(still.path),
  })), null, 2)}\n`)
  console.log(`${film.id}: ${frames.length} frames, cover, storyboard and transition sheet rendered`)
}
