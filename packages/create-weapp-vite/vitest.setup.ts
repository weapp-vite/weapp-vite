import { afterEach, beforeAll, vi } from 'vitest'
import { main as syncTemplates } from './scripts/shared'

const logger = {
  error: vi.fn(),
  info: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
}

vi.mock('@weapp-core/logger', () => ({
  default: logger,
}))

beforeAll(async () => {
  await syncTemplates()
})

afterEach(() => {
  vi.clearAllMocks()
})

export { logger }
