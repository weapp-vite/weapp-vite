/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, never>, Record<string, never>, any>
  export default component
}

declare module '*.css'

declare module 'virtual:mermaid-config' {
  const config: import('mermaid').MermaidConfig
  export default config
}
