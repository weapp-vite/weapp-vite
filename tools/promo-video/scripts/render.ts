import type { Film } from './paths'
import { availableParallelism } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { bundle } from '@remotion/bundler'
import { openBrowser, renderMedia, selectComposition } from '@remotion/renderer'
import { fps } from '../src/timeline'
import { cacheDir, entryPoint, publicDir, videoPath } from './paths'
import { prepareAssets } from './prepare'
import { renderFilmStills } from './stills'
import { validateTimeline } from './validateTimeline'

function renderConcurrency() {
  const requested = process.env.PROMO_RENDER_CONCURRENCY
  if (!requested) {
    return Math.min(6, Math.max(1, availableParallelism() - 2))
  }
  const parsed = Number(requested)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error('PROMO_RENDER_CONCURRENCY must be a positive integer')
  }
  return parsed
}

export async function renderFilms(selected: readonly Film[], stillsOnly: boolean) {
  validateTimeline()
  await prepareAssets()
  const serveUrl = await bundle({
    entryPoint,
    publicDir,
    outDir: path.join(cacheDir, 'bundle'),
    onProgress: (progress) => {
      if (progress === 100) {
        console.log('Remotion bundle ready')
      }
    },
  })
  const browser = await openBrowser('chrome', {
    browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE,
    logLevel: 'error',
  })
  try {
    for (const film of selected) {
      const composition = await selectComposition({ serveUrl, id: film.id, puppeteerInstance: browser })
      if (composition.width !== film.width || composition.height !== film.height
        || composition.fps !== fps || composition.durationInFrames !== film.frames) {
        throw new Error(`${film.id} does not match the approved delivery dimensions, fps or duration`)
      }
      if (stillsOnly) {
        await renderFilmStills(film, serveUrl, composition, browser)
        continue
      }
      let lastProgress = -1
      await renderMedia({
        composition,
        serveUrl,
        puppeteerInstance: browser,
        outputLocation: videoPath(film),
        codec: 'h264',
        crf: 18,
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '320k',
        sampleRate: 48000,
        enforceAudioTrack: true,
        colorSpace: 'bt709',
        imageFormat: 'jpeg',
        jpegQuality: 95,
        x264Preset: 'medium',
        concurrency: renderConcurrency(),
        logLevel: 'error',
        ffmpegOverride: ({ args, type }) => {
          if (type !== 'stitcher') {
            return args
          }
          const index = args.indexOf('-movflags')
          if (index >= 0) {
            const copy = [...args]
            copy[index + 1] = '+faststart'
            return copy
          }
          return [...args.slice(0, -1), '-movflags', '+faststart', args.at(-1)!]
        },
        onProgress: ({ progress }) => {
          const percentage = Math.floor(progress * 20) * 5
          if (percentage !== lastProgress) {
            lastProgress = percentage
            console.log(`${film.id}: ${percentage}%`)
          }
        },
      })
      console.log(`${film.id}: complete`)
    }
  }
  finally {
    await browser.close({ silent: true })
  }
}
