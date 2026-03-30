import type { UserConfig } from 'weapp-vite'

export default <UserConfig>{
  weapp: {
    enhance: {
      autoImportComponents: {
        globs: ['components/**/*'],
      },
    },
  },
}
