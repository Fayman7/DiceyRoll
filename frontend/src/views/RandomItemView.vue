<script setup>
import { ref, onMounted, computed } from 'vue'
import AppMenu from '../components/AppMenu.vue'
import {
    fetchItemLists,
    generateRandomItem,
    fetchItemGenerationHistory,
    fetchMyItemLists,
    fetchAllItemLists,
    createItemList,
    updateItemList,
    deleteItemList,
    parseJwtAdmin,
} from '../api'

const isAuthenticated = computed(() => !!localStorage.getItem('accessToken'))
const isAdmin = ref(false)
const currentUserId = Number(localStorage.getItem('userId'))

const publicLists = ref([])
const selectedListId = ref('')
const randomResult = ref('')
const randomError = ref('')
const generationHistory = ref([])

const myLists = ref([])
const userLists = ref([])
const statusMessage = ref('')
const editListId = ref(null)

const createForm = ref({ name: '', itemsText: '' })
const editForm = ref({ name: '', itemsText: '' })

function toItems(text) {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
}

async function loadPublicLists() {
    try {
        publicLists.value = await fetchItemLists()
        if (!selectedListId.value && publicLists.value.length) {
            selectedListId.value = String(publicLists.value[0].id)
        }
    } catch (err) {
        randomError.value = err.message
    }
}

async function loadMyLists() {
    if (!isAuthenticated.value) return
    try {
        myLists.value = await fetchMyItemLists()
    } catch (err) {
        statusMessage.value = err.message
    }
}

async function loadUserLists() {
    if (!isAdmin.value) return
    try {
        const lists = await fetchAllItemLists()
        userLists.value = lists.filter((list) => Number(list.owner_id) !== currentUserId)
    } catch (err) {
        statusMessage.value = err.message
    }
}

async function reloadLists() {
    await Promise.all([loadMyLists(), loadPublicLists(), loadUserLists()])
}

async function loadGenerationHistory() {
    if (!isAuthenticated.value) return
    try {
        generationHistory.value = await fetchItemGenerationHistory()
    } catch (err) {
        statusMessage.value = err.message
    }
}

async function onGenerate() {
    randomError.value = ''
    randomResult.value = ''
    if (!selectedListId.value) {
        randomError.value = 'Выберите список'
        return
    }
    try {
        const data = await generateRandomItem(Number(selectedListId.value))
        randomResult.value = data.item
        await loadGenerationHistory()
    } catch (err) {
        randomError.value = err.message
    }
}

async function onCreateList() {
    statusMessage.value = ''
    const name = createForm.value.name.trim()
    const items = toItems(createForm.value.itemsText)
    if (!name) {
        statusMessage.value = 'Укажите название списка'
        return
    }
    try {
        await createItemList({ name, items })
        createForm.value = { name: '', itemsText: '' }
        statusMessage.value = 'Список создан'
        await reloadLists()
    } catch (err) {
        statusMessage.value = err.message
    }
}

function startEdit(list) {
    editListId.value = list.id
    editForm.value = {
        name: list.name,
        itemsText: (list.items || []).map((item) => item.value).join('\n'),
    }
}

function cancelEdit() {
    editListId.value = null
    editForm.value = { name: '', itemsText: '' }
}

async function saveEdit(listId) {
    const name = editForm.value.name.trim()
    const items = toItems(editForm.value.itemsText)
    if (!name) {
        statusMessage.value = 'Укажите название списка'
        return
    }
    try {
        await updateItemList(listId, { name, items })
        statusMessage.value = 'Список обновлен'
        cancelEdit()
        await reloadLists()
    } catch (err) {
        statusMessage.value = err.message
    }
}

async function removeList(listId) {
    try {
        await deleteItemList(listId)
        statusMessage.value = 'Список удален'
        if (String(listId) === selectedListId.value) {
            selectedListId.value = ''
            randomResult.value = ''
        }
        await reloadLists()
    } catch (err) {
        statusMessage.value = err.message
    }
}

onMounted(async () => {
    isAdmin.value = parseJwtAdmin()
    await loadPublicLists()
    await loadMyLists()
    await loadUserLists()
    await loadGenerationHistory()
})
</script>

