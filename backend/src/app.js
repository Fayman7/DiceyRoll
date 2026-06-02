const express = require('express')
const pool = require('./db')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const http = require('http');
const { Server } = require('socket.io');

const app = express()
const server = http.createServer(app);
const port = 4242

const ACCESS_SECRET = "access_secret"
const REFRESH_SECRET = "refresh_secret"
const ACCESS_EXPIRES_IN = "5m"
const REFRESH_EXPIRES_IN = "10m"
const refreshTokens = new Set()

//multer
const storage = multer.diskStorage({
    destination: function (req, file, cd) {
        cd(null, 'public/uploads')
    },
    filename: function (req, file, cd) {
        const uniqeuSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        const ext = path.extname(file.originalname)
        cd(null, file.fieldname + '-' + uniqeuSuffix + ext)
    }
})
const fileFilter = (req, file, cd) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (allowedTypes.includes(file.mimetype)) {
        cd(null, true)
    }
    else {
        cd(new Error('Недопустимый тип файла. Попробуйте форматы JPEG, JPG и PNG'), false)
    }
}
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
})
app.use('/uploads', express.static('public/uploads'))

//cors
app.use(cors())
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // URL вашего Vue приложения
    methods: ["GET", "POST"]
  }
});

//middleware
app.use(express.json())
app.use(express.static('public'))
app.use((req, res, next) => {
    console.log(`${req.method}: ${req.url}`)
    next()
})

//JWT
async function authMiddleware(req, res, next) {
    const header = req.headers.authorization || ''
    const [sheme, token] = header.split(' ')
    if (sheme !== "Bearer" || !token) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' })
    }
    try {
        const payload = jwt.verify(token, ACCESS_SECRET)
        req.user = payload
        next()
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' })
    }
}
async function adminMiddleware(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Пользователь не авторизован' })
    }
    if (req.user.isAdmin === true) {
        next()
    }
    else {
        return res.status(403).json({ error: 'Недостаточно прав. Требуются права администратора' })
    }
}

//functions
async function findUserById(id) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id])
    return result.rows[0]
}
async function findUserByName(username) {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
}
async function hashPassword(password) {
    const rounds = 10;
    return bcrypt.hash(password, rounds)
}
async function verifyPassword(password, passwordHash) {
    return bcrypt.compare(password, passwordHash)
}
async function generateAccessToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            username: user.username,
            isAdmin: user.is_admin
        },
        ACCESS_SECRET,
        {
            expiresIn: ACCESS_EXPIRES_IN
        }
    )
}
async function generateRefreshToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            username: user.username,
            isAdmin: user.is_admin
        },
        REFRESH_SECRET,
        {
            expiresIn: REFRESH_EXPIRES_IN
        }
    )
}

function getRoomName(chatId) {
    return `chat_${chatId}`
}

async function findOrCreateChat(userIdA, userIdB) {
    const minId = Math.min(Number(userIdA), Number(userIdB))
    const maxId = Math.max(Number(userIdA), Number(userIdB))
    const existing = await pool.query(
        'SELECT id FROM chats WHERE user1_id = $1 AND user2_id = $2',
        [minId, maxId]
    )
    if (existing.rows[0]) {
        return existing.rows[0].id
    }
    const inserted = await pool.query(
        'INSERT INTO chats (user1_id, user2_id) VALUES ($1, $2) RETURNING id',
        [minId, maxId]
    )
    return inserted.rows[0].id
}

async function findChatByUsers(userIdA, userIdB) {
    const minId = Math.min(Number(userIdA), Number(userIdB))
    const maxId = Math.max(Number(userIdA), Number(userIdB))
    const result = await pool.query(
        'SELECT id FROM chats WHERE user1_id = $1 AND user2_id = $2',
        [minId, maxId]
    )
    return result.rows[0]?.id || null
}

