const bcrypt = require('bcryptjs');
const database = require('../config/database');

class User {
    static async create(username, password, name) {
        return new Promise((resolve, reject) => {
            const hashedPassword = bcrypt.hashSync(password, 10);
            const db = database.getDb();
            
            db.run(
                'INSERT INTO users (username, password, name) VALUES (?, ?, ?)',
                [username, hashedPassword, name],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, username, name });
                    }
                }
            );
        });
    }

    static async findByUsername(username) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            
            db.get(
                'SELECT * FROM users WHERE username = ?',
                [username],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    static async findById(id) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            
            db.get(
                'SELECT id, username, name, created_at FROM users WHERE id = ?',
                [id],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    static validatePassword(plainPassword, hashedPassword) {
        return bcrypt.compareSync(plainPassword, hashedPassword);
    }
}

module.exports = User;