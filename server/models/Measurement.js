const database = require('../config/database');

class Measurement {
    static async create(userId, date, type, systolic, diastolic, pulse) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            
            // Сначала получаем существующую запись для данной даты
            db.get(
                'SELECT * FROM measurements WHERE user_id = ? AND date = ?',
                [userId, date],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (row) {
                        // Обновляем существующую запись
                        const updateFields = {};
                        if (type === 'morning') {
                            updateFields.morning_systolic = systolic;
                            updateFields.morning_diastolic = diastolic;
                            updateFields.morning_pulse = pulse;
                        } else {
                            updateFields.evening_systolic = systolic;
                            updateFields.evening_diastolic = diastolic;
                            updateFields.evening_pulse = pulse;
                        }

                        const setClause = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
                        const values = Object.values(updateFields);
                        values.push(row.id);

                        db.run(
                            `UPDATE measurements SET ${setClause} WHERE id = ?`,
                            values,
                            function(err) {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({ id: row.id, ...updateFields, updated: true });
                                }
                            }
                        );
                    } else {
                        // Создаем новую запись
                        const fields = {
                            user_id: userId,
                            date: date,
                            morning_systolic: null,
                            morning_diastolic: null,
                            morning_pulse: null,
                            evening_systolic: null,
                            evening_diastolic: null,
                            evening_pulse: null
                        };

                        if (type === 'morning') {
                            fields.morning_systolic = systolic;
                            fields.morning_diastolic = diastolic;
                            fields.morning_pulse = pulse;
                        } else {
                            fields.evening_systolic = systolic;
                            fields.evening_diastolic = diastolic;
                            fields.evening_pulse = pulse;
                        }

                        db.run(
                            `INSERT INTO measurements (user_id, date, morning_systolic, morning_diastolic, morning_pulse, evening_systolic, evening_diastolic, evening_pulse) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            [fields.user_id, fields.date, fields.morning_systolic, fields.morning_diastolic, fields.morning_pulse, fields.evening_systolic, fields.evening_diastolic, fields.evening_pulse],
                            function(err) {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({ id: this.lastID, ...fields, created: true });
                                }
                            }
                        );
                    }
                }
            );
        });
    }

    static async findByUser(userId, page = 1, limit = 20, dateFrom = null, dateTo = null) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            const offset = (page - 1) * limit;
            
            let whereClause = 'WHERE user_id = ?';
            let params = [userId];
            
            if (dateFrom) {
                whereClause += ' AND date >= ?';
                params.push(dateFrom);
            }
            
            if (dateTo) {
                whereClause += ' AND date <= ?';
                params.push(dateTo);
            }
            
            // Получаем общее количество записей
            db.get(
                `SELECT COUNT(*) as total FROM measurements ${whereClause}`,
                params,
                (err, countRow) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // Получаем записи с пагинацией
                    params.push(limit, offset);
                    db.all(
                        `SELECT * FROM measurements ${whereClause} ORDER BY date DESC LIMIT ? OFFSET ?`,
                        params,
                        (err, rows) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve({
                                    data: rows,
                                    total: countRow.total,
                                    page: page,
                                    limit: limit
                                });
                            }
                        }
                    );
                }
            );
        });
    }

    static async exportByUser(userId, dateFrom = null, dateTo = null) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            
            let whereClause = 'WHERE user_id = ?';
            let params = [userId];
            
            if (dateFrom) {
                whereClause += ' AND date >= ?';
                params.push(dateFrom);
            }
            
            if (dateTo) {
                whereClause += ' AND date <= ?';
                params.push(dateTo);
            }
            
            db.all(
                `SELECT date, morning_systolic, morning_diastolic, morning_pulse, evening_systolic, evening_diastolic, evening_pulse 
                 FROM measurements ${whereClause} ORDER BY date DESC`,
                params,
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }
}

module.exports = Measurement;