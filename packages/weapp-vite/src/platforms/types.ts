import type { MpPlatform } from '@/types'

export interface OutputExtensions {
  js: string
  json: string
  wxml: string
  wxss: string
  wxs?: string
}

export interface MiniProgramPlatformAdapter {
  /**
   * Canonical platform identifier used across the build pipeline.
   */
  id: MpPlatform
  /**
   * Human-readable label for diagnostics and tooling.
   */
  displayName: string
  /**
   * Alias identifiers that should be mapped to this platform.
   */
  aliases: readonly string[]
  /**
   * File extensions to emit for compiled assets.
   */
  outputExtensions: OutputExtensions
}
