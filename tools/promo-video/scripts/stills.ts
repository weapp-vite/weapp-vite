import type { HeadlessBrowser } from '@remotion/renderer'
import type { VideoConfig } from 'remotion'
import type { Film } from './paths'
import { Buffer } from 'node:buffer'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { renderStill } from '@remotion/renderer'
import sharp from 'sharp'
import { fps } from '../src/timeline'
import { outputDir } from './paths'

interface Still {
  frame: number
  shotId: string
  label: string
  path: string
}

function labelImage(label: string, width: number) {
  const escaped = label.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="44"><rect width="100%" height="100%" fill="#111813"/><text x="16" y="28" fill="#dbe6dd" font-family="sans-serif" font-size="14">${escaped}</text></svg>`)
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
  await rm(folder, { recursive: true, force: true })
  await mkdir(folder, { recursive: true })
  const middleFrames = film.shots.map(shot => shot.startFrame + Math.floor(shot.frames / 2))
  const cues = film.shots.flatMap(shot => shot.cues.map((cue, index) => ({
    frame: Math.min(shot.endFrame - 1, shot.startFrame + cue + 70),
    label: `${shot.label} / cue ${index + 1}`,
  })))
  const cutFrames = film.shots.slice(1).flatMap(shot => [shot.startFrame - 1, shot.startFrame, shot.startFrame + 1])
  const lastFrame = film.frames - 1
  const frames = [...new Set([0, 30, ...middleFrames, ...cues.map(cue => cue.frame), ...cutFrames, lastFrame])].sort((a, b) => a - b)
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
    const shot = film.shots.find(shot => frame >= shot.startFrame && frame < shot.endFrame)!
    stills.push({ frame, shotId: shot.id, label: `${shot.label} / ${(frame / fps).toFixed(2)}s`, path: target })
  }
  const storyboard = middleFrames.map((frame, index) => ({
    ...stills.find(still => still.frame === frame)!,
    label: `${String(index + 1).padStart(2, '0')} / ${film.shots[index]!.label} / ${(frame / fps).toFixed(1)}s`,
  }))
  const cueStills = cues.map(cue => ({ ...stills.find(still => still.frame === cue.frame)!, label: cue.label }))
  const boundaryFrames = new Set([0, 30, ...cutFrames, lastFrame])
  await contactSheet(storyboard, path.join(outputDir, `storyboard-${film.name}.png`), film.name === 'portrait', 3)
  await contactSheet(cueStills, path.join(outputDir, `cues-${film.name}.png`), film.name === 'portrait', 3)
  await contactSheet(stills.filter(still => boundaryFrames.has(still.frame)), path.join(outputDir, `transitions-${film.name}.png`), film.name === 'portrait', 4)
  await sharp(stills.find(still => still.frame === lastFrame)!.path)
    .png()
    .toFile(path.join(outputDir, `cover-${film.name}.png`))
  await writeFile(path.join(folder, 'index.json'), `${JSON.stringify(stills.map(still => ({
    frame: still.frame,
    seconds: still.frame / fps,
    shotId: still.shotId,
    label: still.label,
    file: path.basename(still.path),
  })), null, 2)}\n`)
  console.log(`${film.id}: ${frames.length} frames, cover, storyboard, cue and transition sheets rendered`)
}
