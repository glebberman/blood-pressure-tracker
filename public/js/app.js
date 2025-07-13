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
    let currentDaysLoaded = 30; // Количество загруженных дней
    let loadingMoreData = false; // Флаг загрузки доп. данных

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
        
        // Настройка ленивой загрузки
        setupInfiniteScroll();
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
        // Очищаем таблицу
        measurementsTable.innerHTML = '';
        
        // Создаем первые 30 дней
        addDaysToTable(30);
        currentDaysLoaded = 30;
    }
    
    // Добавление дней в таблицу
    function addDaysToTable(daysCount, startFromDay = 0) {
        const today = new Date();
        const dates = [];
        
        // Создаем массив дат
        for (let i = startFromDay; i < startFromDay + daysCount; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            dates.push(date.toISOString().split('T')[0]);
        }
        
        // Создаем строки для каждой даты
        dates.forEach(date => {
            const row = document.createElement('tr');
            
            // Проверяем, является ли дата первым числом месяца
            const dateObj = new Date(date);
            const isFirstOfMonth = dateObj.getDate() === 1;
            const rowClass = isFirstOfMonth ? 'month-border' : '';
            
            row.className = rowClass;
            row.innerHTML = `
                <td>${formatDate(date)}</td>
                <td class="editable-cell" data-date="${date}" data-type="morning">
                    <span class="measurement-display">—</span>
                </td>
                <td class="editable-cell" data-date="${date}" data-type="evening">
                    <span class="measurement-display">—</span>
                </td>
            `;
            
            if (startFromDay === 0) {
                measurementsTable.appendChild(row);
            } else {
                // Добавляем в конец таблицы
                measurementsTable.appendChild(row);
            }
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
        input.placeholder = '120/80 70';
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
        
        // Обработка backspace для слэша
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                handleBackspace(e, input);
            }
        });
        
        // Автоформатирование ввода
        input.addEventListener('input', (e) => handleInputFormatting(e, input));
        
        // Автосохранение через 5 секунд (без потери фокуса)
        setupAutoSave(input, cell, date, type);
    }

    // Обработка нажатия backspace для удаления слэша
    function handleBackspace(e, input) {
        const value = input.value;
        const cursorPosition = input.selectionStart;
        
        // Если курсор находится сразу после слэша
        if (cursorPosition > 0 && value.charAt(cursorPosition - 1) === '/') {
            e.preventDefault();
            
            // Удаляем слэш и предыдущую цифру
            const beforeSlash = value.substring(0, cursorPosition - 2);
            const afterSlash = value.substring(cursorPosition);
            
            input.value = beforeSlash + afterSlash;
            input.setSelectionRange(cursorPosition - 2, cursorPosition - 2);
        }
    }

    // Автоформатирование ввода
    function handleInputFormatting(e, input) {
        // Получаем текущую позицию курсора
        const cursorPosition = input.selectionStart;
        const oldValue = input.value;
        
        // Удаляем все нецифровые символы для анализа
        const digitsOnly = oldValue.replace(/[^\d]/g, '');
        
        // Ограничиваем количество цифр
        if (digitsOnly.length > 7) {
            input.value = oldValue.substring(0, oldValue.length - 1);
            input.setSelectionRange(cursorPosition - 1, cursorPosition - 1);
            return;
        }
        
        let formattedValue = '';
        
        if (digitsOnly.length === 0) {
            formattedValue = '';
        } else if (digitsOnly.length <= 2) {
            // 1-2 цифры: просто показываем цифры
            formattedValue = digitsOnly;
        } else if (digitsOnly.length === 3) {
            // 3 цифры: автоматически добавляем слэш
            formattedValue = digitsOnly + '/';
        } else if (digitsOnly.length <= 5) {
            // 4-5 цифр: формат XXX/XX
            const systolic = digitsOnly.substring(0, 3);
            const diastolic = digitsOnly.substring(3);
            formattedValue = systolic + '/' + diastolic;
        } else if (digitsOnly.length === 6) {
            // 6 цифр: автоматически добавляем пробел
            const systolic = digitsOnly.substring(0, 3);
            const diastolic = digitsOnly.substring(3, 5);
            const pulse = digitsOnly.substring(5);
            formattedValue = systolic + '/' + diastolic + ' ' + pulse;
        } else {
            // 7 цифр: полный формат XXX/XX XXX
            const systolic = digitsOnly.substring(0, 3);
            const diastolic = digitsOnly.substring(3, 5);
            const pulse = digitsOnly.substring(5, 7);
            formattedValue = systolic + '/' + diastolic + ' ' + pulse;
        }
        
        // Устанавливаем новое значение
        input.value = formattedValue;
        
        // Корректируем позицию курсора
        let newCursorPosition = cursorPosition;
        if (formattedValue.length > oldValue.length) {
            // Добавился символ - сдвигаем курсор
            newCursorPosition += (formattedValue.length - oldValue.length);
        }
        
        // Устанавливаем курсор в конец, если он выходит за границы
        if (newCursorPosition > formattedValue.length) {
            newCursorPosition = formattedValue.length;
        }
        
        input.setSelectionRange(newCursorPosition, newCursorPosition);
    }
    
    // Настройка автосохранения
    function setupAutoSave(input, cell, date, type) {
        const timeoutKey = `${date}-${type}`;
        
        function scheduleAutoSave() {
            // Очищаем предыдущий таймер
            if (saveTimeouts.has(timeoutKey)) {
                clearTimeout(saveTimeouts.get(timeoutKey));
            }
            
            // Устанавливаем новый таймер
            const timeout = setTimeout(async () => {
                const value = input.value.trim();
                if (value && validateMeasurementFormat(value).isValid) {
                    await saveValueWithoutClosing(input, cell, date, type, value);
                }
            }, 5000);
            
            saveTimeouts.set(timeoutKey, timeout);
        }
        
        // Перепланируем сохранение при каждом вводе
        input.addEventListener('input', scheduleAutoSave);
        
        // Начальное планирование
        scheduleAutoSave();
    }
    
    // Сохранение без закрытия поля
    async function saveValueWithoutClosing(input, cell, date, type, value) {
        const validationResult = validateMeasurementFormat(value);
        if (!validationResult.isValid) return;
        
        const { systolic, diastolic, pulse } = validationResult;
        
        try {
            const response = await api.createMeasurement(date, type, systolic, diastolic, pulse);
            
            if (response.success) {
                const formattedValue = `${systolic}/${diastolic} ${pulse}`;
                measurementsData.set(`${date}-${type}`, formattedValue);
                
                // Показываем кратковременное уведомление
                showToast('Сохранено', 'success');
                
                // Обновляем плейсхолдер или добавляем визуальную обратную связь
                input.style.backgroundColor = '#d4edda';
                setTimeout(() => {
                    if (document.contains(input)) {
                        input.style.backgroundColor = '';
                    }
                }, 1000);
            }
        } catch (error) {
            // Не показываем ошибку при автосохранении
        }
    }
    
    // Обработка сохранения данных из ячейки (при потере фокуса)
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
        
        // Проверяем, не было ли уже сохранено автоматически
        const { systolic, diastolic, pulse } = validationResult;
        const formattedValue = `${systolic}/${diastolic} ${pulse}`;
        const currentSavedValue = measurementsData.get(`${date}-${type}`);
        
        if (currentSavedValue === formattedValue) {
            // Данные уже сохранены, просто закрываем поле
            restoreCell(cell, formattedValue);
            return;
        }
        
        // Сохраняем данные
        try {
            // Показываем индикатор загрузки в ячейке
            cell.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div>';
            
            const response = await api.createMeasurement(date, type, systolic, diastolic, pulse);
            
            if (response.success) {
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
            // Загружаем данные за загруженные дни
            const dateTo = getCurrentDate();
            const dateFrom = getDateNDaysAgo(currentDaysLoaded - 1);
            
            const response = await api.getMeasurements(1, 1000, dateFrom, dateTo);
            
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
    
    // Ленивая загрузка предыдущих дней
    async function loadMoreDays() {
        if (loadingMoreData) return;
        
        loadingMoreData = true;
        
        try {
            // Добавляем еще 30 дней в таблицу
            addDaysToTable(30, currentDaysLoaded);
            currentDaysLoaded += 30;
            
            // Загружаем данные для новых дней
            const dateTo = getDateNDaysAgo(currentDaysLoaded - 30);
            const dateFrom = getDateNDaysAgo(currentDaysLoaded - 1);
            
            const response = await api.getMeasurements(1, 1000, dateFrom, dateTo);
            
            if (response.success) {
                // Добавляем новые данные в кэш
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
                
                // Обновляем только новые ячейки
                updateNewCellsWithData();
            }
        } catch (error) {
            console.error('Ошибка при загрузке дополнительных данных:', error);
        } finally {
            loadingMoreData = false;
        }
    }
    
    // Настройка бесконечной прокрутки
    function setupInfiniteScroll() {
        const tableContainer = document.querySelector('.table-responsive');
        
        tableContainer.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = tableContainer;
            
            // Если прокрутили почти до конца (осталось 200px)
            if (scrollHeight - scrollTop - clientHeight < 200 && !loadingMoreData) {
                loadMoreDays();
            }
        });
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
    
    // Обновление только новых ячеек
    function updateNewCellsWithData() {
        const allRows = measurementsTable.querySelectorAll('tr');
        const newRows = Array.from(allRows).slice(-30); // Последние 30 строк
        
        newRows.forEach(row => {
            const cells = row.querySelectorAll('.editable-cell');
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