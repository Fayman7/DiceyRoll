import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RandomItemView from '../views/RandomItemView.vue'

vi.mock('../api', () => ({
  fetchItemLists: vi.fn(),
  generateRandomItem: vi.fn(),
  fetchItemGenerationHistory: vi.fn(),
  fetchMyItemLists: vi.fn(),
  fetchAllItemLists: vi.fn(),
  createItemList: vi.fn(),
  updateItemList: vi.fn(),
  deleteItemList: vi.fn(),
  parseJwtAdmin: vi.fn(() => false),
}))

import {
  fetchItemLists,
  generateRandomItem,
  fetchItemGenerationHistory,
  fetchMyItemLists,
  fetchAllItemLists,
  createItemList,
  parseJwtAdmin,
} from '../api'

describe('RandomItemView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    fetchItemLists.mockResolvedValue([
      { id: 1, name: 'Loot', items_count: 2, owner_username: 'u' },
    ])
    generateRandomItem.mockResolvedValue({ item: 'Potion' })
    fetchMyItemLists.mockResolvedValue([
      { id: 1, name: 'Loot', items: [{ id: 10, value: 'Potion' }] },
    ])
    fetchItemGenerationHistory.mockResolvedValue([
      { id: 1, list_name: 'Loot', item_value: 'Potion' },
    ])
    createItemList.mockResolvedValue({ id: 2, name: 'New', items_count: 1 })
  })

  it('guest sees generation section only', async () => {
    const wrapper = mount(RandomItemView, {
      global: { stubs: { AppMenu: { template: '<div />' } } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Генерация из списка')
    expect(wrapper.text()).not.toContain('Мои списки')
  })

  it('authenticated user sees CRUD section', async () => {
    localStorage.setItem('accessToken', 'token')
    const wrapper = mount(RandomItemView, {
      global: { stubs: { AppMenu: { template: '<div />' } } },
    })
    await flushPromises()
    expect(fetchMyItemLists).toHaveBeenCalled()
    expect(fetchItemGenerationHistory).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Мои списки')
    expect(wrapper.text()).toContain('История генерации')
  })

  it('admin sees user lists management section', async () => {
    localStorage.setItem('accessToken', 'token')
    localStorage.setItem('userId', '1')
    parseJwtAdmin.mockReturnValue(true)
    fetchAllItemLists.mockResolvedValue([
      {
        id: 2,
        name: 'Foreign',
        owner_id: 8,
        owner_username: 'user8',
        items: [{ id: 20, value: 'Gem' }],
      },
    ])

    const wrapper = mount(RandomItemView, {
      global: { stubs: { AppMenu: { template: '<div />' } } },
    })
    await flushPromises()

    expect(fetchAllItemLists).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Списки пользователей')
    expect(wrapper.text()).toContain('Владелец: user8')
    expect(wrapper.text()).toContain('Редактировать')
  })

  it('generates random item from selected list', async () => {
    const wrapper = mount(RandomItemView, {
      global: { stubs: { AppMenu: { template: '<div />' } } },
    })
    await flushPromises()
    const generateBtn = wrapper.findAll('button').find((b) => b.text().includes('Сгенерировать'))
    await generateBtn.trigger('click')
    await flushPromises()
    expect(generateRandomItem).toHaveBeenCalledWith(1)
    expect(wrapper.text()).toContain('Результат: Potion')
  })
})
