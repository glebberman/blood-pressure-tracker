// API утилиты для работы с сервером
class API {
    constructor() {
        this.baseURL = '/api';
        this.token = localStorage.getItem('authToken');
    }

    // Получение заголовков для запросов
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (includeAuth && this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    // Универсальный метод для HTTP запросов
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getHeaders(options.auth !== false),
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            // Проверка на 401 (неавторизован)
            if (response.status === 401 && this.token) {
                this.logout();
                window.location.href = '/login.html';
                return;
            }

            // Если ответ не JSON (например, CSV файл)
            if (options.responseType === 'blob') {
                return response;
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }

    // Методы аутентификации
    async register(username, password, name) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, name }),
            auth: false
        });
    }

    async login(username, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
            auth: false
        });

        if (data.success && data.token) {
            this.token = data.token;
            localStorage.setItem('authToken', this.token);
            localStorage.setItem('user', JSON.stringify(data.user));
        }

        return data;
    }

    logout() {
        this.token = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
    }

    // Проверка авторизации
    isAuthenticated() {
        return !!this.token;
    }

    // Получение данных пользователя из localStorage
    getUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    }

    // Методы для работы с измерениями
    async createMeasurement(date, type, systolic, diastolic, pulse) {
        return this.request('/measurements', {
            method: 'POST',
            body: JSON.stringify({ date, type, systolic, diastolic, pulse })
        });
    }

    async getMeasurements(page = 1, limit = 20, dateFrom = null, dateTo = null) {
        const params = new URLSearchParams({ page, limit });
        
        if (dateFrom) params.append('date_from', dateFrom);
        if (dateTo) params.append('date_to', dateTo);

        return this.request(`/measurements?${params.toString()}`);
    }

    async exportMeasurements(dateFrom = null, dateTo = null) {
        const params = new URLSearchParams();
        
        if (dateFrom) params.append('date_from', dateFrom);
        if (dateTo) params.append('date_to', dateTo);

        const response = await this.request(`/measurements/export?${params.toString()}`, {
            responseType: 'blob'
        });

        return response;
    }
}

// Создаем глобальный экземпляр API
window.api = new API();

// Утилиты для работы с уведомлениями
window.showToast = function(message, type = 'info', title = 'Уведомление') {
    const toast = document.getElementById('toast');
    const toastTitle = document.getElementById('toastTitle');
    const toastBody = document.getElementById('toastBody');
    
    // Удаляем предыдущие классы
    toast.className = 'toast';
    
    // Добавляем класс в зависимости от типа
    if (type === 'success') {
        toast.classList.add('bg-success', 'text-white');
        title = title || 'Успешно';
    } else if (type === 'error') {
        toast.classList.add('bg-danger', 'text-white');
        title = title || 'Ошибка';
    } else if (type === 'warning') {
        toast.classList.add('bg-warning');
        title = title || 'Предупреждение';
    }
    
    toastTitle.textContent = title;
    toastBody.textContent = message;
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
};

// Утилита для форматирования даты
window.formatDate = function(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
};

// Утилита для форматирования измерения
window.formatMeasurement = function(systolic, diastolic, pulse) {
    if (!systolic || !diastolic || !pulse) {
        return '<span class="measurement-empty">—</span>';
    }
    return `<span class="measurement-cell">${systolic}/${diastolic} <small class="text-muted">${pulse}</small></span>`;
};

// Утилита для получения текущей даты в формате YYYY-MM-DD
window.getCurrentDate = function() {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

// Утилита для получения даты месяц назад
window.getDateMonthAgo = function() {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return now.toISOString().split('T')[0];
};