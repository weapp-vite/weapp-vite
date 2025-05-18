import { injectable } from 'inversify'

@injectable()
export class Logger {
  log(message: string) {
    console.log(`[LOG]: ${message}`)
  }
}
