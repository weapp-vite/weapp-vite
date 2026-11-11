import path from 'node:path'
import process from 'node:process'

export default {
  weapp: { srcRoot: 'src', platform: 'weapp', autoRoutes: false, tailwindcss: false },
  plugins: [{
    name: 'fixture:resolver-root-watch',
    buildStart() {
      this.addWatchFile(path.parse(process.cwd()).root)
    },
  }],
}
