/// <reference types="weapp-vite/client" />

declare module 'vue' {
  interface ComponentCustomProperties {
    $style: Record<string, string>
  }
}
