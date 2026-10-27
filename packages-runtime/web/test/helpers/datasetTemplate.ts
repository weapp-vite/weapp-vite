import type { TemplateRenderer } from '../../src/runtime/template'
import { transformSync } from 'esbuild'
import { html } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { compileWxml } from '../../src/compiler/wxml'
import { RUNTIME_ID } from '../../src/plugin/constants'
import { bindRuntimeDataset } from '../../src/runtime/datasetBinding'
import { bindRuntimeEvent } from '../../src/runtime/eventBinding'

export function compileDatasetTemplate(source: string): TemplateRenderer {
  const { code } = compileWxml({
    id: '/dataset.wxml',
    source,
    resolveTemplatePath: () => undefined,
    resolveWxsPath: () => undefined,
  })
  const module = { exports: {} as { render: TemplateRenderer } }
  const imports: Record<string, unknown> = {
    'lit': { html },
    'lit/directives/repeat.js': { repeat },
    [RUNTIME_ID]: { bindRuntimeDataset, bindRuntimeEvent },
  }
  // eslint-disable-next-line no-new-func -- 执行真实编译产物，验证 Lit 提交后的 DOM 与事件。
  new Function('require', 'module', 'exports', transformSync(code, { format: 'cjs' }).code)(
    (id: string) => imports[id],
    module,
    module.exports,
  )
  return module.exports.render
}
