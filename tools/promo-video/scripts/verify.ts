import type { Film } from './paths'
import { Buffer } from 'node:buffer'
import { open, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { bpm, fps } from '../src/timeline'
import { films, outputDir, videoPath } from './paths'
import { runProcess } from './process'
import { validateTimeline } from './validateTimeline'

interface ProbeStream {
  codec_type: string
  codec_name: string
  width?: number
  height?: number
  pix_fmt?: string
  avg_frame_rate?: string
  sample_rate?: string
  channels?: number
  nb_frames?: string
  duration?: string
}

interface Probe {
  streams: ProbeStream[]
  format: { duration: string, size: string }
}

interface BlackInterval {
  start: number
  end: number
  duration: number
}

/** 仅读取 MP4 顶层 box，检查 moov 是否先于媒体数据。 */
async function hasFaststart(file: string) {
  const handle = await open(file, 'r')
  try {
    const { size } = await handle.stat()
    let position = 0
    let moov = -1
    let mdat = -1
    const header = Buffer.alloc(16)
    while (position + 8 <= size) {
      const { bytesRead } = await handle.read(header, 0, 16, position)
      if (bytesRead < 8) {
        break
      }
      let length = header.readUInt32BE(0)
      const name = header.toString('ascii', 4, 8)
      if (length === 1 && bytesRead >= 16) {
        length = Number(header.readBigUInt64BE(8))
      }
      if (name === 'moov') {
        moov = position
      }
      if (name === 'mdat' && mdat < 0) {
        mdat = position
      }
      if (length === 0 || length < 8) {
        break
      }
      position += length
    }
    return moov >= 0 && mdat >= 0 && moov < mdat
  }
  finally {
    await handle.close()
  }
}

function readLoudness(stderr: string) {
  const json = stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0]
  if (!json) {
    throw new Error('FFmpeg did not return loudness measurements')
  }
  const values = JSON.parse(json) as { input_i: string, input_tp: string, input_lra: string }
  return {
    integratedLufs: Number(values.input_i),
    truePeakDbtp: Number(values.input_tp),
    loudnessRangeLu: Number(values.input_lra),
  }
}

async function verifyFilm(film: Film) {
  const file = videoPath(film)
  const probeResult = await runProcess(process.env.FFPROBE_PATH ?? 'ffprobe', [
    '-v',
    'error',
    '-show_streams',
    '-show_format',
    '-of',
    'json',
    file,
  ])
  const probe = JSON.parse(probeResult.stdout) as Probe
  const video = probe.streams.find(stream => stream.codec_type === 'video')
  const audio = probe.streams.find(stream => stream.codec_type === 'audio')
  const checks: Record<string, boolean> = {
    dimensions: video?.width === film.width && video.height === film.height,
    frameRate: video?.avg_frame_rate === `${fps}/1`,
    frameCount: Number(video?.nb_frames) === film.frames,
    duration: Math.abs(Number(probe.format.duration) - film.seconds) <= 1 / fps,
    h264: video?.codec_name === 'h264',
    yuv420p: video?.pix_fmt === 'yuv420p',
    aac48kStereo: audio?.codec_name === 'aac' && audio.sample_rate === '48000' && audio.channels === 2,
    faststart: await hasFaststart(file),
  }
  const scan = await runProcess(process.env.FFMPEG_PATH ?? 'ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-xerror',
    '-i',
    file,
    '-vf',
    'blackdetect=d=0:pix_th=0.025:pic_th=0.995',
    '-af',
    'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
    '-f',
    'null',
    '-',
  ])
  const loudness = readLoudness(scan.stderr)
  const blackIntervals: BlackInterval[] = [...scan.stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)].map(match => ({
    start: Number(match[1]),
    end: Number(match[2]),
    duration: Number(match[3]),
  }))
  checks.decoding = true
  checks.loudness = Number.isFinite(loudness.integratedLufs) && Math.abs(loudness.integratedLufs + 14) <= 1
  checks.truePeak = Number.isFinite(loudness.truePeakDbtp) && loudness.truePeakDbtp <= -0.95
  checks.noInternalBlackFrames = blackIntervals.every(interval => interval.end <= 0.25 || interval.start >= film.seconds - 0.25)
  return {
    file: path.basename(file),
    passed: Object.values(checks).every(Boolean),
    checks,
    measured: {
      width: video?.width,
      height: video?.height,
      frameRate: video?.avg_frame_rate,
      frameCount: Number(video?.nb_frames),
      durationSeconds: Number(probe.format.duration),
      sizeBytes: Number(probe.format.size),
      ...loudness,
      blackIntervals,
    },
  }
}

export async function verifyFilms() {
  validateTimeline()
  const results = []
  for (const film of films) {
    try {
      results.push(await verifyFilm(film))
    }
    catch (error) {
      results.push({ file: path.basename(videoPath(film)), passed: false, error: String(error) })
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    passed: results.every(result => result.passed),
    scope: 'Automated technical verification only. Visual and listening review are separate.',
    timeline: films.map(film => ({ format: film.name, shots: film.shots.length, cuts: film.cuts })),
    expected: { fps, bpm, framesPerShot: 300, audioSampleRate: 48000, integratedLufs: '-14 ±1', maxTruePeakDbtp: -1 },
    results,
  }
  await writeFile(path.join(outputDir, 'verification.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
  if (!report.passed) {
    throw new Error('Video verification failed; see artifacts/promo-video/verification.json')
  }
}
