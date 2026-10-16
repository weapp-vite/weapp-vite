import type { Page } from 'playwright'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { sanitizeBenchmarkDevLog } from '../../scripts/benchmarkTemplatesHmr/diagnostics'

interface FailureOptions {
  page: Page
  root: string
  project: string
  error: unknown
  pageErrors: string[]
  devOutput: string
}

/** 仅在原场景失败后读取现场；诊断和落盘共用预算，不改变点击、重载或原始异常。 */
export async function captureIssue1029WebFailure(options: FailureOptions) {
  const { page, root, project } = options
  const startedAt = Date.now()
  const deadline = startedAt + 2_500
  const errors: Array<{ phase: string, message: string }> = []
  const sanitize = (value: string) => sanitizeBenchmarkDevLog(
    value.replaceAll('\\', '/').replaceAll(project.replaceAll('\\', '/'), '<project>'),
    root,
  )
  const errorMessage = (error: unknown) => {
    try {
      return sanitize(error instanceof Error ? error.message : String(error))
    }
    catch {
      return 'unprintable diagnostic error'
    }
  }
  const emit = (message: string) => {
    try {
      process.stderr.write(`[issue-1029-web-failure] ${message}\n`)
    }
    catch {
      // 证据输出失败不能覆盖原场景异常。
    }
  }
  async function bounded<T>(action: () => Promise<T>, phase: string, until = deadline) {
    if (Date.now() >= until) {
      errors.push({ phase, message: 'diagnostic budget exhausted' })
      return { ok: false as const }
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        Promise.resolve().then(() => {
          if (Date.now() >= until) {
            throw new Error('diagnostic budget exhausted')
          }
          return action()
        }).then(value => ({ ok: true as const, value }), (error: unknown) => {
          errors.push({ phase, message: errorMessage(error) })
          return { ok: false as const }
        }),
        new Promise<{ ok: false }>((resolve) => {
          timer = setTimeout(() => {
            errors.push({ phase, message: 'diagnostic budget exhausted' })
            resolve({ ok: false })
          }, Math.max(0, until - Date.now()))
        }),
      ])
    }
    finally {
      clearTimeout(timer)
    }
  }

  try {
    const url = page.url()
    const probeDeadline = Math.min(deadline, Date.now() + 2_000)
    const [dom, image] = await Promise.all([
      bounded(() => page.evaluate(() => {
        const snapshot = (element: Element) => {
          const style = getComputedStyle(element)
          const box = element.getBoundingClientRect()
          return {
            tag: element.tagName,
            id: element.id,
            connected: element.isConnected,
            active: element.getAttribute('data-weapp-page-active'),
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
            style: {
              display: style.display,
              visibility: style.visibility,
              position: style.position,
              overflowX: style.overflowX,
              overflowY: style.overflowY,
              transform: style.transform,
              contain: style.contain,
              pointerEvents: style.pointerEvents,
            },
            scroll: {
              top: element.scrollTop,
              left: element.scrollLeft,
              height: element.scrollHeight,
              width: element.scrollWidth,
              clientHeight: element.clientHeight,
              clientWidth: element.clientWidth,
            },
          }
        }
        const activePages = Array.from(document.querySelectorAll('[data-weapp-page-active="true"]')).slice(0, 6)
        const buttons: Element[] = []
        let visited = 0
        const visit = (container: Element | ShadowRoot) => {
          for (const element of container.querySelectorAll('*')) {
            if (++visited > 2_000) {
              return
            }
            if (element.id === 'go-back') {
              buttons.push(element)
            }
            if (element.shadowRoot) {
              visit(element.shadowRoot)
            }
          }
        }
        for (const active of activePages) {
          visit(active)
          if (active.shadowRoot) {
            visit(active.shadowRoot)
          }
        }
        let currentPages: Array<{ route: string }> = []
        let routeRecords: unknown
        let runtimeError: string | undefined
        try {
          const host = globalThis as unknown as {
            getCurrentPages?: () => Array<{ route: string, _runE2E?: () => { records: unknown } }>
          }
          const pages = host.getCurrentPages?.() ?? []
          currentPages = pages.map(item => ({ route: item.route }))
          routeRecords = pages.at(-1)?._runE2E?.().records
        }
        catch (error) {
          runtimeError = error instanceof Error ? error.message : String(error)
        }
        return {
          url: location.href,
          readyState: document.readyState,
          visibilityState: document.visibilityState,
          currentPages,
          routeRecords,
          runtimeError,
          pages: Array.from(document.querySelectorAll('[data-weapp-page-active]')).slice(0, 12).map(snapshot),
          activePages: activePages.map(element => ({
            ...snapshot(element),
            html: element.outerHTML.slice(0, 16_000),
            shadowHtml: element.shadowRoot?.innerHTML.slice(0, 16_000),
          })),
          targets: buttons.slice(0, 6).map((button) => {
            const ancestors: ReturnType<typeof snapshot>[] = []
            for (let element: Element | null = button; element && ancestors.length < 24;) {
              ancestors.push(snapshot(element))
              const root = element.getRootNode()
              element = element.parentElement ?? (root instanceof ShadowRoot ? root.host : null)
            }
            return { html: button.outerHTML.slice(0, 8_000), ancestors }
          }),
          traversalTruncated: visited > 2_000,
        }
      }), 'DOM', probeDeadline),
      bounded(() => page.screenshot({ timeout: 2_000 }), 'viewport screenshot', probeDeadline),
    ])
    const directory = await bounded(
      async () => {
        await mkdir(path.join(root, '.tmp/web-runtime-diagnostics'), { recursive: true })
        if (Date.now() >= deadline) {
          throw new Error('diagnostic budget exhausted')
        }
        return mkdtemp(path.join(root, '.tmp/web-runtime-diagnostics/issue-1029-'))
      },
      'artifact directory',
    )
    if (!directory.ok) {
      return
    }
    if (Date.now() >= deadline) {
      errors.push({ phase: 'artifact write', message: 'diagnostic budget exhausted' })
      return
    }
    const report = {
      capturedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      budgetMs: 2_500,
      url,
      project: '<project>',
      failure: {
        name: options.error instanceof Error ? options.error.name : typeof options.error,
        message: errorMessage(options.error),
      },
      pageErrors: options.pageErrors,
      dom: dom.ok ? dom.value : null,
      diagnosticErrors: errors,
    }
    const json = JSON.stringify(report, (_key, value: unknown) => typeof value === 'string' ? sanitize(value) : value, 2)
    const files: Array<{ name: string, content: string | Uint8Array }> = [
      { name: 'failure.json', content: `${json}\n` },
      { name: 'dev.log', content: sanitize(options.devOutput.slice(-24_000)) },
    ]
    if (image.ok) {
      files.push({ name: 'viewport.png', content: image.value })
    }
    await bounded(() => Promise.all(files.map(file => writeFile(path.join(directory.value, file.name), file.content))), 'artifact write')
    emit(path.relative(root, directory.value).replaceAll('\\', '/'))
  }
  catch (error) {
    errors.push({ phase: 'capture', message: errorMessage(error) })
  }
  finally {
    if (errors.length > 0) {
      emit(`diagnostic errors: ${JSON.stringify(errors)}`)
    }
  }
}
