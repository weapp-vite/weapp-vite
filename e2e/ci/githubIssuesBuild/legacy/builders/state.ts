interface LegacyBuildState {
  standardBuildPromise: Promise<void> | null
  distVariant: 'standard' | 'sourcemap' | null
}

export const buildState: LegacyBuildState = {
  standardBuildPromise: null,
  distVariant: null,
}
