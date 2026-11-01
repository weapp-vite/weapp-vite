import { afterEach, vi } from 'vitest'

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('@weapp-core/logger', () => ({
  default: logger,
}))

afterEach(() => {
  vi.clearAllMocks()
})

export { logger }
