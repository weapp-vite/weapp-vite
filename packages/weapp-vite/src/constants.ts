import { version } from '../package.json'

export const VERSION = version

export const jsExtensions = ['ts', 'js']

export const supportedCssLangs = ['wxss', 'scss', 'less', 'sass', 'styl']

export const supportedCssExtensions = supportedCssLangs.map(x => `.${x}`)
