export interface InnerAudioError {
  errCode: 10001 | 10002 | 10003 | 10004 | -1
  errMsg: string
}

export interface CreateInnerAudioContextOptions {
  useWebAudioImplement?: boolean
}

export interface InnerAudioContext {
  src: string
  autoplay: boolean
  loop: boolean
  volume: number
  playbackRate: number
  currentTime: number
  startTime: number
  obeyMuteSwitch: boolean
  referrerPolicy: string
  readonly duration: number
  readonly buffered: number
  readonly paused: boolean
  play: () => void
  pause: () => void
  stop: () => void
  seek: (position: number) => void
  destroy: () => void
  onCanplay: (callback: () => void) => void
  offCanplay: (callback?: () => void) => void
  onPlay: (callback: () => void) => void
  offPlay: (callback?: () => void) => void
  onPause: (callback: () => void) => void
  offPause: (callback?: () => void) => void
  onStop: (callback: () => void) => void
  offStop: (callback?: () => void) => void
  onEnded: (callback: () => void) => void
  offEnded: (callback?: () => void) => void
  onTimeUpdate: (callback: () => void) => void
  offTimeUpdate: (callback?: () => void) => void
  onError: (callback: (error: InnerAudioError) => void) => void
  offError: (callback?: (error: InnerAudioError) => void) => void
  onWaiting: (callback: () => void) => void
  offWaiting: (callback?: () => void) => void
  onSeeking: (callback: () => void) => void
  offSeeking: (callback?: () => void) => void
  onSeeked: (callback: () => void) => void
  offSeeked: (callback?: () => void) => void
}