async function assertChatMember(chatId, userId) {
    const result = await pool.query(
        'SELECT user1_id, user2_id FROM chats WHERE id = $1',
        [chatId]
    )
    const chat = result.rows[0]
    if (!chat) {
        const err = new Error('Чат не найден')
        err.status = 404
        throw err
    }
    const uid = Number(userId)
    if (chat.user1_id !== uid && chat.user2_id !== uid) {
        const err = new Error('Нет доступа к этому чату')
        err.status = 403
        throw err
    }
    return chat
}

async function markMessagesAsRead(chatId, readerId) {
    await pool.query(
        `UPDATE messages SET is_read = true
         WHERE chat_id = $1 AND user_id != $2 AND is_read = false`,
        [chatId, readerId]
    )
}

async function deleteUserChatsAndMessages(userId) {
    const chats = await pool.query(
        'SELECT id FROM chats WHERE user1_id = $1 OR user2_id = $1',
        [userId]
    )
    for (const chat of chats.rows) {
        await pool.query('DELETE FROM messages WHERE chat_id = $1', [chat.id])
    }
    await pool.query(
        'DELETE FROM chats WHERE user1_id = $1 OR user2_id = $1',
        [userId]
    )
}

async function deleteUserGameRooms(userId) {
    const roomRows = await pool.query(
        `SELECT DISTINCT gr.id
         FROM game_rooms gr
         LEFT JOIN game_room_members gm ON gm.room_id = gr.id
         WHERE gr.created_by = $1 OR gm.user_id = $1`,
        [userId]
    )
    for (const room of roomRows.rows) {
        await pool.query('DELETE FROM game_rooms WHERE id = $1', [room.id])
    }
}

const DICE_SIDES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 }

async function deleteImageFile(imgUrl) {
    const filePath = path.join(__dirname, '../public/uploads', imgUrl)
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
        }
    } catch (fileErr) {
        console.error('Ошибка при удалении файла с диска:', fileErr)
    }
}

async function assertGameRoomMember(roomId, userId) {
    const result = await pool.query(
        'SELECT 1 FROM game_room_members WHERE room_id = $1 AND user_id = $2',
        [roomId, userId]
    )
    if (!result.rows[0]) {
        const err = new Error('Нет доступа к этой комнате')
        err.status = 403
        throw err
    }
}

async function assertListOwner(listId, userId) {
    const result = await pool.query(
        'SELECT id, owner_id FROM item_lists WHERE id = $1',
        [listId]
    )
    const list = result.rows[0]
    if (!list) {
        const err = new Error('Список не найден')
        err.status = 404
        throw err
    }
    if (Number(list.owner_id) !== Number(userId)) {
        const err = new Error('Редактировать список может только создатель')
        err.status = 403
        throw err
    }
    return list
}

function getOptionalAuthUser(req) {
    const header = req.headers.authorization || ''
    const [scheme, token] = header.split(' ')
    if (scheme !== 'Bearer' || !token) return null
    try {
        return jwt.verify(token, ACCESS_SECRET)
    } catch {
        return null
    }
}

const SHARED_IMAGES_SELECT = `
    SELECT u.img_id, u.user_id AS owner_id, u.img_url,
           s.from_user_id, fu.username AS from_username
    FROM image_shares s
    JOIN uploads u ON u.img_id = s.img_id
    JOIN users fu ON fu.id = s.from_user_id
`

io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) {
        return next(new Error('Unauthorized'))
    }
    try {
        socket.user = jwt.verify(token, ACCESS_SECRET)
        next()
    } catch {
        next(new Error('Unauthorized'))
    }
})

