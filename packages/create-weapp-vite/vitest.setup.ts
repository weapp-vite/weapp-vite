import picocolors from 'picocolors'
import { afterEach, vi } from 'vitest'

const logger = vi.hoisted(() => {
  const instance = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    withTag: vi.fn(),
  }
  instance.withTag.mockReturnValue(instance)
  return instance
})
const configureLogger = vi.hoisted(() => vi.fn())

vi.mock('@weapp-core/logger', () => ({
  colors: picocolors,
  configureLogger,
  default: logger,
}))

afterEach(() => {
  vi.clearAllMocks()
})

export { logger }
