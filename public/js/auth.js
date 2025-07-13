// Логика аутентификации для страницы входа/регистрации

document.addEventListener('DOMContentLoaded', function() {
    // Проверяем, авторизован ли пользователь
    if (api.isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    // Элементы DOM
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginCard = document.querySelector('.card');
    const registerCard = document.getElementById('registerCard');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');

    // Переключение между формами
    showRegisterLink.addEventListener('click', function(e) {
        e.preventDefault();
        loginCard.style.display = 'none';
        registerCard.style.display = 'block';
    });

    showLoginLink.addEventListener('click', function(e) {
        e.preventDefault();
        loginCard.style.display = 'block';
        registerCard.style.display = 'none';
    });

    // Обработка формы входа
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            showToast('Заполните все поля', 'error');
            return;
        }

        // Показываем индикатор загрузки
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Вход...';

        try {
            const response = await api.login(username, password);
            
            if (response.success) {
                showToast('Добро пожаловать!', 'success');
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            } else {
                showToast(response.message || 'Ошибка входа', 'error');
            }
        } catch (error) {
            showToast(error.message || 'Ошибка подключения к серверу', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });

    // Обработка формы регистрации
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('regUsername').value.trim();
        const name = document.getElementById('regName').value.trim();
        const password = document.getElementById('regPassword').value;

        // Валидация на клиенте
        if (!username || !name || !password) {
            showToast('Заполните все поля', 'error');
            return;
        }

        if (username.length < 3 || username.length > 50) {
            showToast('Имя пользователя должно содержать от 3 до 50 символов', 'error');
            return;
        }

        if (!/^[a-zA-Z0-9]+$/.test(username)) {
            showToast('Имя пользователя может содержать только латинские буквы и цифры', 'error');
            return;
        }

        if (password.length < 6) {
            showToast('Пароль должен содержать минимум 6 символов', 'error');
            return;
        }

        // Показываем индикатор загрузки
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Регистрация...';

        try {
            const response = await api.register(username, password, name);
            
            if (response.success) {
                showToast('Регистрация успешна! Теперь войдите в систему', 'success');
                
                // Очищаем форму и переключаемся на вход
                registerForm.reset();
                setTimeout(() => {
                    loginCard.style.display = 'block';
                    registerCard.style.display = 'none';
                    
                    // Заполняем имя пользователя в форме входа
                    document.getElementById('username').value = username;
                    document.getElementById('password').focus();
                }, 1500);
            } else {
                showToast(response.message || 'Ошибка регистрации', 'error');
            }
        } catch (error) {
            showToast(error.message || 'Ошибка подключения к серверу', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });

    // Валидация в реальном времени для формы регистрации
    const regUsername = document.getElementById('regUsername');
    const regPassword = document.getElementById('regPassword');

    regUsername.addEventListener('input', function() {
        const value = this.value;
        const isValid = /^[a-zA-Z0-9]*$/.test(value) && value.length <= 50;
        
        if (!isValid && value.length > 0) {
            this.classList.add('is-invalid');
        } else {
            this.classList.remove('is-invalid');
        }
    });

    regPassword.addEventListener('input', function() {
        const value = this.value;
        const isValid = value.length >= 6 || value.length === 0;
        
        if (!isValid) {
            this.classList.add('is-invalid');
        } else {
            this.classList.remove('is-invalid');
        }
    });

    // Обработка Enter в полях ввода
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const form = this.closest('form');
                if (form && form.style.display !== 'none') {
                    form.dispatchEvent(new Event('submit'));
                }
            }
        });
    });
});