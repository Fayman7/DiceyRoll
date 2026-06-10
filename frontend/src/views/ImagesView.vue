<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppMenu from '../components/AppMenu.vue'
import {
    fetchAllImages,
    fetchSharedImages,
    fetchMyImages,
    fetchImagesSharedBy,
    fetchContacts,
    shareImage,
    deleteImage,
    uploadImage,
    parseJwtAdmin,
} from '../api'

const API_BASE = 'http://localhost:4242'

const activeFilter = ref('shared')
const images = ref([])
const contacts = ref([])
const fromUserId = ref('')
const statusMessage = ref('')
const file = ref(null)
const isUploading = ref(false)
const shareTargetByImg = ref({})
const isAdmin = ref(false)
const fullscreenImage = ref('')

const filters = computed(() => {
    const base = [
        { id: 'shared', label: 'Поделились со мной' },
        { id: 'mine', label: 'Мои загрузки' },
        { id: 'from', label: 'От пользователя' },
    ]
    if (isAdmin.value) {
        return [{ id: 'all', label: 'Все изображения' }, ...base]
    }
    return base
})

const currentUserId = Number(localStorage.getItem('userId'))

async function loadContacts() {
    try {
        contacts.value = await fetchContacts()
    } catch (err) {
        console.error(err)
    }
}

async function loadImages() {
    statusMessage.value = ''
    try {
        if (activeFilter.value === 'all') {
            images.value = await fetchAllImages()
        } else if (activeFilter.value === 'shared') {
            images.value = await fetchSharedImages()
        } else if (activeFilter.value === 'mine') {
            images.value = await fetchMyImages()
        } else if (activeFilter.value === 'from' && fromUserId.value) {
            images.value = await fetchImagesSharedBy(fromUserId.value)
        } else {
            images.value = []
        }
    } catch (err) {
        statusMessage.value = err.message
    }
}

function setFilter(id) {
    activeFilter.value = id
    loadImages()
}

function handleFileChange(event) {
    file.value = event.target.files[0]
}

async function upload() {
    if (!file.value) {
        statusMessage.value = 'Выберите файл'
        return
    }
    isUploading.value = true
    const formData = new FormData()
    formData.append('image', file.value)
    try {
        await uploadImage(formData)
        statusMessage.value = 'Файл загружен'
        file.value = null
        if (activeFilter.value === 'mine') await loadImages()
    } catch (err) {
        statusMessage.value = err.message
    } finally {
        isUploading.value = false
    }
}

async function onShare(imgId) {
    const toUserId = shareTargetByImg.value[imgId]
    if (!toUserId) {
        statusMessage.value = 'Выберите пользователя'
        return
    }
    try {
        await shareImage(imgId, Number(toUserId))
        statusMessage.value = 'Изображение отправлено'
    } catch (err) {
        statusMessage.value = err.message
    }
}

async function onDelete(imgId) {
    try {
        await deleteImage(imgId)
        images.value = images.value.filter((i) => i.img_id !== imgId)
        statusMessage.value = 'Удалено'
    } catch (err) {
        statusMessage.value = err.message
    }
}

function canDelete(image) {
    return isAdmin.value || Number(image.owner_id) === currentUserId
}

function imageLabel(image) {
    if (activeFilter.value === 'mine') return 'Моё'
    if (activeFilter.value === 'all') return `Владелец: ${image.owner_username}`
    return `От: ${image.from_username}`
}

function openFullscreen(imgUrl) {
    fullscreenImage.value = `${API_BASE}/uploads/${imgUrl}`
}

function closeFullscreen() {
    fullscreenImage.value = ''
}

function onKeyDown(event) {
    if (event.key === 'Escape' && fullscreenImage.value) {
        closeFullscreen()
    }
}

onMounted(async () => {
    isAdmin.value = parseJwtAdmin()
    if (isAdmin.value) {
        activeFilter.value = 'all'
    }
    window.addEventListener('keydown', onKeyDown)
    await loadContacts()
    await loadImages()
})

onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
    <div class="page">
        <h1>Изображения</h1>
        <AppMenu />

        <div class="card filters">
            <button
                v-for="f in filters"
                :key="f.id"
                type="button"
                class="label"
                :class="{ active: activeFilter === f.id }"
                @click="setFilter(f.id)"
            >
                {{ f.label }}
            </button>
        </div>

        <div v-if="activeFilter === 'from'" class="card from-select">
            <select v-model="fromUserId" class="select" @change="loadImages">
                <option value="">Выберите пользователя</option>
                <option v-for="c in contacts" :key="c.id" :value="c.id">
                    {{ c.username }}
                </option>
            </select>
        </div>

        <div v-if="activeFilter === 'mine'" class="card upload-form">
            <input type="file" accept="image/jpeg, image/png" @change="handleFileChange" />
            <button type="button" class="label" :disabled="isUploading" @click="upload">
                {{ isUploading ? 'Загрузка...' : 'Загрузить' }}
            </button>
        </div>

        <p v-if="statusMessage" class="status">{{ statusMessage }}</p>

        <div class="grid">
            <div v-for="image in images" :key="image.img_id" class="card">
                <img
                    :src="`${API_BASE}/uploads/${image.img_url}`"
                    alt=""
                    class="thumb"
                    @click="openFullscreen(image.img_url)"
                />
                <p class="caption">{{ imageLabel(image) }}</p>
                <div v-if="activeFilter === 'mine'" class="share-row">
                    <select v-model="shareTargetByImg[image.img_id]" class="select">
                        <option :value="''">Поделиться с...</option>
                        <option v-for="c in contacts" :key="c.id" :value="c.id">
                            {{ c.username }}
                        </option>
                    </select>
                    <button type="button" class="label small" @click="onShare(image.img_id)">
                        Отправить
                    </button>
                </div>
                <button
                    v-if="canDelete(image)"
                    type="button"
                    class="label danger small"
                    @click="onDelete(image.img_id)"
                >
                    Удалить
                </button>
            </div>
        </div>
        <p v-if="!images.length" class="muted">Нет изображений для этого фильтра</p>

        <div v-if="fullscreenImage" class="fullscreen-overlay" @click="closeFullscreen">
            <button type="button" class="label danger fullscreen-close" @click.stop="closeFullscreen">
                Закрыть
            </button>
            <img :src="fullscreenImage" alt="Полноразмерное изображение" class="fullscreen-image" @click.stop />
        </div>
    </div>
</template>

<style scoped>
.filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-start;
}
.grid {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: flex-start;
    width: 100%;
}
.card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    max-width: 250px;
}
.thumb {
    width: 220px;
    height: 220px;
    object-fit: cover;
    border-radius: 8px;
    cursor: zoom-in;
}
.select {
    max-width: 220px;
}
.share-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
}

.fullscreen-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    padding: 24px;
}

.fullscreen-image {
    max-width: min(95vw, 1400px);
    max-height: 90vh;
    object-fit: contain;
    border-radius: 10px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

.fullscreen-close {
    position: absolute;
    top: 20px;
    right: 20px;
}
</style>
