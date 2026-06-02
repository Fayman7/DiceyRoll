<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { fetchContacts, fetchMessages } from '../api'
import { connectSocket, getSocket } from '../socket'

const contacts = ref([])
const messages = ref([])
const selectedPartner = ref(null)
const activeChatId = ref(null)
const messageText = ref('')
const errorMessage = ref('')
const loadingContacts = ref(true)
const loadingMessages = ref(false)
const messagesContainer = ref(null)

const currentUserId = Number(localStorage.getItem('userId'))

function isOwnMessage(msg) {
    return Number(msg.user_id) === currentUserId
}

function scrollToBottom() {
    nextTick(() => {
        const el = messagesContainer.value
        if (el) {
            el.scrollTop = el.scrollHeight
        }
    })
}

function onReceiveMessage(msg) {
    if (activeChatId.value && Number(msg.chat_id) === Number(activeChatId.value)) {
        const exists = messages.value.some((m) => m.id === msg.id)
        if (!exists) {
            messages.value.push(msg)
            scrollToBottom()
        }
    }
}

function onSocketError(err) {
    errorMessage.value = typeof err === 'string' ? err : 'Ошибка сокета'
}

async function loadContacts() {
    loadingContacts.value = true
    errorMessage.value = ''
    try {
        contacts.value = await fetchContacts()
    } catch (err) {
        errorMessage.value = err.message
    } finally {
        loadingContacts.value = false
    }
}

async function selectPartner(partner) {
    if (selectedPartner.value?.id === partner.id) return

    const socket = getSocket()
    if (socket && activeChatId.value) {
        socket.emit('leave_chat', activeChatId.value)
    }

    selectedPartner.value = partner
    messages.value = []
    activeChatId.value = null
    loadingMessages.value = true
    errorMessage.value = ''

    try {
        const data = await fetchMessages(partner.id)
        activeChatId.value = data.chatId
        messages.value = data.messages || []
        scrollToBottom()

        if (socket) {
            socket.emit('join_chat', partner.id)
        }
    } catch (err) {
        errorMessage.value = err.message
        selectedPartner.value = null
    } finally {
        loadingMessages.value = false
    }
}

function sendMessage() {
    const text = messageText.value.trim()
    if (!text || !selectedPartner.value) return

    const socket = getSocket()
    if (!socket) {
        errorMessage.value = 'Нет подключения к чату'
        return
    }

    socket.emit('send_message', {
        partnerId: selectedPartner.value.id,
        text
    })
    messageText.value = ''
}

onMounted(async () => {
    await loadContacts()
    const socket = connectSocket()
    if (socket) {
        socket.on('receive_message', onReceiveMessage)
        socket.on('error', onSocketError)
        socket.on('chat_joined', (data) => {
            if (selectedPartner.value && Number(data.partnerId) === Number(selectedPartner.value.id)) {
                activeChatId.value = data.chatId
            }
        })
    }
})

onUnmounted(() => {
    const socket = getSocket()
    if (socket) {
        if (activeChatId.value) {
            socket.emit('leave_chat', activeChatId.value)
        }
        socket.off('receive_message', onReceiveMessage)
        socket.off('error', onSocketError)
        socket.off('chat_joined')
    }
})
</script>

<template>
    <div class="page chat-page">
        <h1>Чат</h1>
        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

        <div class="chat-layout">
            <aside class="contacts card">
                <h2>Контакты</h2>
                <p v-if="loadingContacts">Загрузка...</p>
                <p v-else-if="contacts.length === 0">Нет других пользователей</p>
                <button
                    v-for="contact in contacts"
                    :key="contact.id"
                    type="button"
                    class="label contact-btn"
                    :class="{ active: selectedPartner?.id === contact.id }"
                    @click="selectPartner(contact)"
                >
                    {{ contact.username }}
                </button>
            </aside>

            <section class="conversation card">
                <template v-if="selectedPartner">
                    <h2>{{ selectedPartner.username }}</h2>
                    <p v-if="loadingMessages">Загрузка сообщений...</p>
                    <div v-else ref="messagesContainer" class="messages">
                        <p v-if="messages.length === 0" class="empty">Нет сообщений. Напишите первым.</p>
                        <div
                            v-for="msg in messages"
                            :key="msg.id"
                            class="message"
                            :class="{ own: isOwnMessage(msg) }"
                        >
                            {{ msg.text }}
                        </div>
                    </div>
                    <form class="composer" @submit.prevent="sendMessage">
                        <input
                            v-model="messageText"
                            type="text"
                            placeholder="Сообщение..."
                            class="input"
                        />
                        <button type="submit" class="label">Отправить</button>
                    </form>
                </template>
                <p v-else class="placeholder">Выберите собеседника слева</p>
            </section>
        </div>
    </div>
</template>

<style scoped>
.chat-layout {
    display: flex;
    gap: 16px;
    width: 100%;
    max-width: 900px;
    min-height: 400px;
}

.contacts {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 180px;
}

.contact-btn {
    cursor: pointer;
    text-align: left;
    width: 100%;
}

.contact-btn.active {
    background: #1a0040cc;
}

.conversation {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
}

.messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: #11172d;
    max-height: 360px;
}

.message {
    max-width: 75%;
    padding: 8px 12px;
    border-radius: 16px;
    background: #0d002799;
    align-self: flex-start;
}

.message.own {
    align-self: flex-end;
    background: #1a0040cc;
}

.composer {
    display: flex;
    gap: 8px;
}

.input {
    flex: 1;
    max-width: none;
}

.placeholder,
.empty {
    opacity: 0.8;
}
</style>
