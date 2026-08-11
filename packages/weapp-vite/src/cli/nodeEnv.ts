import process from 'node:process'

export function initializeNodeEnv(nodeEnv: 'development' | 'production') {
  process.env.NODE_ENV ??= nodeEnv
}
