const express = require('express');
const router = express.Router();
const Measurement = require('../models/Measurement');
const { authMiddleware } = require('../middleware/auth');
const { validateMeasurement, validateDateRange } = require('../utils/validation');

// Добавление нового измерения
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { date, type, systolic, diastolic, pulse } = req.body;
        const userId = req.user.id;

        // Валидация
        const errors = validateMeasurement(date, type, systolic, diastolic, pulse);
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: errors.join(', ')
            });
        }

        // Создание измерения
        const measurement = await Measurement.create(userId, date, type, parseInt(systolic), parseInt(diastolic), parseInt(pulse));
        
        res.status(201).json({
            success: true,
            data: measurement,
            message: measurement.created ? 'Measurement created successfully' : 'Measurement updated successfully'
        });
    } catch (error) {
        console.error('Create measurement error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Получение списка измерений с пагинацией
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const dateFrom = req.query.date_from;
        const dateTo = req.query.date_to;

        // Валидация диапазона дат
        if (dateFrom || dateTo) {
            const dateErrors = validateDateRange(dateFrom, dateTo);
            if (dateErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: dateErrors.join(', ')
                });
            }
        }

        // Получение измерений
        const result = await Measurement.findByUser(userId, page, limit, dateFrom, dateTo);
        
        res.json({
            success: true,
            data: result.data,
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: Math.ceil(result.total / result.limit)
        });
    } catch (error) {
        console.error('Get measurements error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Экспорт данных в CSV
router.get('/export', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const dateFrom = req.query.date_from;
        const dateTo = req.query.date_to;

        // Валидация диапазона дат
        if (dateFrom || dateTo) {
            const dateErrors = validateDateRange(dateFrom, dateTo);
            if (dateErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: dateErrors.join(', ')
                });
            }
        }

        // Получение данных для экспорта
        const measurements = await Measurement.exportByUser(userId, dateFrom, dateTo);
        
        // Формирование CSV
        let csv = 'Date,Morning Systolic,Morning Diastolic,Morning Pulse,Evening Systolic,Evening Diastolic,Evening Pulse\n';
        
        measurements.forEach(measurement => {
            csv += `${measurement.date},`;
            csv += `${measurement.morning_systolic || ''},`;
            csv += `${measurement.morning_diastolic || ''},`;
            csv += `${measurement.morning_pulse || ''},`;
            csv += `${measurement.evening_systolic || ''},`;
            csv += `${measurement.evening_diastolic || ''},`;
            csv += `${measurement.evening_pulse || ''}\n`;
        });

        const filename = `blood_pressure_${dateFrom || 'all'}_to_${dateTo || 'now'}.csv`;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (error) {
        console.error('Export measurements error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;