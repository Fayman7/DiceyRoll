<script setup>
import { onMounted, ref } from 'vue'
import { apiFetch } from '../api'

const title = ref('')
const file = ref(null)
const isUploading = ref(false)
const statusMessage = ref('')
const error = ref('')
const images = ref([])

async function fetchImages() {
  try {
    const response = await apiFetch('http://localhost:4242/api/images')
    if (response.ok) {
      images.value = await response.json()
      console.log('Полученные изображения:', images.value)
    }
  } catch (error) {
    console.error('Ошибка при получении изображений:', error)
  }
}

function handleFileChange(event) {
  file.value = event.target.files[0]
  if (file.value) {
    statusMessage.value = `Выбран файл: ${file.value.name}`
  } else {
    statusMessage.value = 'Файл не выбран'
  }
}

async function uploadImage() {
  if (!file.value) {
    statusMessage.value = 'Пожалуйста, выберите файл для загрузки'
    return
  }

  isUploading.value = true
  statusMessage.value = ''

  const formData = new FormData()
  formData.append('title', title.value)
  formData.append('image', file.value)

  try {
    const response = await apiFetch('http://localhost:4242/api/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      statusMessage.value = `Успех: ${data.message}`
      await fetchImages()
    } else {
      const errorData = await response.json()
      statusMessage.value = `Ошибка: ${errorData.message}. ${errorData.error}`
    }
  } catch (error) {
    statusMessage.value = `Ошибка сети: ${error.message}`
  } finally {
    isUploading.value = false
  }
}

async function deleteImage(id) {
  try {
    const response = await apiFetch(`http://localhost:4242/api/images/${id}`, {
      method: 'DELETE'
    })
    if (response.ok) {
      images.value = images.value.filter(img => img.img_id !== id);
      statusMessage.value = 'Изображение удалено';
    }
    else {
      errorData = await response.json()
      statusMessage.value = `Ошибка при удалении: ${errorData.message}`
    }
  } catch (err) {
    statusMessage.value = `Ошибка сети: ${error.message}`
  }
}

onMounted(fetchImages)
</script>

<template>
  <div class="upload-form">
    <h3>Загрузка изображения</h3>
    
    <div class="form-group">
      <input 
        type="text" 
        v-model="title" 
        placeholder="Введите название изображения"
      />
    </div>

    <div class="form-group">
      <input 
        type="file" 
        @change="handleFileChange" 
        accept="image/jpeg, image/png" 
      />
    </div>

    <button 
      @click="uploadImage" 
      :disabled="isUploading"
    >
      {{ isUploading ? 'Загрузка...' : 'Отправить' }}
    </button>

    <p v-if="statusMessage" class="status">{{ statusMessage }}</p>
  </div>
  <div class="images-list">
    <h2>Загруженные изображения</h2>
    <div v-for="image in images" :key="image.img_id">
      <img :src="`http://localhost:4242/uploads/${image.img_url}`" alt="загруженное изображение" class="uploaded-image" />
      <button @click="deleteImage(image.img_id)">Удалить</button>
    </div>
  </div>  
</template>

<style scoped>
.images-list {
  display: grid;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}
.uploaded-image {
  max-width: 200px;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  margin: 10px;
}
</style>