io.on('connection', (socket) => {
    const userId = socket.user.sub
    console.log(`Пользователь ${userId} подключился: ${socket.id}`)

    socket.on('join_chat', async (partnerId) => {
        try {
            const partner = await findUserById(partnerId)
            if (!partner) {
                return socket.emit('error', 'Собеседник не найден')
            }
            if (Number(partnerId) === Number(userId)) {
                return socket.emit('error', 'Нельзя открыть чат с самим собой')
            }
            const chatId = await findOrCreateChat(userId, partnerId)
            await assertChatMember(chatId, userId)
            await markMessagesAsRead(chatId, userId)
            socket.join(getRoomName(chatId))
            socket.emit('chat_joined', { chatId, partnerId: Number(partnerId) })
        } catch (error) {
            console.error('join_chat:', error)
            socket.emit('error', error.message || 'Не удалось войти в чат')
        }
    })

    socket.on('send_message', async (data) => {
        const { partnerId, text } = data || {}
        const trimmed = typeof text === 'string' ? text.trim() : ''
        if (!trimmed) {
            return socket.emit('error', 'Сообщение не может быть пустым')
        }
        try {
            const partner = await findUserById(partnerId)
            if (!partner) {
                return socket.emit('error', 'Собеседник не найден')
            }
            if (Number(partnerId) === Number(userId)) {
                return socket.emit('error', 'Нельзя отправить сообщение себе')
            }
            const chatId = await findOrCreateChat(userId, partnerId)
            await assertChatMember(chatId, userId)
            const result = await pool.query(
                `INSERT INTO messages (chat_id, user_id, text, is_read)
                 VALUES ($1, $2, $3, false)
                 RETURNING id, chat_id, user_id, text, is_read`,
                [chatId, userId, trimmed]
            )
            io.to(getRoomName(chatId)).emit('receive_message', result.rows[0])
        } catch (error) {
            console.error('send_message:', error)
            socket.emit('error', 'Не удалось отправить сообщение')
        }
    })

    socket.on('leave_chat', (chatId) => {
        if (chatId) {
            socket.leave(getRoomName(chatId))
        }
    })

    socket.on('disconnect', () => {
        console.log(`Пользователь ${userId} отключился: ${socket.id}`)
    })
})

//requests
app.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body
    if (!refreshToken) {
        return res.status(400).json({ error: 'refreshToken is required' })
    }
    if (!refreshTokens.has(refreshToken)) {
        return res.status(401).json({ error: 'Invalid refresh token' })
    }

    try {
        const payload = jwt.verify(refreshToken, REFRESH_SECRET)
        const user = await findUserById(payload.sub)
        if (!user) {
            return res.status(401).json({ error: 'User not found'})
        }
        refreshTokens.delete(refreshToken)
        const newAccessToken = await generateAccessToken(user)
        const newRefreshToken = await generateRefreshToken(user)
        refreshTokens.add(newRefreshToken)
        res.json({accessToken: newAccessToken, refreshToken: newRefreshToken})
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' })
    }
})
app.post('/login', async (req, res) => {
    const {username, password} = req.body
    if (username && password) {
        const user = await findUserByName(username)
        if (user) {
            const passwordMatch = await verifyPassword(password, user.password)
            if (passwordMatch) {
                const accessToken = await generateAccessToken(user)
                const refreshToken = await generateRefreshToken(user)
                refreshTokens.add(refreshToken);
                res.json({
                    accessToken: accessToken,
                    refreshToken: refreshToken,
                    id: user.id,
                    message: 'Успешный вход в аккаунт'
                })
            }
            else {
                res.status(401).json({message: 'Неверный пароль'})
            }
        }
        else {
            res.status(401).json({message: 'Пользователь не найден'})
        }
    }
    else {
        res.status(400).json({message: 'Недостаточно данных для входа'})
    }
})

app.post('/register', async (req, res) => {
    const {username, password} = req.body
    if (username && password) {
        if (await findUserByName(username)) {
            res.status(400).json({message: 'Пользователь с таким именем уже существует'})
        }
        else {
            const hashedPassword = await hashPassword(password)
            const result = await pool.query(
                'INSERT INTO users (username, password, is_admin) VALUES ($1, $2, $3) RETURNING *',
                [username, hashedPassword, false]
            )
            const newUser = result.rows[0]
            const accessToken = await generateAccessToken(newUser)
            const refreshToken = await generateRefreshToken(newUser)
            refreshTokens.add(refreshToken)
            res.status(201).json({
                accessToken: accessToken,
                refreshToken: refreshToken,
                id: newUser.id,
                message: 'Пользователь успешно зарегистрирован'
            })
        }
    }
    else {
        res.status(400).json({message: 'Недостаточно данных для регистрации'})
    }
})

