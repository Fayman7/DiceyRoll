import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ImagesView from '../views/ImagesView.vue'

vi.mock('../api', () => ({
  fetchSharedImages: vi.fn(),
  fetchMyImages: vi.fn(),
  fetchImagesSharedBy: vi.fn(),
  fetchContacts: vi.fn(),
  shareImage: vi.fn(),
  deleteImage: vi.fn(),
  uploadImage: vi.fn(),
  parseJwtAdmin: vi.fn(() => false),
}))

import { fetchSharedImages, fetchContacts } from '../api'

describe('ImagesView', () => {
  beforeEach(() => {
    localStorage.setItem('userId', '8')
    fetchContacts.mockResolvedValue([{ id: 10, username: 'other' }])
    fetchSharedImages.mockResolvedValue([
      { img_id: 1, img_url: 'x.png', owner_id: 10, from_username: 'other' },
    ])
  })

  it('loads shared images by default', async () => {
    const wrapper = mount(ImagesView, {
      global: { stubs: { AppMenu: { template: '<div />' } } },
    })
    await flushPromises()
    expect(fetchSharedImages).toHaveBeenCalled()
    expect(wrapper.text()).toContain('От: other')
  })

  it('closes fullscreen on Escape key', async () => {
    const wrapper = mount(ImagesView, {
      global: { stubs: { AppMenu: { template: '<div />' } } },
    })
    await flushPromises()
    await wrapper.find('.thumb').trigger('click')
    expect(wrapper.find('.fullscreen-overlay').exists()).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('.fullscreen-overlay').exists()).toBe(false)
  })
})
