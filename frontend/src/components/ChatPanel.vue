<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { fetchMessages, deleteChatByPartner } from '../api'
import { connectSocket, getSocket } from '../socket'

const props = defineProps({
    partnerId: { type: Number, required: true },
    partnerName: { type: String, default: '' },
})
const emit = defineEmits(['chat-deleted'])

const messages = ref([])
const activeChatId = ref(null)
const messageText = ref('')
const errorMessage = ref('')
const messagesContainer = ref(null)

const currentUserId = Number(localStorage.getItem('userId'))

function isOwnMessage(msg) {
    return Number(msg.user_id) === currentUserId
}

function scrollToBottom() {
    nextTick(() => {
        const el = messagesContainer.value
        if (el) el.scrollTop = el.scrollHeight
    })
}

function onReceiveMessage(msg) {
    if (activeChatId.value && Number(msg.chat_id) === Number(activeChatId.value)) {
        if (!messages.value.some((m) => m.id === msg.id)) {
            messages.value.push(msg)
            scrollToBottom()
        }
    }
}

async function openChat() {
    messages.value = []
    activeChatId.value = null
    errorMessage.value = ''
    const socket = connectSocket()
    if (!socket) {
        errorMessage.value = 'Нет подключения'
        return
    }
    try {
        const data = await fetchMessages(props.partnerId)
        activeChatId.value = data.chatId
        messages.value = data.messages || []
        scrollToBottom()
        socket.emit('join_chat', props.partnerId)
    } catch (err) {
        errorMessage.value = err.message
    }
}

function sendMessage() {
    const text = messageText.value.trim()
    if (!text) return
    const socket = getSocket()
    if (!socket) return
    socket.emit('send_message', { partnerId: props.partnerId, text })
    messageText.value = ''
}

async function removeChat() {
    try {
        await deleteChatByPartner(props.partnerId)
        const socket = getSocket()
        if (socket && activeChatId.value) {
            socket.emit('leave_chat', activeChatId.value)
        }
        activeChatId.value = null
        messages.value = []
        messageText.value = ''
        errorMessage.value = ''
        emit('chat-deleted', props.partnerId)
    } catch (err) {
        errorMessage.value = err.message
    }
}

watch(
    () => props.partnerId,
    () => {
        if (props.partnerId) openChat()
    },
    { immediate: true }
)

onMounted(() => {
    const socket = connectSocket()
    if (socket) {
        socket.on('receive_message', onReceiveMessage)
    }
})

onUnmounted(() => {
    const socket = getSocket()
    if (socket) {
        if (activeChatId.value) socket.emit('leave_chat', activeChatId.value)
        socket.off('receive_message', onReceiveMessage)
    }
})
</script>

<template>
    <div class="chat-panel card">
        <h3>Чат с {{ partnerName || 'участником' }}</h3>
        <button type="button" class="label danger" @click="removeChat">Удалить чат</button>
        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
        <div ref="messagesContainer" class="messages">
            <p v-if="!messages.length" class="muted">Нет сообщений</p>
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
            <input v-model="messageText" type="text" placeholder="Сообщение..." class="input" />
            <button type="submit" class="label">Отправить</button>
        </form>
    </div>
</template>

<style scoped>
.chat-panel {
    margin-top: 12px;
}
.messages {
    max-height: 200px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 8px 0;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px;
    background: #11172d;
}
.message {
    max-width: 80%;
    padding: 6px 10px;
    border-radius: 12px;
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
    align-items: center;
}
.input {
    flex: 1;
    max-width: none;
}
</style>
