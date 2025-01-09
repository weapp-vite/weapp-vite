import type { UserConfig } from 'weapp-vite/config'

export default <UserConfig>{
  weapp: {
    enhance: {
      autoImportComponents: {
        globs: ['components/**/*'],
      },
    },
  },
}
