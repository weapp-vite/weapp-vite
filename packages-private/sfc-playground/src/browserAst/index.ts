import { parseJsLike } from './babel'

export type AstEngineName = 'babel' | 'oxc'

export function collectFeatureFlagsFromCode() {
  return {}
}

export function parseJsLikeWithEngine(source: string) {
  return {
    engine: 'babel' as const,
    ast: parseJsLike(source),
  }
}
