<script setup>
import { ref, onMounted } from 'vue'
import AppMenu from '../components/AppMenu.vue'
import ChatPanel from '../components/ChatPanel.vue'
import {
    fetchGameRooms,
    createGameRoom,
    fetchRoomMembers,
    addRoomMember,
    fetchContacts,
    deleteGameRoom,
} from '../api'

const rooms = ref([])
const contacts = ref([])
const selectedRoom = ref(null)
const members = ref([])
const roomName = ref('')
const selectedMemberIds = ref([])
const addMemberId = ref('')
const chatPartner = ref(null)
const statusMessage = ref('')

const currentUserId = Number(localStorage.getItem('userId'))

async function loadRooms() {
    try {
        rooms.value = await fetchGameRooms()
    } catch (err) {
        statusMessage.value = err.message
    }
}

async function loadContacts() {
    try {
        contacts.value = await fetchContacts()
    } catch (err) {
        console.error(err)
    }
}

async function createRoom() {
    if (!roomName.value.trim()) {
        statusMessage.value = 'Введите название'
        return
    }
    try {
        await createGameRoom(roomName.value.trim(), selectedMemberIds.value)
        roomName.value = ''
        selectedMemberIds.value = []
        statusMessage.value = 'Комната создана'
        await loadRooms()
    } catch (err) {
        statusMessage.value = err.message
    }
}

async function selectRoom(room) {
    selectedRoom.value = room
    chatPartner.value = null
    try {
        members.value = await fetchRoomMembers(room.id)
    } catch (err) {
        statusMessage.value = err.message
    }
}

async function addMember() {
    if (!addMemberId.value || !selectedRoom.value) return
    try {
        await addRoomMember(selectedRoom.value.id, Number(addMemberId.value))
        addMemberId.value = ''
        members.value = await fetchRoomMembers(selectedRoom.value.id)
        statusMessage.value = 'Участник добавлен'
    } catch (err) {
        statusMessage.value = err.message
    }
}

async function removeRoom() {
    if (!selectedRoom.value) return
    try {
        await deleteGameRoom(selectedRoom.value.id)
        statusMessage.value = 'Комната удалена'
        selectedRoom.value = null
        members.value = []
        chatPartner.value = null
        await loadRooms()
    } catch (err) {
        statusMessage.value = err.message
    }
}

function openChat(member) {
    if (Number(member.id) === currentUserId) return
    chatPartner.value = member
}

function onChatDeleted(partnerId) {
    if (chatPartner.value && Number(chatPartner.value.id) === Number(partnerId)) {
        chatPartner.value = null
        statusMessage.value = 'Чат удален'
    }
}

onMounted(async () => {
    await loadContacts()
    await loadRooms()
})
</script>

<template>
    <div class="page">
        <h1>Игра</h1>
        <AppMenu />
        <p v-if="statusMessage" class="status">{{ statusMessage }}</p>

        <section class="card create-room">
            <h2>Создать комнату</h2>
            <input v-model="roomName" type="text" placeholder="Название комнаты" class="input" />
            <div class="members-pick">
                <label v-for="c in contacts" :key="c.id" class="check">
                    <input v-model="selectedMemberIds" type="checkbox" :value="c.id" />
                    {{ c.username }}
                </label>
            </div>
            <button type="button" class="label" @click="createRoom">Создать</button>
        </section>

        <div class="layout">
            <aside class="card rooms">
                <h2>Мои комнаты</h2>
                <button
                    v-for="room in rooms"
                    :key="room.id"
                    type="button"
                    class="label room-btn"
                    :class="{ active: selectedRoom?.id === room.id }"
                    @click="selectRoom(room)"
                >
                    {{ room.name }}
                </button>
                <p v-if="!rooms.length" class="muted">Нет комнат</p>
            </aside>

            <section v-if="selectedRoom" class="card room-detail">
                <h2>{{ selectedRoom.name }}</h2>
                <button
                    v-if="Number(selectedRoom.created_by) === currentUserId"
                    type="button"
                    class="label small danger"
                    @click="removeRoom"
                >
                    Удалить комнату
                </button>
                <h3>Участники</h3>
                <ul class="member-list">
                    <li v-for="m in members" :key="m.id" class="member-row">
                        <span>{{ m.username }}{{ Number(m.id) === currentUserId ? ' (вы)' : '' }}</span>
                        <button
                            v-if="Number(m.id) !== currentUserId"
                            type="button"
                            class="label small"
                            @click="openChat(m)"
                        >
                            Написать
                        </button>
                    </li>
                </ul>
                <div class="add-member">
                    <select v-model="addMemberId" class="select">
                        <option value="">Добавить участника...</option>
                        <option
                            v-for="c in contacts.filter((x) => !members.some((m) => m.id === x.id))"
                            :key="c.id"
                            :value="c.id"
                        >
                            {{ c.username }}
                        </option>
                    </select>
                    <button type="button" class="label small" @click="addMember">Добавить</button>
                </div>
                <ChatPanel
                    v-if="chatPartner"
                    :partner-id="Number(chatPartner.id)"
                    :partner-name="chatPartner.username"
                    @chat-deleted="onChatDeleted"
                />
            </section>
            <p v-else class="muted">Выберите комнату</p>
        </div>
    </div>
</template>

<style scoped>
.create-room {
    width: 100%;
    max-width: 980px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
}
.members-pick {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
}
.check {
    display: flex;
    align-items: center;
    gap: 4px;
}
.layout {
    display: grid;
    grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
    gap: 14px;
    width: 100%;
    max-width: 980px;
    align-items: start;
}
.rooms {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
}
.room-btn {
    width: 100%;
    text-align: left;
    display: block;
}
.room-detail {
    width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.member-list {
    list-style: none;
    padding: 0;
    margin: 0;
    width: 100%;
}
.member-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
}
.add-member {
    display: flex;
    gap: 8px;
    margin: 12px 0;
    flex-wrap: wrap;
    justify-content: flex-start;
}
.select {
    min-width: 220px;
}

@media (max-width: 900px) {
    .layout {
        grid-template-columns: 1fr;
    }
}
</style>
