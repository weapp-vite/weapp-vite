import express, { type ErrorRequestHandler, type RequestHandler } from 'express'
import { createApiRouter } from './routes.js'

export function createHttpApp() {
  const app = express()

  app.use(corsMiddleware)
  app.use(express.json())
  app.use(createApiRouter())
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

const corsMiddleware: RequestHandler = (_request, response, next) => {
  response.setHeader('Access-Control-Allow-Credentials', 'true')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Origin', '*')

  if (_request.method === 'OPTIONS') {
    response.status(204).end()
    return
  }

  next()
}

const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    message: 'Not found',
  })
}

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error('[socket-io-chat] request failed', error)
  response.status(500).json({
    message: 'Internal server error',
  })
}
