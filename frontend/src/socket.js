import { io } from 'socket.io-client'

const SOCKET_URL = 'http://localhost:4242'
let socket = null

export function connectSocket() {
    const token = localStorage.getItem('accessToken')
    if (!token) return null

    if (socket?.connected) {
        return socket
    }

    if (socket) {
        socket.disconnect()
        socket = null
    }

    socket = io(SOCKET_URL, {
        auth: { token }
    })

    return socket
}

export function getSocket() {
    return socket
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect()
        socket = null
    }
}
