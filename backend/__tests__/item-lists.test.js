const request = require('supertest')
const jwt = require('jsonwebtoken')

jest.mock('../src/db', () => ({
  query: jest.fn(),
}))

const pool = require('../src/db')
const { app } = require('../src/app')

describe('Item lists API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('GET /api/item-lists returns public lists', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'loot', owner_id: 8, owner_username: 'u1', items_count: 3 }],
    })

    const response = await request(app).get('/api/item-lists')

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(1)
    expect(response.body[0].name).toBe('loot')
  })

  test('GET /api/item-lists/:id/random returns random item', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'weapons', is_public: true }] })
      .mockResolvedValueOnce({ rows: [{ id: 11, value: 'sword' }] })

    const response = await request(app).get('/api/item-lists/2/random')

    expect(response.status).toBe(200)
    expect(response.body.item).toBe('sword')
  })

  test('GET /api/item-lists/:id/random rejects empty list', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'empty', is_public: true }] })
      .mockResolvedValueOnce({ rows: [] })

    const response = await request(app).get('/api/item-lists/2/random')

    expect(response.status).toBe(400)
    expect(response.body.message).toContain('Список пуст')
  })

  test('PUT /api/item-lists/:id forbids non-owner', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValue({ sub: 9, isAdmin: false })
    pool.query.mockResolvedValueOnce({ rows: [{ id: 3, owner_id: 8 }] })

    const response = await request(app)
      .put('/api/item-lists/3')
      .set('Authorization', 'Bearer token')
      .send({ name: 'n', items: ['a'] })

    expect(response.status).toBe(403)
    expect(response.body.message).toContain('только создатель')
  })

  test('DELETE /api/item-lists/:id deletes for owner', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValue({ sub: 8, isAdmin: false })
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 3, owner_id: 8 }] })
      .mockResolvedValueOnce({ rows: [] })

    const response = await request(app)
      .delete('/api/item-lists/3')
      .set('Authorization', 'Bearer token')

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Список удален')
  })

  test('GET /api/item-lists/history returns user generation history', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValue({ sub: 8, isAdmin: false })
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, list_id: 2, item_id: 11, item_value: 'Potion', list_name: 'Loot' }],
    })

    const response = await request(app)
      .get('/api/item-lists/history')
      .set('Authorization', 'Bearer token')

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(1)
    expect(response.body[0].item_value).toBe('Potion')
  })
})
