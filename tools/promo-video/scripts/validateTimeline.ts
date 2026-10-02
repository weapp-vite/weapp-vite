import type { FilmSpec } from '../src/timeline'
import { bpm, filmSpecs, fps } from '../src/timeline'

function requireTimeline(condition: boolean, detail: string): asserts condition {
  if (!condition) {
    throw new Error(`Invalid promo timeline: ${detail}`)
  }
}

/** 在生成素材前检查完整时间线，避免漏镜头、重叠或节拍漂移进入成片。 */
export function validateTimeline(specs: readonly FilmSpec[] = filmSpecs): void {
  requireTimeline(fps === 60 && bpm === 144, 'expected 60 fps and 144 BPM')
  requireTimeline(specs.length === 2, 'expected landscape and portrait films')
  const names = specs.map(film => film.name)
  requireTimeline(new Set(names).size === 2 && names.includes('landscape') && names.includes('portrait'), 'film formats must be unique')

  for (const film of specs) {
    const expectedShots = film.name === 'landscape' ? 12 : 6
    const expectedFrames = film.name === 'landscape' ? 3600 : 1800
    const context = film.name
    requireTimeline(film.shots.length === expectedShots, `${context}: expected ${expectedShots} shots`)
    requireTimeline(film.frames === expectedFrames && film.seconds === expectedFrames / fps, `${context}: incorrect total duration`)
    requireTimeline(film.shots[0]?.kind === 'intro' && film.shots.at(-1)?.kind === 'outro', `${context}: first/last shots must be intro/outro`)

    let nextFrame = 0
    const ids = new Set<string>()
    for (const [index, shot] of film.shots.entries()) {
      const shotContext = `${context} shot ${index + 1}`
      requireTimeline(Boolean(shot.id) && !ids.has(shot.id), `${shotContext}: shot id must be unique`)
      ids.add(shot.id)
      requireTimeline(Boolean(shot.label.trim()), `${shotContext}: label is required`)
      requireTimeline(shot.frames === 300 && shot.endFrame - shot.startFrame === 300, `${shotContext}: expected 300 frames`)
      requireTimeline(shot.startFrame === nextFrame, `${shotContext}: non-contiguous shot boundary`)
      requireTimeline(shot.cues.length === 3 && shot.cues[0] === 0, `${shotContext}: expected three cues starting at frame 0`)
      for (const [cueIndex, cue] of shot.cues.entries()) {
        requireTimeline(Number.isInteger(cue) && cue >= 0 && cue < shot.frames, `${shotContext}: cue must be inside the shot`)
        requireTimeline(cue === cueIndex * 100, `${shotContext}: cues must follow the 100-frame beat grid`)
      }
      nextFrame = shot.endFrame
    }
    requireTimeline(nextFrame === film.frames, `${context}: shot coverage must equal the film duration`)
    const expectedCuts = [...film.shots.map(shot => shot.startFrame / fps), film.frames / fps]
    requireTimeline(film.cuts.length === expectedCuts.length && film.cuts.every((cut, index) => cut === expectedCuts[index]), `${context}: cuts must be derived from shot boundaries`)
  }
}