app.route('/me')
    .all(authMiddleware)
    .get(async (req, res) => {
        const id = req.user.sub
        const user = await findUserById(id)
        if (user) {
            res.json({ id: user.id, username: user.username })
        }
        else {
            res.status(404).json({message: 'Пользователь не найден'})
        }
    })
    .put(async (req, res) => {
        const id = req.user.sub
        const {username, password} = req.body
        const user = await findUserById(id)
        if (username || password) {
            if (user) {
                const newUsername = username || user.username
                let newPassword = user.password
                if (password) {newPassword = await hashPassword(password)}
                await pool.query(
                    'UPDATE users SET username = $1, password = $2 WHERE id = $3 RETURNING *',
                    [newUsername, newPassword, id]
                )
                res.json({message: 'Данные о пользователе успешно обновлены'})
            }
            else {
                res.status(404).json({message: 'Пользователь не найден'})
            }
        }
        else {
            res.status(400).json({message: 'Нет данных для обновления'})
        }
    })
    .delete(async (req, res) => {
        const id = req.user.sub
        const user = await findUserById(id)
        if (user) {
            await deleteUserChatsAndMessages(id)
            await deleteUserGameRooms(id)
            const result = (await pool.query('SELECT * FROM uploads WHERE user_id = $1', [id])).rows
            for (const image of result) {
                await deleteImageFile(image.img_url)
            }
            await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id])
            res.json({message: 'Пользователь успешно удален'})
        }
        else {
            res.status(404).json({message: 'Пользователь не найден'})
        }
    })

app.route('/users')
    .all(authMiddleware, adminMiddleware)
    .get(async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM users')
            if (result.rows.length === 0) {
                res.status(404).json({ message: 'Пользователей не найдено' })
            }
            else {
                res.json(result.rows)
            }
        } catch (err) {
            res.status(500).json({ error: 'Ошибка Базы данных' })
        }
    })
    .put(async (req, res) => {
        const {id, username, password} = req.body
        const user = await findUserById(id);
        if (username || password) {
            if (user) {
                const newUsername = username || user.username
                let newPassword = user.password
                if (password) {newPassword = await hashPassword(password)}
                const result = await pool.query(
                    'UPDATE users SET username = $1, password = $2 WHERE id = $3 RETURNING *',
                    [newUsername, newPassword, id]
                )
                res.json({message: 'Данные о пользователе успешно обновлены'})
            }
            else {
                res.status(404).json({ message: 'Пользователь не найден' })
            }
        }
        else {
            res.status(400).json({ message: 'Нет данных для обновления' })
        }
    })
    .delete(async (req, res) => {
        const {id} = req.body
        const user = await findUserById(id)
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' })
        }
        if (user.is_admin) {
            return res.status(403).json({ message: 'Нельзя удалить администратора' })
        }
        await deleteUserChatsAndMessages(id)
        await deleteUserGameRooms(id)
        const uploads = (await pool.query('SELECT * FROM uploads WHERE user_id = $1', [id])).rows
        for (const image of uploads) {
            await deleteImageFile(image.img_url)
        }
        await pool.query('DELETE FROM users WHERE id = $1', [id])
        res.json({ message: 'Пользователь успешно удален' })
    })

