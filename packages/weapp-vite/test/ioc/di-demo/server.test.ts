import type { ServiceA } from './ServiceA'
import type { ServiceAll } from './ServiceAll'
import express from 'express'
import request from 'supertest'
import { container } from './inversify.config'
import { TYPES } from './types'

const app = express()

app.get('/test', (_req, res) => {
  const serviceA1 = container.get<ServiceA>(TYPES.ServiceA)
  const serviceA2 = container.get<ServiceA>(TYPES.ServiceA)
  const serviceA3 = container.get<ServiceA>(TYPES.ServiceA)

  serviceA1.print('ServiceA1')
  serviceA2.print('ServiceA2')
  serviceA3.print('ServiceA3')

  res.send('Check the console logs!')
})

// app.use((err, req, res, next) => {
//   console.error(err.stack)
//   res.status(500).send('Something broke!')
// })

describe('di-demo', () => {
  it('should ', async () => {
    const res = await request(app).get('/test')
    expect(res.status).toBe(200)
  })

  it('should 0', () => {
    const serviceAll0 = container.get<ServiceAll>(TYPES.ServiceAll)
    expect(serviceAll0.serviceA).toBeTruthy()
    expect(serviceAll0.serviceB).toBeTruthy()
    expect(serviceAll0.serviceB.ctx === serviceAll0.serviceA.ctx).toBeTruthy()
    const serviceAll1 = container.get<ServiceAll>(TYPES.ServiceAll)
    expect(serviceAll1.serviceA).toBeTruthy()
    expect(serviceAll1.serviceB).toBeTruthy()
    expect(serviceAll1.serviceB.ctx === serviceAll1.serviceA.ctx).toBeTruthy()
  })
})
