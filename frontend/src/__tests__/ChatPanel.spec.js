import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ChatPanel from '../components/ChatPanel.vue'

const socketMock = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
}

vi.mock('../api', () => ({
  fetchMessages: vi.fn(),
  deleteChatByPartner: vi.fn(),
}))
vi.mock('../socket', () => ({
  connectSocket: vi.fn(() => socketMock),
  getSocket: vi.fn(() => socketMock),
}))

import { fetchMessages, deleteChatByPartner } from '../api'

describe('ChatPanel', () => {
  beforeEach(() => {
    localStorage.setItem('userId', '8')
    fetchMessages.mockResolvedValue({
      chatId: 3,
      messages: [{ id: 1, chat_id: 3, user_id: 8, text: 'hi' }],
    })
    deleteChatByPartner.mockResolvedValue({ message: 'ok' })
    socketMock.emit.mockReset()
  })

  it('loads messages and sends message event', async () => {
    const wrapper = mount(ChatPanel, { props: { partnerId: 10, partnerName: 'u' } })
    await flushPromises()
    await wrapper.find('input').setValue('hello')
    await wrapper.find('form').trigger('submit.prevent')
    expect(socketMock.emit).toHaveBeenCalledWith('send_message', { partnerId: 10, text: 'hello' })
  })

  it('deletes chat and emits chat-deleted', async () => {
    const wrapper = mount(ChatPanel, { props: { partnerId: 10, partnerName: 'u' } })
    await flushPromises()
    const btn = wrapper.findAll('button').find((b) => b.text().includes('Удалить чат'))
    await btn.trigger('click')
    await flushPromises()
    expect(deleteChatByPartner).toHaveBeenCalledWith(10)
    expect(wrapper.emitted()['chat-deleted']).toBeTruthy()
  })
})
