import { injectable } from 'inversify'

@injectable()
export class Logger {
  constructor() {
    console.log('>> Created Logger')
  }

  log(message: string) {
    console.log(`[LOG]: ${message}`)
  }
}
