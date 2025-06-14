import { injectable } from 'inversify'

@injectable()
export class Logger {
  constructor() {
    console.log('>> inSingletonScope Created Logger')
  }

  log(message: string) {
    console.log(`[LOG]: ${message}`)
  }
}
