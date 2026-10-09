/// <reference types="weapp-vite/client" />

import 'vue'

declare module 'vue' {
  interface ComponentCustomProperties {
    $style: Record<string, string>
  }
}