<template>
    <div class="page">
        <h1>Случайный предмет</h1>
        <AppMenu />

        <section class="card section">
            <h2>Генерация из списка</h2>
            <select v-model="selectedListId" class="select">
                <option value="">Выберите список</option>
                <option v-for="list in publicLists" :key="list.id" :value="String(list.id)">
                    {{ list.name }} ({{ list.items_count }})
                </option>
            </select>
            <button type="button" class="label" @click="onGenerate">Сгенерировать</button>
            <p v-if="randomResult" class="status">Результат: {{ randomResult }}</p>
            <p v-if="randomError" class="error">{{ randomError }}</p>
            <p v-if="!publicLists.length" class="muted">Пока нет публичных списков</p>
        </section>

        <section v-if="isAuthenticated" class="card section">
            <h2>История генерации</h2>
            <ul v-if="generationHistory.length" class="items-list">
                <li v-for="entry in generationHistory" :key="entry.id">
                    [{{ entry.list_name }}] → {{ entry.item_value }}
                </li>
            </ul>
            <p v-else class="muted">Пока нет истории генерации</p>
        </section>

        <section v-if="isAuthenticated" class="card section">
            <h2>Мои списки</h2>
            <div class="create-form">
                <input v-model="createForm.name" type="text" class="input" placeholder="Название списка" />
                <textarea
                    v-model="createForm.itemsText"
                    class="textarea"
                    rows="5"
                    placeholder="Предметы по одному в строке"
                />
                <button type="button" class="label" @click="onCreateList">Создать список</button>
            </div>

            <p v-if="statusMessage" class="status">{{ statusMessage }}</p>

            <div v-if="myLists.length" class="lists-wrap">
                <article v-for="list in myLists" :key="list.id" class="card list-card">
                    <template v-if="editListId === list.id">
                        <input v-model="editForm.name" type="text" class="input" />
                        <textarea v-model="editForm.itemsText" class="textarea" rows="5" />
                        <div class="row">
                            <button type="button" class="label small" @click="saveEdit(list.id)">Сохранить</button>
                            <button type="button" class="label small" @click="cancelEdit">Отмена</button>
                        </div>
                    </template>
                    <template v-else>
                        <h3>{{ list.name }}</h3>
                        <ul class="items-list">
                            <li v-for="item in list.items" :key="item.id">{{ item.value }}</li>
                        </ul>
                        <div class="row">
                            <button type="button" class="label small" @click="startEdit(list)">Редактировать</button>
                            <button type="button" class="label small danger" @click="removeList(list.id)">Удалить</button>
                        </div>
                    </template>
                </article>
            </div>
            <p v-else class="muted">У вас пока нет списков</p>
        </section>

        <section v-if="isAdmin" class="card section">
            <h2>Списки пользователей</h2>
            <div v-if="userLists.length" class="lists-wrap">
                <article v-for="list in userLists" :key="`user-${list.id}`" class="card list-card">
                    <template v-if="editListId === list.id">
                        <input v-model="editForm.name" type="text" class="input" />
                        <textarea v-model="editForm.itemsText" class="textarea" rows="5" />
                        <div class="row">
                            <button type="button" class="label small" @click="saveEdit(list.id)">Сохранить</button>
                            <button type="button" class="label small" @click="cancelEdit">Отмена</button>
                        </div>
                    </template>
                    <template v-else>
                        <h3>{{ list.name }}</h3>
                        <p class="muted">Владелец: {{ list.owner_username }}</p>
                        <ul class="items-list">
                            <li v-for="item in list.items" :key="item.id">{{ item.value }}</li>
                        </ul>
                        <div class="row">
                            <button type="button" class="label small" @click="startEdit(list)">Редактировать</button>
                            <button type="button" class="label small danger" @click="removeList(list.id)">Удалить</button>
                        </div>
                    </template>
                </article>
            </div>
            <p v-else class="muted">Нет списков других пользователей</p>
        </section>
    </div>
</template>

<style scoped>
.section {
    max-width: 720px;
}
.create-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.textarea {
    width: 100%;
    max-width: 100%;
    padding: 9px 11px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: #11172d;
    color: var(--text);
    resize: vertical;
}
.lists-wrap {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
    width: 100%;
}
.list-card {
    align-items: flex-start;
}
.items-list {
    margin: 0;
    padding-left: 18px;
    text-align: left;
}
.row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}
</style>
