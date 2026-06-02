import { disconnectSocket } from './socket'

const API_BASE = 'http://localhost:4242'

export async function apiFetch(endpoint, options = {}) {
    const accessToken = localStorage.getItem('accessToken')

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    }

    if (options.body instanceof FormData) {
        delete headers['Content-Type']
    }

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
    }

    let response = await fetch(`${endpoint}`, {
        ...options,
        headers,
    })

    if (response.status === 401) {
        const refreshed = await refreshTokens()

        if (refreshed) {
            const newAccessToken = localStorage.getItem('accessToken')
            headers['Authorization'] = `Bearer ${newAccessToken}`
            response = await fetch(`${endpoint}`, {
                ...options,
                headers,
            })
        } else {
            logout()
        }
    }
    return response
}

async function refreshTokens() {
    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) return false

    try {
        const res = await fetch(`${API_BASE}/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        })

        if (res.ok) {
            const data = await res.json()
            localStorage.setItem('accessToken', data.accessToken)
            localStorage.setItem('refreshToken', data.refreshToken)
            return true
        }
    } catch (err) {
        console.error('Ошибка при обновлении токена', err)
    }
    return false
}

export async function fetchContacts() {
    const response = await apiFetch(`${API_BASE}/api/contacts`)
    if (!response.ok) throw new Error('Не удалось загрузить контакты')
    return response.json()
}

export async function fetchMessages(partnerId) {
    const response = await apiFetch(`${API_BASE}/api/messages/${partnerId}`)
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Не удалось загрузить сообщения')
    }
    return response.json()
}

export async function fetchItemLists() {
    const response = await fetch(`${API_BASE}/api/item-lists`)
    if (!response.ok) throw new Error('Не удалось загрузить списки')
    return response.json()
}

export async function generateRandomItem(listId) {
    const response = await apiFetch(`${API_BASE}/api/item-lists/${listId}/random`)
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Не удалось сгенерировать предмет')
    }
    return response.json()
}

export async function fetchItemGenerationHistory() {
    const response = await apiFetch(`${API_BASE}/api/item-lists/history`)
    if (!response.ok) throw new Error('Не удалось загрузить историю генерации')
    return response.json()
}

export async function fetchMyItemLists() {
    const response = await apiFetch(`${API_BASE}/api/item-lists/mine`)
    if (!response.ok) throw new Error('Не удалось загрузить мои списки')
    return response.json()
}

export async function createItemList(payload) {
    const response = await apiFetch(`${API_BASE}/api/item-lists`, {
        method: 'POST',
        body: JSON.stringify(payload),
    })
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Не удалось создать список')
    }
    return response.json()
}

export async function updateItemList(id, payload) {
    const response = await apiFetch(`${API_BASE}/api/item-lists/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    })
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Не удалось обновить список')
    }
    return response.json()
}

export async function deleteItemList(id) {
    const response = await apiFetch(`${API_BASE}/api/item-lists/${id}`, {
        method: 'DELETE',
    })
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Не удалось удалить список')
    }
    return response.json()
}

export async function rollDice(diceType) {
    const response = await apiFetch(`${API_BASE}/api/dice/roll`, {
        method: 'POST',
        body: JSON.stringify({ diceType }),
    })
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Ошибка броска')
    }
    return response.json()
}

export async function fetchDiceHistory() {
    const response = await apiFetch(`${API_BASE}/api/dice/history`)
    if (!response.ok) throw new Error('Не удалось загрузить историю')
    return response.json()
}

export async function fetchSharedImages() {
    const response = await apiFetch(`${API_BASE}/api/images/shared`)
    if (!response.ok) throw new Error('Не удалось загрузить изображения')
    return response.json()
}

export async function fetchMyImages() {
    const response = await apiFetch(`${API_BASE}/api/images/mine`)
    if (!response.ok) throw new Error('Не удалось загрузить изображения')
    return response.json()
}

export async function fetchImagesSharedBy(userId) {
    const response = await apiFetch(`${API_BASE}/api/images/shared-by/${userId}`)
    if (!response.ok) throw new Error('Не удалось загрузить изображения')
    return response.json()
}

export async function shareImage(imgId, toUserId) {
    const response = await apiFetch(`${API_BASE}/api/images/${imgId}/share`, {
        method: 'POST',
        body: JSON.stringify({ toUserId }),
    })
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Не удалось поделиться')
    }
    return response.json()
}

export async function deleteImage(imgId) {
    const response = await apiFetch(`${API_BASE}/api/images/${imgId}`, {
        method: 'DELETE',
    })
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Не удалось удалить')
    }
    return response.json()
}

export async function uploadImage(formData) {
    const response = await apiFetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
    })
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Ошибка загрузки')
    }
    return response.json()
}

export async function createGameRoom(name, memberIds) {
    const response = await apiFetch(`${API_BASE}/api/game/rooms`, {
        method: 'POST',
        body: JSON.stringify({ name, memberIds }),
    })
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Не удалось создать комнату')
    }
    return response.json()
}

export async function fetchGameRooms() {
    const response = await apiFetch(`${API_BASE}/api/game/rooms`)
    if (!response.ok) throw new Error('Не удалось загрузить комнаты')
    return response.json()
}

export async function fetchRoomMembers(roomId) {
    const response = await apiFetch(`${API_BASE}/api/game/rooms/${roomId}/members`)
    if (!response.ok) throw new Error('Не удалось загрузить участников')
    return response.json()
}

export async function addRoomMember(roomId, userId) {
    const response = await apiFetch(`${API_BASE}/api/game/rooms/${roomId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
    })
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Не удалось добавить участника')
    }
    return response.json()
}

export async function deleteGameRoom(roomId) {
    const response = await apiFetch(`${API_BASE}/api/game/rooms/${roomId}`, {
        method: 'DELETE',
    })
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Не удалось удалить комнату')
    }
    return response.json()
}

export async function deleteChatByPartner(partnerId) {
    const response = await apiFetch(`${API_BASE}/api/chats/${partnerId}`, {
        method: 'DELETE',
    })
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Не удалось удалить чат')
    }
    return response.json()
}

export async function fetchNonAdmins() {
    const response = await apiFetch(`${API_BASE}/api/users/non-admins`)
    if (!response.ok) throw new Error('Не удалось загрузить пользователей')
    return response.json()
}

export async function promoteUser(userId) {
    const response = await apiFetch(`${API_BASE}/api/users/${userId}/promote`, {
        method: 'PUT',
    })
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Не удалось назначить админа')
    }
    return response.json()
}

export async function deleteUserByAdmin(userId) {
    const response = await apiFetch(`${API_BASE}/api/users/${userId}`, {
        method: 'DELETE',
    })
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Не удалось удалить')
    }
    return response.json()
}

export async function fetchMe() {
    const response = await apiFetch(`${API_BASE}/me`)
    if (!response.ok) throw new Error('Не удалось загрузить профиль')
    return response.json()
}

export async function updateMe(body) {
    const response = await apiFetch(`${API_BASE}/me`, {
        method: 'PUT',
        body: JSON.stringify(body),
    })
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Не удалось обновить')
    }
    return response.json()
}

export function parseJwtAdmin() {
    const token = localStorage.getItem('accessToken')
    if (!token) return false
    try {
        const base64Url = token.split('.')[1]
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
        const payload = JSON.parse(atob(base64))
        return payload.isAdmin === true
    } catch {
        return false
    }
}

export function logout() {
    disconnectSocket()
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('userId')
    window.location.href = '/auth'
}
