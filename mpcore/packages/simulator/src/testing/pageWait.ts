export interface HeadlessTestingWaitOptions {
  interval?: number
  timeout?: number
}

export type HeadlessTestingDataMatcher
  = | unknown
    | ((value: unknown) => boolean)

export interface HeadlessTestingWaitForSelectorOptions extends HeadlessTestingWaitOptions {
  state?: 'attached' | 'detached'
}

export interface HeadlessTestingPageWaitAccess<NodeHandle, ScopeHandle> {
  data: (path?: string) => Promise<unknown>
  findOne: (selector: string) => Promise<NodeHandle | null>
  selectComponent: (selector: string) => Promise<ScopeHandle | null>
  selectComponents: (selector: string) => Promise<ScopeHandle[]>
  waitFor: (ms?: number) => Promise<void>
  wxml: () => Promise<string>
}

const DEFAULT_WAIT_TIMEOUT = 1_000
const DEFAULT_WAIT_INTERVAL = 10

function normalizeInput(value: string, label: string) {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(`${label} must be a non-empty string in headless testing runtime.`)
  }
  return normalized
}

async function pollUntil<T>(
  access: Pick<HeadlessTestingPageWaitAccess<unknown, unknown>, 'waitFor'>,
  check: () => Promise<T | null>,
  errorMessage: string,
  options: HeadlessTestingWaitOptions,
) {
  const timeout = Number.isFinite(options.timeout)
    ? Math.max(0, Math.trunc(options.timeout ?? DEFAULT_WAIT_TIMEOUT))
    : DEFAULT_WAIT_TIMEOUT
  const interval = Number.isFinite(options.interval)
    ? Math.max(1, Math.trunc(options.interval ?? DEFAULT_WAIT_INTERVAL))
    : DEFAULT_WAIT_INTERVAL
  const deadline = Date.now() + timeout

  while (true) {
    const result = await check()
    if (result != null) {
      return result
    }
    if (Date.now() >= deadline) {
      throw new Error(errorMessage)
    }
    await access.waitFor(interval)
  }
}

export async function waitForPageSelector<NodeHandle, ScopeHandle>(
  access: HeadlessTestingPageWaitAccess<NodeHandle, ScopeHandle>,
  selector: string,
  options: HeadlessTestingWaitForSelectorOptions = {},
) {
  const normalizedSelector = normalizeInput(selector, 'Selector')
  if (options.state === 'detached') {
    await pollUntil(
      access,
      async () => (await access.findOne(normalizedSelector)) ? null : true,
      `Timed out waiting for selector "${normalizedSelector}" to become detached in headless testing runtime.`,
      options,
    )
    return null
  }

  return await pollUntil(
    access,
    async () => await access.findOne(normalizedSelector),
    `Timed out waiting for selector "${normalizedSelector}" to appear in headless testing runtime.`,
    options,
  )
}

export async function waitForPageComponent<NodeHandle, ScopeHandle>(
  access: HeadlessTestingPageWaitAccess<NodeHandle, ScopeHandle>,
  selector: string,
  options: HeadlessTestingWaitOptions = {},
) {
  const normalizedSelector = normalizeInput(selector, 'Selector')
  return await pollUntil(
    access,
    async () => await access.selectComponent(normalizedSelector),
    `Timed out waiting for component "${normalizedSelector}" in headless testing runtime.`,
    options,
  )
}

export async function waitForPageComponents<NodeHandle, ScopeHandle>(
  access: HeadlessTestingPageWaitAccess<NodeHandle, ScopeHandle>,
  selector: string,
  count = 1,
  options: HeadlessTestingWaitOptions = {},
) {
  const normalizedSelector = normalizeInput(selector, 'Selector')
  const normalizedCount = Number.isFinite(count) ? Math.max(1, Math.trunc(count)) : 1
  return await pollUntil(
    access,
    async () => {
      const components = await access.selectComponents(normalizedSelector)
      return components.length >= normalizedCount ? components : null
    },
    `Timed out waiting for ${normalizedCount} component(s) matching "${normalizedSelector}" in headless testing runtime.`,
    options,
  )
}

export async function waitForPageText<NodeHandle, ScopeHandle>(
  access: HeadlessTestingPageWaitAccess<NodeHandle, ScopeHandle>,
  text: string,
  options: HeadlessTestingWaitOptions = {},
) {
  const normalizedText = normalizeInput(text, 'Text')
  return await pollUntil(
    access,
    async () => (await access.wxml()).includes(normalizedText) ? normalizedText : null,
    `Timed out waiting for text "${normalizedText}" in headless testing runtime.`,
    options,
  )
}

export async function waitForPageTextGone<NodeHandle, ScopeHandle>(
  access: HeadlessTestingPageWaitAccess<NodeHandle, ScopeHandle>,
  text: string,
  options: HeadlessTestingWaitOptions = {},
) {
  const normalizedText = normalizeInput(text, 'Text')
  await pollUntil(
    access,
    async () => (await access.wxml()).includes(normalizedText) ? null : true,
    `Timed out waiting for text "${normalizedText}" to disappear in headless testing runtime.`,
    options,
  )
}

export async function waitForPageData<NodeHandle, ScopeHandle>(
  access: HeadlessTestingPageWaitAccess<NodeHandle, ScopeHandle>,
  path: string,
  matcher: HeadlessTestingDataMatcher,
  hasMatcher: boolean,
  options: HeadlessTestingWaitOptions = {},
) {
  const normalizedPath = normalizeInput(path, 'Data path')
  return await pollUntil(
    access,
    async () => {
      const value = await access.data(normalizedPath)
      if (typeof matcher === 'function') {
        return matcher(value) ? value : null
      }
      if (hasMatcher) {
        return Object.is(value, matcher) ? value : null
      }
      return value === undefined ? null : value
    },
    `Timed out waiting for data "${normalizedPath}" in headless testing runtime.`,
    options,
  )
}
