// Основная логика приложения

document.addEventListener('DOMContentLoaded', function() {
    // Проверяем авторизацию
    if (!api.isAuthenticated()) {
        window.location.href = '/login.html';
        return;
    }

    // Глобальные переменные
    let currentPage = 1;
    let isLoading = false;
    let hasMoreData = true;

    // Элементы DOM
    const measurementForm = document.getElementById('measurementForm');
    const measurementsTable = document.getElementById('measurementsTable');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
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

        // Устанавливаем текущую дату
        document.getElementById('measurementDate').value = getCurrentDate();

        // Устанавливаем диапазон дат для экспорта (последний месяц)
        document.getElementById('dateTo').value = getCurrentDate();
        document.getElementById('dateFrom').value = getDateMonthAgo();

        // Загружаем первую страницу данных
        await loadMeasurements();

        // Обработчики событий
        setupEventListeners();
    }

    function setupEventListeners() {
        // Форма добавления измерения
        measurementForm.addEventListener('submit', handleMeasurementSubmit);

        // Кнопка загрузки дополнительных данных
        loadMoreBtn.addEventListener('click', loadMoreMeasurements);

        // Кнопки меню
        exportBtn.addEventListener('click', () => exportModal.show());
        logoutBtn.addEventListener('click', handleLogout);

        // Кнопка скачивания
        downloadBtn.addEventListener('click', handleExport);

        // Валидация полей ввода
        setupValidation();
    }

    function setupValidation() {
        const systolic = document.getElementById('systolic');
        const diastolic = document.getElementById('diastolic');
        const pulse = document.getElementById('pulse');

        // Валидация систолического давления
        systolic.addEventListener('input', function() {
            const value = parseInt(this.value);
            const diastolicValue = parseInt(diastolic.value);
            
            if (value && diastolicValue && value <= diastolicValue) {
                this.setCustomValidity('Систолическое давление должно быть больше диастолического');
            } else {
                this.setCustomValidity('');
            }
        });

        // Валидация диастолического давления
        diastolic.addEventListener('input', function() {
            const value = parseInt(this.value);
            const systolicValue = parseInt(systolic.value);
            
            if (value && systolicValue && systolicValue <= value) {
                systolic.setCustomValidity('Систолическое давление должно быть больше диастолического');
            } else {
                systolic.setCustomValidity('');
            }
        });
    }

    async function handleMeasurementSubmit(e) {
        e.preventDefault();

        const date = document.getElementById('measurementDate').value;
        const type = document.getElementById('measurementType').value;
        const systolic = parseInt(document.getElementById('systolic').value);
        const diastolic = parseInt(document.getElementById('diastolic').value);
        const pulse = parseInt(document.getElementById('pulse').value);

        // Дополнительная валидация
        if (systolic <= diastolic) {
            showToast('Систолическое давление должно быть больше диастолического', 'error');
            return;
        }

        // Показываем индикатор загрузки
        const submitBtn = measurementForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Сохранение...';

        try {
            const response = await api.createMeasurement(date, type, systolic, diastolic, pulse);
            
            if (response.success) {
                showToast(response.message || 'Измерение сохранено', 'success');
                
                // Очищаем форму (кроме даты)
                document.getElementById('measurementType').value = '';
                document.getElementById('systolic').value = '';
                document.getElementById('diastolic').value = '';
                document.getElementById('pulse').value = '';

                // Перезагружаем данные
                await reloadMeasurements();
            }
        } catch (error) {
            showToast(error.message || 'Ошибка при сохранении измерения', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    async function loadMeasurements(page = 1) {
        if (isLoading) return;

        isLoading = true;
        showLoading(true);

        try {
            const response = await api.getMeasurements(page);
            
            if (response.success) {
                const measurements = response.data;
                
                if (page === 1) {
                    // Первая загрузка - очищаем таблицу
                    measurementsTable.innerHTML = '';
                }

                // Добавляем новые строки
                measurements.forEach(measurement => {
                    addMeasurementRow(measurement);
                });

                // Проверяем, есть ли еще данные
                hasMoreData = page < response.totalPages;
                
                // Показываем/скрываем кнопку "Загрузить еще"
                document.getElementById('loadMoreContainer').style.display = 
                    hasMoreData ? 'block' : 'none';

                currentPage = page;
            }
        } catch (error) {
            showToast(error.message || 'Ошибка при загрузке данных', 'error');
        } finally {
            isLoading = false;
            showLoading(false);
        }
    }

    async function loadMoreMeasurements() {
        if (hasMoreData) {
            await loadMeasurements(currentPage + 1);
        }
    }

    async function reloadMeasurements() {
        currentPage = 1;
        hasMoreData = true;
        await loadMeasurements(1);
    }

    function addMeasurementRow(measurement) {
        const row = document.createElement('tr');
        row.className = 'fade-in';
        
        const morningMeasurement = formatMeasurement(
            measurement.morning_systolic,
            measurement.morning_diastolic,
            measurement.morning_pulse
        );
        
        const eveningMeasurement = formatMeasurement(
            measurement.evening_systolic,
            measurement.evening_diastolic,
            measurement.evening_pulse
        );

        row.innerHTML = `
            <td>${formatDate(measurement.date)}</td>
            <td>${morningMeasurement}</td>
            <td>${eveningMeasurement}</td>
        `;

        measurementsTable.appendChild(row);
    }

    function showLoading(show) {
        loadingSpinner.style.display = show ? 'block' : 'none';
        loadMoreBtn.disabled = show;
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

    // Обработка клавиши Enter в форме
    measurementForm.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && e.target.type !== 'submit') {
            e.preventDefault();
            const inputs = Array.from(this.querySelectorAll('input, select'));
            const currentIndex = inputs.indexOf(e.target);
            
            if (currentIndex < inputs.length - 1) {
                inputs[currentIndex + 1].focus();
            } else {
                this.dispatchEvent(new Event('submit'));
            }
        }
    });

    // Автоматическое обновление даты в полночь
    setInterval(() => {
        const currentDateInput = document.getElementById('measurementDate');
        if (currentDateInput.value !== getCurrentDate()) {
            currentDateInput.value = getCurrentDate();
        }
    }, 60000); // Проверяем каждую минуту
});