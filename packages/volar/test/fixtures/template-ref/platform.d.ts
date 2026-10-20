import type { JSX as WevuPlatformJSX } from 'wevu/weapp/jsx-runtime'

declare module 'wevu/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends WevuPlatformJSX.IntrinsicElements {}
  }
}

export {}
