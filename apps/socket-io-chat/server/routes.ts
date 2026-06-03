import { Router } from 'express'
import {
  contactProfile,
  conversationInsight,
  moments,
} from './data.js'

interface GraphqlRequestBody {
  query?: unknown
}

export function createApiRouter() {
  const router = Router()

  router.get('/api/contact', (_request, response) => {
    response.json(contactProfile)
  })

  router.get('/api/moments', (_request, response) => {
    response.json({
      items: moments,
      refreshedAt: Date.now(),
    })
  })

  router.post('/graphql', (request, response) => {
    const body = request.body as GraphqlRequestBody | undefined
    const query = typeof body?.query === 'string' ? body.query : ''

    if (!query.includes('conversationInsight')) {
      response.status(400).json({
        errors: [
          {
            message: 'Only conversationInsight is available in this demo.',
          },
        ],
      })
      return
    }

    response.json({
      data: {
        conversationInsight,
      },
    })
  })

  return router
}
