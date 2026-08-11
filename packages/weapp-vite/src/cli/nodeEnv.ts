import process from 'node:process'

export function setCommandNodeEnv(nodeEnv: 'development' | 'production') {
  process.env.NODE_ENV = nodeEnv
}
