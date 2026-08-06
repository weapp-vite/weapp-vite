export type ComponentLibraryRuntimeMode = 'runtime' | 'visual' | 'visual-full'

export interface ComponentLibraryScenarioLike {
  component: string
  route: string
  expectedState: string
}

export function resolveComponentLibraryRuntimeMode(value: string | undefined): ComponentLibraryRuntimeMode {
  if (value === 'visual' || value === 'visual-full') {
    return value
  }
  return 'runtime'
}

export function selectComponentLibraryScenarios<T extends ComponentLibraryScenarioLike>(
  scenarios: readonly T[],
  mode: ComponentLibraryRuntimeMode,
  visualComponents: readonly string[] = [],
) {
  if (mode !== 'visual') {
    return scenarios
  }

  const visualSet = new Set(visualComponents)
  return scenarios.filter(scenario => visualSet.has(scenario.component))
}

export function shouldCaptureComponentLibraryScreenshot(mode: ComponentLibraryRuntimeMode) {
  return mode !== 'runtime'
}

export function shouldRotateComponentLibrarySession(
  mode: ComponentLibraryRuntimeMode,
  scenarioIndex: number,
  sessionScreenshotLimit: number,
) {
  return mode !== 'runtime'
    && scenarioIndex > 0
    && scenarioIndex % sessionScreenshotLimit === 0
}

export function shouldRecoverComponentLibrarySession(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }
  if ('code' in error && error.code === 'DEVTOOLS_PROTOCOL_TIMEOUT') {
    return true
  }
  return /connection closed|target closed|not on top of page stack|timed out waiting/i.test(error.message)
}
