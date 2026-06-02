import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RandomItemView from '../views/RandomItemView.vue'

vi.mock('../api', () => ({
  fetchItemLists: vi.fn(),
  generateRandomItem: vi.fn(),
  fetchItemGenerationHistory: vi.fn(),
  fetchMyItemLists: vi.fn(),
  createItemList: vi.fn(),
  updateItemList: vi.fn(),
  deleteItemList: vi.fn(),
}))

import {
  fetchItemLists,
  generateRandomItem,
  fetchItemGenerationHistory,
  fetchMyItemLists,
  createItemList,
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
