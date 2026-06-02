import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import GameView from '../views/GameView.vue'

vi.mock('../api', () => ({
  fetchGameRooms: vi.fn(),
  createGameRoom: vi.fn(),
  fetchRoomMembers: vi.fn(),
  addRoomMember: vi.fn(),
  fetchContacts: vi.fn(),
  deleteGameRoom: vi.fn(),
}))

import {
  fetchGameRooms,
  createGameRoom,
  fetchRoomMembers,
  fetchContacts,
  deleteGameRoom,
} from '../api'

describe('GameView', () => {
  beforeEach(() => {
    localStorage.setItem('userId', '8')
    fetchContacts.mockResolvedValue([{ id: 10, username: 'partner' }])
    fetchGameRooms.mockResolvedValue([{ id: 2, name: 'R1', created_by: 8 }])
    fetchRoomMembers.mockResolvedValue([{ id: 8, username: 'me' }, { id: 10, username: 'partner' }])
  })

  it('creates room from form', async () => {
    const wrapper = mount(GameView, {
      global: {
        stubs: {
          AppMenu: { template: '<div />' },
          ChatPanel: { template: '<div />' },
        },
      },
    })
    await flushPromises()
    await wrapper.find('input[placeholder="Название комнаты"]').setValue('new room')
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(createGameRoom).toHaveBeenCalled()
  })

  it('deletes selected room for creator', async () => {
    const wrapper = mount(GameView, {
      global: {
        stubs: {
          AppMenu: { template: '<div />' },
          ChatPanel: { template: '<div />' },
        },
      },
    })
    await flushPromises()
    const roomButton = wrapper.find('.room-btn')
    await roomButton.trigger('click')
    await flushPromises()
    const deleteBtn = wrapper.findAll('button').find((b) => b.text().includes('Удалить комнату'))
    expect(deleteBtn).toBeTruthy()
    await deleteBtn.trigger('click')
    await flushPromises()
    expect(deleteGameRoom).toHaveBeenCalledWith(2)
  })
})
