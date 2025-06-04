import { watch } from 'rollup'

const watcher = watch({
  input: {
    index: './src/index.js',
  },
  plugins: [
    {
      name: 'test',
      load(id) {
        console.log('load', id)
      },
      transform(_code, id) {
        console.log('transform', id)
      },
      buildEnd() {
        // console.log('getWatchFiles', this.getWatchFiles())
        // const moduleIds = this.getModuleIds()
        // console.log('getModuleIds', moduleIds)
        // const moduleInfos = [...moduleIds].map((id) => {
        //   return this.getModuleInfo(id)
        // })
        // console.log(moduleInfos)
        console.log('buildEnd', Date.now())
      },
    },
  ],
  output: {
    dir: 'dist',
  },
})

// export type RollupWatcherEvent =
//   | { code: 'START' }
//   | { code: 'BUNDLE_START'; input?: InputOption; output: readonly string[] }
//   | {
//       code: 'BUNDLE_END';
//       duration: number;
//       input?: InputOption;
//       output: readonly string[];
//       result: RollupBuild;
//     }
//   | { code: 'END' }
//   | { code: 'ERROR'; error: RollupError; result: RollupBuild | null };

// 触发事件的顺序 START -> BUNDLE_START -> BUNDLE_END -> END
// watcher.on('event', (e) => {
//   console.log('event', e)
//   if (e.code === 'END') {
//     console.log('-------------------------------')
//   }
// })
// 然后保存一个文件直接 change
// watcher.on('change', (e) => {
//   console.log('change', e)
// })
// 然后这时候就 restart
// watcher.on('restart', () => {
//   console.log('restart')
//   // console.log('-------------------------------')
// })

// watcher.on('close', () => {
//   console.log('close')
// })

// watcher.onCurrentRun('change', async (id, change) => {
//   console.log('onCurrentRun change', id, change)
// })

// watcher.onCurrentRun('close', async () => {
//   console.log('onCurrentRun close')
// })

// watcher.onCurrentRun('event', async (e) => {
//   console.log('onCurrentRun event', e)
// })

// watcher.onCurrentRun('restart', async () => {
//   console.log('onCurrentRun restart')
// })
