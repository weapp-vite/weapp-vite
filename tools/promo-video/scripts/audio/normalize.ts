import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

interface Measurement {
  input_i: string
  input_tp: string
  input_lra: string
  input_thresh: string
  target_offset: string
}

function parseMeasurement(stderr: string): Measurement {
  const match = stderr.match(/\{\s*"input_i"[\s\S]*?\}/)
  if (!match) {
    throw new Error('FFmpeg 未返回 loudnorm 响度测量结果。')
  }
  const result: unknown = JSON.parse(match[0])
  if (typeof result !== 'object' || result === null) {
    throw new Error('FFmpeg 响度测量结果格式错误。')
  }
  const fields = ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'] as const
  for (const field of fields) {
    if (!(field in result) || !Number.isFinite(Number((result as Record<string, unknown>)[field]))) {
      throw new Error(`FFmpeg 响度测量字段不可用：${field}`)
    }
  }
  return result as Measurement
}

/** 两遍测量归一化，留出 AAC 编码所需的真峰值余量。 */
export async function normalizeAudio(source: string, output: string) {
  const { stderr } = await run('ffmpeg', [
    '-hide_banner',
    '-nostdin',
    '-i',
    source,
    '-af',
    'loudnorm=I=-14:LRA=9:TP=-2:print_format=json',
    '-f',
    'null',
    '-',
  ], { maxBuffer: 4 * 1024 * 1024 })
  const measured = parseMeasurement(stderr)
  const filter = [
    'loudnorm=I=-14:LRA=9:TP=-2',
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    'linear=true:print_format=summary',
  ].join(':')
  await run('ffmpeg', [
    '-hide_banner',
    '-nostdin',
    '-y',
    '-i',
    source,
    '-af',
    filter,
    '-ar',
    '48000',
    '-ac',
    '2',
    '-c:a',
    'pcm_s24le',
    '-map_metadata',
    '-1',
    output,
  ], { maxBuffer: 4 * 1024 * 1024 })
}
