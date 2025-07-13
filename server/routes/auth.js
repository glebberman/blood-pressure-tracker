const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../utils/validation');

// Регистрация пользователя
router.post('/register', async (req, res) => {
    try {
        const { username, password, name } = req.body;

        // Валидация
        const errors = validateRegister(username, password, name);
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: errors.join(', ')
            });
        }

        // Проверка на существование пользователя
        const existingUser = await User.findByUsername(username);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Username already exists'
            });
        }

        // Создание пользователя
        const user = await User.create(username, password, name);
        
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: { id: user.id, username: user.username, name: user.name }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Вход пользователя
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Валидация
        const errors = validateLogin(username, password);
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: errors.join(', ')
            });
        }

        // Поиск пользователя
        const user = await User.findByUsername(username);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        // Проверка пароля
        const isValidPassword = User.validatePassword(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        // Генерация токена
        const token = generateToken(user.id);

        res.json({
            success: true,
            token: token,
            user: { id: user.id, username: user.username, name: user.name }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Выход пользователя (на клиенте просто удаляется токен)
router.post('/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

module.exports = router;