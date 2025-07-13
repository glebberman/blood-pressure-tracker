// Основная логика приложения

document.addEventListener('DOMContentLoaded', function() {
    // Проверяем авторизацию
    if (!api.isAuthenticated()) {
        window.location.href = '/login.html';
        return;
    }

    // Глобальные переменные
    let measurementsData = new Map(); // Кэш данных измерений
    let saveTimeouts = new Map(); // Таймеры для автосохранения
    let isLoading = false;

    // Элементы DOM
    const measurementsTable = document.getElementById('measurementsTable');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const exportModal = new bootstrap.Modal(document.getElementById('exportModal'));
    const exportBtn = document.getElementById('exportBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userName = document.getElementById('userName');

    // Инициализация
    init();

    async function init() {
        // Отображаем имя пользователя
        const user = api.getUser();
        if (user) {
            userName.textContent = user.name;
        }

        // Устанавливаем диапазон дат для экспорта (последний месяц)
        document.getElementById('dateTo').value = getCurrentDate();
        document.getElementById('dateFrom').value = getDateMonthAgo();

        // Создаем таблицу с 30+ днями
        await createDateTable();

        // Загружаем данные измерений
        await loadMeasurements();

        // Обработчики событий
        setupEventListeners();
    }

    function setupEventListeners() {
        // Кнопки меню
        exportBtn.addEventListener('click', () => exportModal.show());
        logoutBtn.addEventListener('click', handleLogout);

        // Кнопка скачивания
        downloadBtn.addEventListener('click', handleExport);

        // Обработчики для inline редактирования
        setupInlineEditing();
    }

    // Создание таблицы с 30+ днями
    async function createDateTable() {
        const today = new Date();
        const dates = [];
        
        // Создаем массив дат на 30 дней назад от сегодня
        for (let i = 0; i < 30; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            dates.push(date.toISOString().split('T')[0]);
        }
        
        // Очищаем таблицу
        measurementsTable.innerHTML = '';
        
        // Создаем строки для каждой даты
        dates.forEach(date => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatDate(date)}</td>
                <td class="editable-cell" data-date="${date}" data-type="morning">
                    <span class="measurement-display">—</span>
                </td>
                <td class="editable-cell" data-date="${date}" data-type="evening">
                    <span class="measurement-display">—</span>
                </td>
            `;
            measurementsTable.appendChild(row);
        });
    }

    // Настройка inline редактирования
    function setupInlineEditing() {
        measurementsTable.addEventListener('click', function(e) {
            const cell = e.target.closest('.editable-cell');
            if (cell && !cell.querySelector('input')) {
                makeEditable(cell);
            }
        });
    }
    
    // Делаем ячейку редактируемой
    function makeEditable(cell) {
        const currentValue = cell.querySelector('.measurement-display').textContent;
        const date = cell.dataset.date;
        const type = cell.dataset.type;
        
        // Создаем input поле
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control form-control-sm';
        input.placeholder = 'ddd/dd ddd';
        input.value = currentValue === '—' ? '' : currentValue;
        
        // Заменяем содержимое ячейки
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();
        
        // Обработчики событий
        input.addEventListener('blur', () => handleCellSave(cell, input, date, type));
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        });
        
        // Автосохранение через 5 секунд
        const timeoutKey = `${date}-${type}`;
        if (saveTimeouts.has(timeoutKey)) {
            clearTimeout(saveTimeouts.get(timeoutKey));
        }
        
        const timeout = setTimeout(() => {
            if (document.contains(input)) {
                input.blur();
            }
        }, 5000);
        
        saveTimeouts.set(timeoutKey, timeout);
    }

    // Обработка сохранения данных из ячейки
    async function handleCellSave(cell, input, date, type) {
        const value = input.value.trim();
        const timeoutKey = `${date}-${type}`;
        
        // Очищаем таймер автосохранения
        if (saveTimeouts.has(timeoutKey)) {
            clearTimeout(saveTimeouts.get(timeoutKey));
            saveTimeouts.delete(timeoutKey);
        }
        
        if (value === '') {
            // Пустое значение - показываем прочерк
            restoreCell(cell, '—');
            return;
        }
        
        // Валидация формата
        const validationResult = validateMeasurementFormat(value);
        if (!validationResult.isValid) {
            // Неверный формат - восстанавливаем предыдущее значение
            const originalValue = measurementsData.get(`${date}-${type}`) || '—';
            restoreCell(cell, originalValue);
            showToast('Неверный формат данных. Используйте формат: 120/80 70', 'error');
            return;
        }
        
        // Сохраняем данные
        const { systolic, diastolic, pulse } = validationResult;
        
        try {
            // Показываем индикатор загрузки в ячейке
            cell.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div>';
            
            const response = await api.createMeasurement(date, type, systolic, diastolic, pulse);
            
            if (response.success) {
                const formattedValue = `${systolic}/${diastolic} ${pulse}`;
                measurementsData.set(`${date}-${type}`, formattedValue);
                restoreCell(cell, formattedValue);
                showToast('Измерение сохранено', 'success');
            } else {
                throw new Error(response.message || 'Ошибка сохранения');
            }
        } catch (error) {
            const originalValue = measurementsData.get(`${date}-${type}`) || '—';
            restoreCell(cell, originalValue);
            showToast(error.message || 'Ошибка при сохранении', 'error');
        }
    }
    
    // Восстановление обычного вида ячейки
    function restoreCell(cell, value) {
        cell.innerHTML = `<span class="measurement-display">${value}</span>`;
    }
    
    // Валидация формата измерения
    function validateMeasurementFormat(value) {
        // Regex для формата: ddd/dd ddd (например: 120/80 70)
        const regex = /^(\d{2,3})\/(\d{2,3})\s+(\d{2,3})$/;
        const match = value.match(regex);
        
        if (!match) {
            return { isValid: false };
        }
        
        const systolic = parseInt(match[1]);
        const diastolic = parseInt(match[2]);
        const pulse = parseInt(match[3]);
        
        // Проверяем диапазоны
        if (systolic < 50 || systolic > 300 ||
            diastolic < 30 || diastolic > 200 ||
            pulse < 30 || pulse > 200 ||
            systolic <= diastolic) {
            return { isValid: false };
        }
        
        return { isValid: true, systolic, diastolic, pulse };
    }

    // Загрузка данных измерений и заполнение таблицы
    async function loadMeasurements() {
        if (isLoading) return;

        isLoading = true;
        showLoading(true);

        try {
            // Загружаем данные за последние 30 дней
            const dateTo = getCurrentDate();
            const dateFrom = getDateNDaysAgo(29);
            
            const response = await api.getMeasurements(1, 100, dateFrom, dateTo);
            
            if (response.success) {
                // Заполняем кэш данных
                response.data.forEach(measurement => {
                    if (measurement.morning_systolic) {
                        const morningValue = `${measurement.morning_systolic}/${measurement.morning_diastolic} ${measurement.morning_pulse}`;
                        measurementsData.set(`${measurement.date}-morning`, morningValue);
                    }
                    if (measurement.evening_systolic) {
                        const eveningValue = `${measurement.evening_systolic}/${measurement.evening_diastolic} ${measurement.evening_pulse}`;
                        measurementsData.set(`${measurement.date}-evening`, eveningValue);
                    }
                });
                
                // Обновляем таблицу
                updateTableWithData();
            }
        } catch (error) {
            showToast(error.message || 'Ошибка при загрузке данных', 'error');
        } finally {
            isLoading = false;
            showLoading(false);
        }
    }
    
    // Обновление таблицы с загруженными данными
    function updateTableWithData() {
        const cells = measurementsTable.querySelectorAll('.editable-cell');
        cells.forEach(cell => {
            const date = cell.dataset.date;
            const type = cell.dataset.type;
            const key = `${date}-${type}`;
            const value = measurementsData.get(key) || '—';
            
            const display = cell.querySelector('.measurement-display');
            if (display) {
                display.textContent = value;
            }
        });
    }

    function showLoading(show) {
        loadingSpinner.style.display = show ? 'block' : 'none';
    }

    async function handleExport() {
        const dateFrom = document.getElementById('dateFrom').value;
        const dateTo = document.getElementById('dateTo').value;

        // Валидация дат
        if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
            showToast('Начальная дата не может быть позже конечной', 'error');
            return;
        }

        // Показываем индикатор загрузки
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Скачивание...';

        try {
            const response = await api.exportMeasurements(dateFrom, dateTo);
            
            if (response.ok) {
                // Создаем ссылку для скачивания
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `blood_pressure_${dateFrom || 'all'}_to_${dateTo || 'now'}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                showToast('Файл успешно скачан', 'success');
                exportModal.hide();
            } else {
                throw new Error('Ошибка при скачивании файла');
            }
        } catch (error) {
            showToast(error.message || 'Ошибка при экспорте данных', 'error');
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = 'Скачать';
        }
    }

    function handleLogout() {
        if (confirm('Вы уверены, что хотите выйти?')) {
            api.logout();
            showToast('Вы вышли из системы', 'success');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 1000);
        }
    }

    // Утилита для получения даты N дней назад
    function getDateNDaysAgo(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString().split('T')[0];
    }
});