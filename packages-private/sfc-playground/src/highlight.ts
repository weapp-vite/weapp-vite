import type { OutputPaneKey } from './compiler'
import { createHighlighter } from 'shiki'

const HIGHLIGHT_THEME = 'github-dark'

const paneLanguages: Record<OutputPaneKey, 'typescript' | 'html' | 'css' | 'json' | 'md'> = {
  script: 'typescript',
  template: 'html',
  style: 'css',
  config: 'json',
  meta: 'json',
  warnings: 'md',
}

const highlighterPromise = createHighlighter({
  themes: [HIGHLIGHT_THEME],
  langs: ['typescript', 'html', 'css', 'json', 'md'],
})

function escapeHtml(source: string) {
  return source
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function getPaneLanguage(key: OutputPaneKey) {
  return paneLanguages[key]
}

export async function highlightPaneOutput(key: OutputPaneKey, source: string) {
  try {
    const highlighter = await highlighterPromise
    return highlighter.codeToHtml(source, {
      lang: paneLanguages[key],
      theme: HIGHLIGHT_THEME,
      transformers: [
        {
          pre(node) {
            node.properties.class = ['wevu-shiki']
          },
        },
      ],
    })
  }
  catch {
    return `<pre class="wevu-shiki"><code>${escapeHtml(source)}</code></pre>`
  }
}
