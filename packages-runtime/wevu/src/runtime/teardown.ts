export function runTeardownSteps(steps: Array<() => void>): void {
  let firstError: unknown
  let hasError = false

  for (const step of steps) {
    try {
      step()
    }
    catch (error) {
      if (!hasError) {
        firstError = error
        hasError = true
      }
    }
  }

  if (hasError) {
    throw firstError
  }
}
