const express = require('express')
const pool = require('./db')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require('cors')
const app = express()
const port = 4242
const ACCESS_SECRET = "access_secret"
const REFRESH_SECRET = "refresh_secret"
const ACCESS_EXPIRES_IN = "5m"
const REFRESH_EXPIRES_IN = "10m"

//let users = [ ]
const refreshTokens = new Set()

//cors
app.use(cors())

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
            await pool.query(
                'DELETE FROM users WHERE id = $1 RETURNING *',
                [id]
            )
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

app.listen(port, () => {
    console.log(`http://localhost:${port}`)
})