app.post('/api/dice/roll', async (req, res) => {
    try {
        const { diceType } = req.body
        const sides = DICE_SIDES[diceType]
        if (!sides) {
            return res.status(400).json({ message: 'Недопустимый тип кости' })
        }
        const result = Math.floor(Math.random() * sides) + 1
        const header = req.headers.authorization || ''
        const [scheme, token] = header.split(' ')

        // Гость может бросать кости, но бросок не сохраняется в историю.
        if (scheme !== 'Bearer' || !token) {
            return res.json({
                id: null,
                user_id: null,
                dice_type: diceType,
                result,
                persisted: false,
            })
        }

        try {
            const payload = jwt.verify(token, ACCESS_SECRET)
            const inserted = await pool.query(
                `INSERT INTO dice_rolls (user_id, dice_type, result)
                 VALUES ($1, $2, $3)
                 RETURNING id, user_id, dice_type, result`,
                [payload.sub, diceType, result]
            )
            return res.json({ ...inserted.rows[0], persisted: true })
        } catch {
            // Просроченный/битый токен не должен блокировать сам бросок.
            return res.json({
                id: null,
                user_id: null,
                dice_type: diceType,
                result,
                persisted: false,
            })
        }
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.get('/api/dice/history', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, user_id, dice_type, result FROM dice_rolls
             WHERE user_id = $1 ORDER BY id DESC LIMIT 50`,
            [req.user.sub]
        )
        res.json(result.rows)
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.get('/api/users/non-admins', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, is_admin FROM users WHERE is_admin = false ORDER BY username'
        )
        res.json(result.rows)
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.put('/api/users/:id/promote', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const targetId = Number(req.params.id)
        const user = await findUserById(targetId)
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' })
        }
        if (user.is_admin) {
            return res.status(400).json({ message: 'Пользователь уже администратор' })
        }
        await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [targetId])
        res.json({ message: 'Пользователь назначен администратором' })
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.delete('/api/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const targetId = Number(req.params.id)
        const user = await findUserById(targetId)
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' })
        }
        if (user.is_admin) {
            return res.status(403).json({ message: 'Нельзя удалить администратора' })
        }
        await deleteUserChatsAndMessages(targetId)
        await deleteUserGameRooms(targetId)
        const uploads = (await pool.query('SELECT * FROM uploads WHERE user_id = $1', [targetId])).rows
        for (const image of uploads) {
            await deleteImageFile(image.img_url)
        }
        await pool.query('DELETE FROM users WHERE id = $1', [targetId])
        res.json({ message: 'Пользователь успешно удален' })
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.get('/api/images/shared', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `${SHARED_IMAGES_SELECT} WHERE s.to_user_id = $1 ORDER BY u.img_id ASC`,
            [req.user.sub]
        )
        res.json(result.rows)
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.get('/api/item-lists', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT il.id, il.name, il.owner_id, u.username AS owner_username,
                    COUNT(ili.id)::int AS items_count
             FROM item_lists il
             JOIN users u ON u.id = il.owner_id
             LEFT JOIN item_list_items ili ON ili.list_id = il.id
             WHERE il.is_public = true
             GROUP BY il.id, u.username
             ORDER BY il.id ASC`
        )
        res.json(result.rows)
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.get('/api/item-lists/mine', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT il.id, il.name, il.owner_id,
                    COALESCE(
                      json_agg(
                        json_build_object('id', ili.id, 'value', ili.value)
                        ORDER BY ili.id
                      ) FILTER (WHERE ili.id IS NOT NULL),
                      '[]'::json
                    ) AS items
             FROM item_lists il
             LEFT JOIN item_list_items ili ON ili.list_id = il.id
             WHERE il.owner_id = $1
             GROUP BY il.id
             ORDER BY il.id ASC`,
            [req.user.sub]
        )
        res.json(result.rows)
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.get('/api/item-lists/:id/random', async (req, res) => {
    try {
        const listId = Number(req.params.id)
        if (!listId) {
            return res.status(400).json({ message: 'Некорректный список' })
        }
        const list = (
            await pool.query(
                'SELECT id, name, is_public FROM item_lists WHERE id = $1',
                [listId]
            )
        ).rows[0]
        if (!list || !list.is_public) {
            return res.status(404).json({ message: 'Список не найден' })
        }
        const item = (
            await pool.query(
                'SELECT id, value FROM item_list_items WHERE list_id = $1 ORDER BY random() LIMIT 1',
                [listId]
            )
        ).rows[0]
        if (!item) {
            return res.status(400).json({ message: 'Список пуст, добавьте предметы' })
        }
        const authUser = getOptionalAuthUser(req)
        if (authUser?.sub) {
            await pool.query(
                `INSERT INTO item_generation_history (user_id, list_id, item_id, item_value)
                 VALUES ($1, $2, $3, $4)`,
                [authUser.sub, listId, item.id, item.value]
            )
        }
        res.json({ list_id: listId, list_name: list.name, item: item.value, item_id: item.id })
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.get('/api/item-lists/history', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT h.id, h.list_id, h.item_id, h.item_value, il.name AS list_name
             FROM item_generation_history h
             JOIN item_lists il ON il.id = h.list_id
             WHERE h.user_id = $1
             ORDER BY h.id DESC
             LIMIT 50`,
            [req.user.sub]
        )
        res.json(result.rows)
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.post('/api/item-lists', authMiddleware, async (req, res) => {
    try {
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
        const items = Array.isArray(req.body.items) ? req.body.items : []
        if (!name) {
            return res.status(400).json({ message: 'Укажите название списка' })
        }
        const cleanedItems = items
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean)
        const listResult = await pool.query(
            'INSERT INTO item_lists (name, owner_id, is_public) VALUES ($1, $2, true) RETURNING id, name, owner_id',
            [name, req.user.sub]
        )
        const list = listResult.rows[0]
        for (const value of cleanedItems) {
            await pool.query(
                'INSERT INTO item_list_items (list_id, value) VALUES ($1, $2)',
                [list.id, value]
            )
        }
        res.status(201).json({ ...list, items_count: cleanedItems.length })
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.put('/api/item-lists/:id', authMiddleware, async (req, res) => {
    try {
        const listId = Number(req.params.id)
        if (!listId) {
            return res.status(400).json({ message: 'Некорректный список' })
        }
        await assertListOwner(listId, req.user.sub)
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
        const items = Array.isArray(req.body.items) ? req.body.items : []
        if (!name) {
            return res.status(400).json({ message: 'Укажите название списка' })
        }
        const cleanedItems = items
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean)
        await pool.query('UPDATE item_lists SET name = $1 WHERE id = $2', [name, listId])
        await pool.query('DELETE FROM item_list_items WHERE list_id = $1', [listId])
        for (const value of cleanedItems) {
            await pool.query(
                'INSERT INTO item_list_items (list_id, value) VALUES ($1, $2)',
                [listId, value]
            )
        }
        res.json({ message: 'Список обновлен', id: listId, name, items_count: cleanedItems.length })
    } catch (error) {
        const status = error.status || 500
        res.status(status).json({ message: error.message || 'Ошибка сервера' })
    }
})

app.delete('/api/item-lists/:id', authMiddleware, async (req, res) => {
    try {
        const listId = Number(req.params.id)
        if (!listId) {
            return res.status(400).json({ message: 'Некорректный список' })
        }
        await assertListOwner(listId, req.user.sub)
        await pool.query('DELETE FROM item_lists WHERE id = $1', [listId])
        res.json({ message: 'Список удален' })
    } catch (error) {
        const status = error.status || 500
        res.status(status).json({ message: error.message || 'Ошибка сервера' })
    }
})

app.get('/api/images/mine', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT img_id, user_id AS owner_id, img_url,
                    user_id AS from_user_id,
                    (SELECT username FROM users WHERE id = $1) AS from_username
             FROM uploads WHERE user_id = $1 ORDER BY img_id ASC`,
            [req.user.sub]
        )
        res.json(result.rows)
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.get('/api/images/shared-by/:userId', authMiddleware, async (req, res) => {
    try {
        const fromUserId = Number(req.params.userId)
        const result = await pool.query(
            `${SHARED_IMAGES_SELECT}
             WHERE s.to_user_id = $1 AND s.from_user_id = $2
             ORDER BY u.img_id ASC`,
            [req.user.sub, fromUserId]
        )
        res.json(result.rows)
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.post('/api/images/:imgId/share', authMiddleware, async (req, res) => {
    try {
        const imgId = Number(req.params.imgId)
        const toUserId = Number(req.body.toUserId)
        const me = Number(req.user.sub)
        if (!toUserId || toUserId === me) {
            return res.status(400).json({ message: 'Некорректный получатель' })
        }
        const image = (await pool.query('SELECT * FROM uploads WHERE img_id = $1', [imgId])).rows[0]
        if (!image) {
            return res.status(404).json({ message: 'Изображение не найдено' })
        }
        if (image.user_id !== me) {
            return res.status(403).json({ message: 'Можно делиться только своими изображениями' })
        }
        const recipient = await findUserById(toUserId)
        if (!recipient) {
            return res.status(404).json({ message: 'Пользователь не найден' })
        }
        await pool.query(
            `INSERT INTO image_shares (img_id, from_user_id, to_user_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (img_id, to_user_id) DO NOTHING`,
            [imgId, me, toUserId]
        )
        res.json({ message: 'Изображение отправлено пользователю' })
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.post('/api/game/rooms', authMiddleware, async (req, res) => {
    try {
        const { name, memberIds } = req.body
        const trimmedName = typeof name === 'string' ? name.trim() : ''
        if (!trimmedName) {
            return res.status(400).json({ message: 'Укажите название комнаты' })
        }
        const me = Number(req.user.sub)
        const ids = new Set([me, ...(Array.isArray(memberIds) ? memberIds.map(Number) : [])])
        const roomResult = await pool.query(
            'INSERT INTO game_rooms (name, created_by) VALUES ($1, $2) RETURNING id, name, created_by',
            [trimmedName, me]
        )
        const room = roomResult.rows[0]
        for (const uid of ids) {
            if (!uid || uid === me) continue
            const member = await findUserById(uid)
            if (member) {
                await pool.query(
                    'INSERT INTO game_room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [room.id, uid]
                )
            }
        }
        await pool.query(
            'INSERT INTO game_room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [room.id, me]
        )
        res.status(201).json(room)
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.get('/api/game/rooms', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT gr.id, gr.name, gr.created_by
             FROM game_rooms gr
             JOIN game_room_members gm ON gm.room_id = gr.id
             WHERE gm.user_id = $1
             ORDER BY gr.id DESC`,
            [req.user.sub]
        )
        res.json(result.rows)
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.get('/api/game/rooms/:id/members', authMiddleware, async (req, res) => {
    try {
        const roomId = Number(req.params.id)
        await assertGameRoomMember(roomId, req.user.sub)
        const result = await pool.query(
            `SELECT u.id, u.username
             FROM game_room_members gm
             JOIN users u ON u.id = gm.user_id
             WHERE gm.room_id = $1
             ORDER BY u.username`,
            [roomId]
        )
        res.json(result.rows)
    } catch (error) {
        const status = error.status || 500
        res.status(status).json({ message: error.message || 'Ошибка сервера' })
    }
})

app.post('/api/game/rooms/:id/members', authMiddleware, async (req, res) => {
    try {
        const roomId = Number(req.params.id)
        const userId = Number(req.body.userId)
        await assertGameRoomMember(roomId, req.user.sub)
        if (!userId) {
            return res.status(400).json({ message: 'Укажите пользователя' })
        }
        const member = await findUserById(userId)
        if (!member) {
            return res.status(404).json({ message: 'Пользователь не найден' })
        }
        await pool.query(
            'INSERT INTO game_room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [roomId, userId]
        )
        res.json({ message: 'Участник добавлен' })
    } catch (error) {
        const status = error.status || 500
        res.status(status).json({ message: error.message || 'Ошибка сервера' })
    }
})

app.delete('/api/game/rooms/:id', authMiddleware, async (req, res) => {
    try {
        const roomId = Number(req.params.id)
        if (!roomId) {
            return res.status(400).json({ message: 'Некорректная комната' })
        }
        const room = (
            await pool.query('SELECT id, created_by FROM game_rooms WHERE id = $1', [roomId])
        ).rows[0]
        if (!room) {
            return res.status(404).json({ message: 'Комната не найдена' })
        }
        if (Number(room.created_by) !== Number(req.user.sub)) {
            return res.status(403).json({ message: 'Удалить комнату может только создатель' })
        }
        await pool.query('DELETE FROM game_rooms WHERE id = $1', [roomId])
        res.json({ message: 'Комната удалена' })
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.post('/api/upload', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Выберите файл для загрузки' })
        }
        const id = req.user.sub
        const title = req.body.title
        const result = await pool.query(
            'INSERT INTO uploads (user_id, img_url) VALUES ($1, $2) RETURNING img_id',
            [id, `${req.file.filename}`]
        )
        res.status(200).json({
            message: 'Файл успешно загружен',
            img_id: result.rows[0].img_id,
            title: title,
            fileInfo: {
                originalName: req.file.originalname,
                savedName: req.file.filename,
                size: req.file.size,
                path: req.file.path,
                url: `http://localhost:${port}/uploads/${req.file.filename}`
            }
        })
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.get('/api/contacts', authMiddleware, async (req, res) => {
    try {
        const me = req.user.sub
        const result = await pool.query(
            'SELECT id, username FROM users WHERE id != $1 ORDER BY username',
            [me]
        )
        res.json(result.rows)
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.get('/api/messages/:partnerId', authMiddleware, async (req, res) => {
    try {
        const me = req.user.sub
        const partnerId = Number(req.params.partnerId)
        if (!partnerId || partnerId === Number(me)) {
            return res.status(400).json({ message: 'Некорректный собеседник' })
        }
        const partner = await findUserById(partnerId)
        if (!partner) {
            return res.status(404).json({ message: 'Собеседник не найден' })
        }
        const chatId = await findOrCreateChat(me, partnerId)
        await assertChatMember(chatId, me)
        const messagesResult = await pool.query(
            'SELECT id, chat_id, user_id, text, is_read FROM messages WHERE chat_id = $1 ORDER BY id ASC',
            [chatId]
        )
        await markMessagesAsRead(chatId, me)
        const messages = messagesResult.rows.map((row) => ({
            ...row,
            is_read: row.user_id === Number(me) ? row.is_read : true
        }))
        res.json({ chatId, messages })
    } catch (error) {
        const status = error.status || 500
        res.status(status).json({ message: error.message || 'Ошибка сервера' })
    }
})

app.delete('/api/chats/:partnerId', authMiddleware, async (req, res) => {
    try {
        const me = Number(req.user.sub)
        const partnerId = Number(req.params.partnerId)
        if (!partnerId || partnerId === me) {
            return res.status(400).json({ message: 'Некорректный собеседник' })
        }
        const partner = await findUserById(partnerId)
        if (!partner) {
            return res.status(404).json({ message: 'Собеседник не найден' })
        }
        const chatId = await findChatByUsers(me, partnerId)
        if (!chatId) {
            return res.json({ message: 'Чат уже удален' })
        }
        await assertChatMember(chatId, me)
        await pool.query('DELETE FROM messages WHERE chat_id = $1', [chatId])
        await pool.query('DELETE FROM chats WHERE id = $1', [chatId])
        res.json({ message: 'Чат удален' })
    } catch (error) {
        const status = error.status || 500
        res.status(status).json({ message: error.message || 'Ошибка сервера' })
    }
})

app.delete('/api/images/:id', authMiddleware, async (req, res) => {
    try {
        const imageId = req.params.id
        const userId = Number(req.user.sub)
        const isAdmin = req.user.isAdmin === true
        const result = await pool.query('SELECT * FROM uploads WHERE img_id = $1', [imageId])
        const image = result.rows[0]
        if (!image) {
            return res.status(404).json({ message: 'Изображение не найдено' })
        }
        if (image.user_id !== userId && !isAdmin) {
            return res.status(403).json({ message: 'Нет прав для удаления этого изображения' })
        }
        await deleteImageFile(image.img_url)
        await pool.query('DELETE FROM uploads WHERE img_id = $1', [imageId])
        res.json({ message: 'Изображение успешно удалено' })
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error: error.message })
    }
})

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'Размер файла превышает 5 МБ' })
        }
        return res.status(400).json({ message: err.message })
    }
    else if (err) {
        return res.status(400).json({ message: err.message })
    }
    next()
})

if (require.main === module) {
    server.listen(port, () => {
        console.log(`http://localhost:${port}`)
    })
}

module.exports = { app, server, DICE_SIDES }