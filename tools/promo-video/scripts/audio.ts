import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { encodeWave, finishMix } from './audio/mix'
import { normalizeAudio } from './audio/normalize'
import { compose } from './audio/score'
import { BPM, SAMPLE_RATE } from './audio/synth'

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
const defaultOutput = path.join(repositoryRoot, '.cache/promo-video/public/audio')
const formats = ['landscape', 'portrait'] as const

/** 指纹仅包含相对文件名、源码和音频参数，与本机目录无关。 */
async function sourceFingerprint(): Promise<string> {
  const scriptDirectory = fileURLToPath(new URL('.', import.meta.url))
  const modules = (await readdir(path.join(scriptDirectory, 'audio')))
    .filter(name => name.endsWith('.ts'))
    .map(name => `audio/${name}`)
  const files = ['audio.ts', ...modules].sort()
  const contents = await Promise.all(files.map(name => readFile(path.join(scriptDirectory, name), 'utf8')))
  const hash = createHash('sha256').update(JSON.stringify({
    formats,
    durations: [60, 30],
    sampleRate: SAMPLE_RATE,
    bpm: BPM,
    channels: 2,
    bits: 24,
  }))
  for (const [index, name] of files.entries()) {
    hash.update(name).update('\0').update(contents[index]).update('\0')
  }
  return hash.digest('hex')
}

async function cacheIsCurrent(outputDir: string, fingerprint: string): Promise<boolean> {
  try {
    const manifest: unknown = JSON.parse(await readFile(path.join(outputDir, 'manifest.json'), 'utf8'))
    if (typeof manifest !== 'object' || manifest === null
      || !('fingerprint' in manifest) || manifest.fingerprint !== fingerprint) {
      return false
    }
    const outputs = await Promise.all(formats.map(format => stat(path.join(outputDir, `${format}.wav`))))
    return outputs.every(output => output.isFile() && output.size > 44)
  }
  catch {
    return false
  }
}

/** 合成原创配乐与转场音效，输出两个独立编排的 48 kHz 立体声 WAV。 */
export async function generateAudio(outputDir: string): Promise<void> {
  const fingerprint = await sourceFingerprint()
  if (await cacheIsCurrent(outputDir, fingerprint)) {
    console.log('Audio cache current: landscape / portrait')
    return
  }
  await mkdir(outputDir, { recursive: true })
  for (const format of formats) {
    const intermediate = path.join(outputDir, `${format}.raw.wav`)
    const output = path.join(outputDir, `${format}.wav`)
    console.log(`Synthesizing ${format}: 128 BPM / 48 kHz stereo`)
    try {
      await writeFile(intermediate, encodeWave(finishMix(compose(format))))
      await normalizeAudio(intermediate, output)
    }
    finally {
      await rm(intermediate, { force: true })
    }
    console.log(`Audio ready: ${output}`)
  }
  await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify({
    version: 1,
    fingerprint,
    outputs: formats.map(format => `${format}.wav`),
  }, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateAudio(path.resolve(process.argv[2] ?? defaultOutput)).catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
