const request = require('supertest')
const jwt = require('jsonwebtoken')

jest.mock('../src/db', () => ({
  query: jest.fn(),
}))

const pool = require('../src/db')
const { app } = require('../src/app')

describe('Images admin endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('GET /api/images/all returns all images for admin', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValue({ sub: 1, isAdmin: true })
    pool.query.mockResolvedValueOnce({
      rows: [{ img_id: 5, owner_id: 2, img_url: 'a.png', owner_username: 'user2' }],
    })

    const response = await request(app)
      .get('/api/images/all')
      .set('Authorization', 'Bearer token')

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      { img_id: 5, owner_id: 2, img_url: 'a.png', owner_username: 'user2' },
    ])
  })

  test('GET /api/images/all is forbidden for non-admin', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValue({ sub: 2, isAdmin: false })

    const response = await request(app)
      .get('/api/images/all')
      .set('Authorization', 'Bearer token')

    expect(response.status).toBe(403)
    expect(pool.query).not.toHaveBeenCalled()
  })
})
