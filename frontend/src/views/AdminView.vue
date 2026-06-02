<script setup>
import { ref, onMounted } from 'vue'
import AppMenu from '../components/AppMenu.vue'
import { fetchMe, fetchNonAdmins, promoteUser, deleteUserByAdmin } from '../api'

const adminName = ref('')
const usersList = ref([])
const statusMessage = ref('')

async function load() {
    try {
        const me = await fetchMe()
        adminName.value = me.username
        usersList.value = await fetchNonAdmins()
    } catch (err) {
        statusMessage.value = err.message
    }
}

async function onPromote(id) {
    try {
        await promoteUser(id)
        statusMessage.value = 'Пользователь назначен администратором'
        await load()
    } catch (err) {
        statusMessage.value = err.message
    }
}

async function onDelete(id) {
    try {
        await deleteUserByAdmin(id)
        statusMessage.value = 'Пользователь удалён'
        await load()
    } catch (err) {
        statusMessage.value = err.message
    }
}

onMounted(load)
</script>

<template>
    <div class="page">
        <h1>Панель администратора</h1>
        <AppMenu />
        <p>Админ: {{ adminName }}</p>
        <p v-if="statusMessage" class="status">{{ statusMessage }}</p>

        <h2>Пользователи</h2>
        <table v-if="usersList.length" class="table card">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Имя</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="user in usersList" :key="user.id">
                    <td>{{ user.id }}</td>
                    <td>{{ user.username }}</td>
                    <td class="actions">
                        <button type="button" class="label small" @click="onPromote(user.id)">
                            Сделать админом
                        </button>
                        <button type="button" class="label small danger" @click="onDelete(user.id)">
                            Удалить
                        </button>
                    </td>
                </tr>
            </tbody>
        </table>
        <p v-else class="muted">Нет пользователей для управления</p>
    </div>
</template>

<style scoped>
.actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}
</style>
