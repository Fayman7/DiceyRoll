<script setup>
import { ref, onMounted } from 'vue'
import AppMenu from '../components/AppMenu.vue'
import { apiFetch, fetchMe, updateMe, logout } from '../api'

const API_BASE = 'http://localhost:4242'

const userId = ref(null)
const username = ref('')
const editMode = ref(false)
const form = ref({ username: '', password: '' })
const statusMessage = ref('')

onMounted(async () => {
    try {
        const data = await fetchMe()
        userId.value = data.id
        username.value = data.username
        form.value.username = data.username
    } catch (err) {
        statusMessage.value = err.message
    }
})

function toggleEdit() {
    editMode.value = !editMode.value
    if (editMode.value) {
        form.value.username = username.value
        form.value.password = ''
    }
}

async function saveProfile() {
    const body = {}
    if (form.value.username?.trim()) body.username = form.value.username.trim()
    if (form.value.password?.trim()) body.password = form.value.password.trim()
    if (!body.username && !body.password) {
        statusMessage.value = 'Нет данных для обновления'
        return
    }
    try {
        await updateMe(body)
        username.value = body.username || username.value
        statusMessage.value = 'Данные обновлены'
        editMode.value = false
    } catch (err) {
        statusMessage.value = err.message
    }
}

async function deleteUser() {
    try {
        const response = await apiFetch(`${API_BASE}/me`, { method: 'DELETE' })
        if (response.ok) logout()
        else throw new Error('Не удалось удалить')
    } catch (err) {
        statusMessage.value = err.message
    }
}
</script>

<template>
    <div class="page">
        <h1>Профиль</h1>
        <AppMenu />
        <p v-if="statusMessage" class="status">{{ statusMessage }}</p>

        <div id="sector" class="card">
            <p class="label">ID: {{ userId }}</p>
            <p class="label">Юзернейм: {{ username }}</p>

            <template v-if="editMode">
                <input v-model="form.username" type="text" placeholder="Новый username" class="input" />
                <input
                    v-model="form.password"
                    type="password"
                    placeholder="Новый пароль (необязательно)"
                    class="input"
                />
                <button type="button" class="label" @click="saveProfile">Сохранить</button>
                <button type="button" class="label" @click="toggleEdit">Отмена</button>
            </template>
            <template v-else>
                <button type="button" class="label" @click="toggleEdit">Обновить &gt;</button>
            </template>

            <button type="button" class="label danger" @click="deleteUser">Удалить аккаунт</button>
        </div>
    </div>
</template>

<style scoped>
#sector {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    max-width: 520px;
}
</style>
