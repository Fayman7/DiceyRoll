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

//socket.io
io.on('connection', (socket) => {
  console.log(`Пользователь подключился: ${socket.id}`)
  socket.on('join_room', (chatId) => {
    const roomName = `chat_${chatId}`
    socket.join(roomName);
    console.log(`Сокет ${socket.id} вошел в комнату ${roomName}`)
  })
  socket.on('send_message', async (data) => {
    const { chatId, senderId, text } = data
    const roomName = `chat_${chatId}`
    try {
      io.to(roomName).emit('receive_message', {
        id: Date.now(),
        chatId,
        senderId,
        text,
        createdAt: new Date()
      })
    } catch (error) {
      console.error('Ошибка сохранения сообщения:', error)
      socket.emit('error', 'Не удалось отправить сообщение')
    }
  })
  socket.on('leave_room', (chatId) => {
    socket.leave(`chat_${chatId}`)
  })
  socket.on('disconnect', () => {
    console.log(`Пользователь отключился: ${socket.id}`)
  })
})

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
            const result = (await pool.query('SELECT * FROM uploads WHERE user_id = $1', [id])).rows
            if (result.length > 0) {
                for (const image of result) {
                    const filePath = path.join(__dirname, '../public/uploads', image.img_url)
                    try {
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath)
                        }
                    } catch (fileErr) {
                        console.error('Ошибка при удалении файла с диска:', fileErr)
                    }
                }
                await pool.query('DELETE FROM uploads WHERE user_id = $1', [id])
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
        if (user) {
            const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id])
            res.json({ message: 'Пользователь успешно удален' })
        }
        else {
            res.status(404).json({ message: 'Пользователь не найден' })
        }
    })

app.get('/api/images', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM uploads')
        res.json(result.rows)
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
        const result = await pool.query('INSERT INTO uploads (user_id, img_url) VALUES ($1, $2)', [id, `${req.file.filename}`])
        res.status(200).json({
            message: 'Файл успешно загружен',
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

app.delete('/api/images/:id', authMiddleware, async (req, res) => {
    try {
        const imageId = req.params.id
        const userId = req.user.sub
        const result = await pool.query('SELECT * FROM uploads WHERE img_id = $1', [imageId])
        const image = result.rows[0]
        if (!image) {
            return res.status(404).json({ message: 'Изображение не найдено' })
        }
        if (image.user_id !== userId) {
            return res.status(403).json({ message: 'Нет прав для удаления этого изображения' })
        }
        const filePath = path.join(__dirname, '../public/uploads', image.img_url)
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
            }
        } catch (fileErr) {
            console.error('Ошибка при удалении файла с диска:', fileErr)
        }
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

app.listen(port, () => {
    console.log(`http://localhost:${port}`)
})