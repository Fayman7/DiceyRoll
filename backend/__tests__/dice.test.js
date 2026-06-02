const request = require('supertest')
const jwt = require('jsonwebtoken')

jest.mock('../src/db', () => ({
  query: jest.fn(),
}))

const pool = require('../src/db')
const { app } = require('../src/app')

describe('POST /api/dice/roll', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('allows guest roll without saving history', async () => {
    const response = await request(app)
      .post('/api/dice/roll')
      .send({ diceType: 'd6' })

    expect(response.status).toBe(200)
    expect(response.body.dice_type).toBe('d6')
    expect(response.body.persisted).toBe(false)
    expect(response.body.user_id).toBeNull()
    expect(response.body.result).toBeGreaterThanOrEqual(1)
    expect(response.body.result).toBeLessThanOrEqual(6)
    expect(pool.query).not.toHaveBeenCalled()
  })

  test('saves roll for authorized user', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValue({ sub: 42 })
    pool.query.mockResolvedValue({
      rows: [{ id: 1, user_id: 42, dice_type: 'd20', result: 17 }],
    })

    const response = await request(app)
      .post('/api/dice/roll')
      .set('Authorization', 'Bearer fake-token')
      .send({ diceType: 'd20' })

    expect(response.status).toBe(200)
    expect(response.body.persisted).toBe(true)
    expect(response.body.user_id).toBe(42)
    expect(response.body.dice_type).toBe('d20')
    expect(pool.query).toHaveBeenCalled()
  })
})
