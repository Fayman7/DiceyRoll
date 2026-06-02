const request = require('supertest')
const jwt = require('jsonwebtoken')

jest.mock('../src/db', () => ({
  query: jest.fn(),
}))

const pool = require('../src/db')
const { app } = require('../src/app')

describe('Delete endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(jwt, 'verify').mockReturnValue({ sub: 8, isAdmin: false })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('DELETE /api/game/rooms/:id deletes own room', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 3, created_by: 8 }] })
      .mockResolvedValueOnce({ rows: [] })

    const response = await request(app)
      .delete('/api/game/rooms/3')
      .set('Authorization', 'Bearer token')

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Комната удалена')
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      'SELECT id, created_by FROM game_rooms WHERE id = $1',
      [3]
    )
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      'DELETE FROM game_rooms WHERE id = $1',
      [3]
    )
  })

  test('DELETE /api/chats/:partnerId deletes chat and messages', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 10, username: 'partner' }] }) // findUserById
      .mockResolvedValueOnce({ rows: [{ id: 7 }] }) // findChatByUsers
      .mockResolvedValueOnce({ rows: [{ user1_id: 8, user2_id: 10 }] }) // assertChatMember
      .mockResolvedValueOnce({ rows: [] }) // delete messages
      .mockResolvedValueOnce({ rows: [] }) // delete chat

    const response = await request(app)
      .delete('/api/chats/10')
      .set('Authorization', 'Bearer token')

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Чат удален')
    expect(pool.query).toHaveBeenNthCalledWith(4, 'DELETE FROM messages WHERE chat_id = $1', [7])
    expect(pool.query).toHaveBeenNthCalledWith(5, 'DELETE FROM chats WHERE id = $1', [7])
  })
})
