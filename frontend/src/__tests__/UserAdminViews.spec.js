import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UserView from '../views/UserView.vue'
import AdminView from '../views/AdminView.vue'

vi.mock('../api', () => ({
  apiFetch: vi.fn(),
  fetchMe: vi.fn(),
  updateMe: vi.fn(),
  logout: vi.fn(),
  fetchNonAdmins: vi.fn(),
  promoteUser: vi.fn(),
  deleteUserByAdmin: vi.fn(),
}))

import {
  fetchMe,
  updateMe,
  fetchNonAdmins,
  promoteUser,
  deleteUserByAdmin,
} from '../api'

describe('UserView and AdminView', () => {
  beforeEach(() => {
    fetchMe.mockResolvedValue({ id: 8, username: 'me' })
    fetchNonAdmins.mockResolvedValue([{ id: 11, username: 'u11' }])
    updateMe.mockResolvedValue({ message: 'ok' })
    promoteUser.mockResolvedValue({ message: 'ok' })
    deleteUserByAdmin.mockResolvedValue({ message: 'ok' })
  })

  it('updates profile in UserView', async () => {
    const wrapper = mount(UserView, {
      global: { stubs: { AppMenu: { template: '<div />' } } },
    })
    await flushPromises()
    const editBtn = wrapper.findAll('button').find((b) => b.text().includes('Обновить'))
    await editBtn.trigger('click')
    const input = wrapper.find('input[placeholder="Новый username"]')
    await input.setValue('newname')
    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Сохранить'))
    await saveBtn.trigger('click')
    await flushPromises()
    expect(updateMe).toHaveBeenCalledWith({ username: 'newname' })
  })

  it('promotes and deletes in AdminView', async () => {
    const wrapper = mount(AdminView, {
      global: { stubs: { AppMenu: { template: '<div />' } } },
    })
    await flushPromises()
    const buttons = wrapper.findAll('button')
    await buttons.find((b) => b.text().includes('Сделать админом')).trigger('click')
    await buttons.find((b) => b.text().includes('Удалить')).trigger('click')
    await flushPromises()
    expect(promoteUser).toHaveBeenCalledWith(11)
    expect(deleteUserByAdmin).toHaveBeenCalledWith(11)
  })
})
