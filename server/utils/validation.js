const validateRegister = (username, password, name) => {
    const errors = [];

    if (!username || username.length < 3 || username.length > 50) {
        errors.push('Username must be between 3 and 50 characters');
    }

    if (!/^[a-zA-Z0-9]+$/.test(username)) {
        errors.push('Username can only contain letters and numbers');
    }

    if (!password || password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }

    if (!name || name.trim().length === 0) {
        errors.push('Name is required');
    }

    return errors;
};

const validateLogin = (username, password) => {
    const errors = [];

    if (!username || username.trim().length === 0) {
        errors.push('Username is required');
    }

    if (!password || password.trim().length === 0) {
        errors.push('Password is required');
    }

    return errors;
};

const validateMeasurement = (date, type, systolic, diastolic, pulse) => {
    const errors = [];

    if (!date) {
        errors.push('Date is required');
    } else {
        const measurementDate = new Date(date);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        if (measurementDate > today) {
            errors.push('Date cannot be in the future');
        }
    }

    if (!type || !['morning', 'evening'].includes(type)) {
        errors.push('Type must be either "morning" or "evening"');
    }

    if (!systolic || systolic < 50 || systolic > 300) {
        errors.push('Systolic pressure must be between 50 and 300 mmHg');
    }

    if (!diastolic || diastolic < 30 || diastolic > 200) {
        errors.push('Diastolic pressure must be between 30 and 200 mmHg');
    }

    if (!pulse || pulse < 30 || pulse > 200) {
        errors.push('Pulse must be between 30 and 200 bpm');
    }

    if (systolic && diastolic && systolic <= diastolic) {
        errors.push('Systolic pressure must be higher than diastolic pressure');
    }

    return errors;
};

const validateDateRange = (dateFrom, dateTo) => {
    const errors = [];

    if (dateFrom && dateTo) {
        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);
        
        if (fromDate > toDate) {
            errors.push('Start date cannot be later than end date');
        }
    }

    return errors;
};

module.exports = {
    validateRegister,
    validateLogin,
    validateMeasurement,
    validateDateRange
};