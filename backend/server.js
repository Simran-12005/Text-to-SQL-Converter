// server.js
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Database directory
const DB_DIR = path.join(__dirname, 'databases');
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR);
}

// Store database connections
const dbConnections = new Map();

// Helper function to get database connection
const getDBConnection = (dbName) => {
    const dbPath = path.join(DB_DIR, `${dbName}.db`);
    
    if (!dbConnections.has(dbName)) {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            }
        });
        dbConnections.set(dbName, db);
    }
    
    return dbConnections.get(dbName);
};

// Helper function to get all databases
const getDatabases = () => {
    return fs.readdirSync(DB_DIR)
        .filter(file => file.endsWith('.db'))
        .map(file => file.replace('.db', ''));
};

// Initialize metadata database
const initMetadataDB = () => {
    const metadataDB = new sqlite3.Database(path.join(__dirname, 'metadata.db'));
    
    metadataDB.run(`
        CREATE TABLE IF NOT EXISTS databases (
            name TEXT PRIMARY KEY,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    metadataDB.run(`
        CREATE TABLE IF NOT EXISTS tables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            database_name TEXT,
            table_name TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (database_name) REFERENCES databases (name)
        )
    `);
    
    metadataDB.run(`
        CREATE TABLE IF NOT EXISTS columns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            database_name TEXT,
            table_name TEXT,
            column_name TEXT,
            data_type TEXT,
            is_primary_key BOOLEAN,
            is_nullable BOOLEAN,
            description TEXT,
            FOREIGN KEY (database_name) REFERENCES databases (name),
            FOREIGN KEY (table_name) REFERENCES tables (table_name)
        )
    `);
    
    return metadataDB;
};

const metadataDB = initMetadataDB();

// Routes

// Get all databases
app.get('/databases', (req, res) => {
    const query = `
        SELECT d.name, d.description, d.created_at, 
               COUNT(t.table_name) as table_count
        FROM databases d
        LEFT JOIN tables t ON d.name = t.database_name
        GROUP BY d.name
        ORDER BY d.created_at DESC
    `;
    
    metadataDB.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ databases: rows });
    });
});

// Create a new database
app.post('/databases', (req, res) => {
    const { name, description } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Database name is required' });
    }
    
    // Create physical database file
    const dbPath = path.join(DB_DIR, `${name}.db`);
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to create database file' });
        }
    });
    
    // Close the initial connection
    db.close();
    
    // Add to metadata
    metadataDB.run(
        'INSERT INTO databases (name, description) VALUES (?, ?)',
        [name, description || ''],
        function(err) {
            if (err) {
                // If metadata insertion fails, delete the database file
                fs.unlinkSync(dbPath);
                return res.status(500).json({ error: err.message });
            }
            
            res.json({ message: 'Database created successfully', database: { name, description } });
        }
    );
});

// Get tables for a database
app.get('/tables/:database', (req, res) => {
    const { database } = req.params;
    
    // Check if database exists
    const dbPath = path.join(DB_DIR, `${database}.db`);
    if (!fs.existsSync(dbPath)) {
        return res.status(404).json({ error: 'Database not found' });
    }
    
    const query = `
        SELECT t.table_name, t.description, t.created_at,
               COUNT(c.column_name) as column_count
        FROM tables t
        LEFT JOIN columns c ON t.database_name = c.database_name AND t.table_name = c.table_name
        WHERE t.database_name = ?
        GROUP BY t.table_name
        ORDER BY t.created_at DESC
    `;
    
    metadataDB.all(query, [database], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ tables: rows });
    });
});

// Create a new table
app.post('/tables', (req, res) => {
    const { database, table_name, description, columns } = req.body;
    
    if (!database || !table_name || !columns) {
        return res.status(400).json({ error: 'Database name, table name, and columns are required' });
    }
    
    const db = getDBConnection(database);
    
    // Build CREATE TABLE query
    const columnDefinitions = columns.map(col => {
        let definition = `${col.column_name} ${col.data_type}`;
        if (col.is_primary_key) definition += ' PRIMARY KEY';
        if (!col.is_nullable) definition += ' NOT NULL';
        return definition;
    }).join(', ');
    
    const createTableSQL = `CREATE TABLE IF NOT EXISTS ${table_name} (${columnDefinitions})`;
    
    db.run(createTableSQL, (err) => {
        if (err) {
            return res.status(500).json({ error: `Failed to create table: ${err.message}` });
        }
        
        // Add to metadata
        metadataDB.run(
            'INSERT INTO tables (database_name, table_name, description) VALUES (?, ?, ?)',
            [database, table_name, description || ''],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                // Add columns to metadata
                const columnPromises = columns.map(column => {
                    return new Promise((resolve, reject) => {
                        metadataDB.run(
                            `INSERT INTO columns (database_name, table_name, column_name, data_type, is_primary_key, is_nullable, description) 
                             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [database, table_name, column.column_name, column.data_type, 
                             column.is_primary_key, column.is_nullable, column.description || ''],
                            (err) => {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    });
                });
                
                Promise.all(columnPromises)
                    .then(() => {
                        res.json({ message: 'Table created successfully' });
                    })
                    .catch(error => {
                        res.status(500).json({ error: `Failed to save column metadata: ${error.message}` });
                    });
            }
        );
    });
});

// Enhanced Text to SQL conversion
app.post('/convert', (req, res) => {
    const { text, database, table } = req.body;
    
    if (!text || !database || !table) {
        return res.status(400).json({ error: 'Text, database, and table are required' });
    }
    
    const db = getDBConnection(database);
    
    // First, get table schema to understand available columns
    db.all(`PRAGMA table_info(${table})`, [], (err, columns) => {
        if (err) {
            return res.status(500).json({ error: `Failed to get table schema: ${err.message}` });
        }
        
        const columnNames = columns.map(col => col.name);
        const columnTypes = columns.reduce((acc, col) => {
            acc[col.name] = col.type;
            return acc;
        }, {});
        
        // Generate SQL based on natural language
        const { sqlQuery, error } = generateSQLFromText(text, table, columnNames, columnTypes);
        
        if (error) {
            return res.status(400).json({ error });
        }
        
        // Execute the generated SQL
        db.all(sqlQuery, [], (err, rows) => {
            if (err) {
                return res.status(500).json({ error: `SQL Error: ${err.message}` });
            }
            
            res.json({
                original_text: text,
                sql_query: sqlQuery,
                results: rows
            });
        });
    });
});

// Enhanced SQL generation function
function generateSQLFromText(text, table, columnNames, columnTypes) {
    const lowerText = text.toLowerCase().trim();
    
    // Common patterns and their SQL equivalents
    const patterns = [
        {
            pattern: /\b(count|how many)\b.*\b(all|everything|records|rows)\b/i,
            sql: `SELECT COUNT(*) as count FROM ${table}`,
            description: "Count all records"
        },
        {
            pattern: /\b(count|how many)\b/i,
            sql: `SELECT COUNT(*) as count FROM ${table}`,
            description: "Count records"
        },
        {
            pattern: /\bshow\s+me\s+all\b|\bselect\s+all\b|\bget\s+all\b|\blist\s+all\b|\beverything\b/i,
            sql: `SELECT * FROM ${table}`,
            description: "Select all records"
        },
        {
            pattern: /\bfind\s+records\s+where\b|\bfilter\s+by\b/i,
            sql: (text) => {
                const conditions = extractWhereConditions(text, columnNames, columnTypes);
                return `SELECT * FROM ${table} WHERE ${conditions}`;
            },
            description: "Filter records with conditions"
        },
        {
            pattern: /\bshow\s+(?:me\s+)?(.*?)\s+where\b/i,
            sql: (text) => {
                const match = text.match(/show\s+(?:me\s+)?(.*?)\s+where/i);
                const columns = extractColumns(match[1], columnNames);
                const conditions = extractWhereConditions(text, columnNames, columnTypes);
                return `SELECT ${columns} FROM ${table} WHERE ${conditions}`;
            },
            description: "Select specific columns with conditions"
        },
        {
            pattern: /\b(what|which|show me|display|get)\b.*\b(but|only|just)\s+([\w\s,]+)\b/i,
            sql: (text) => {
                const match = text.match(/(?:but|only|just)\s+([\w\s,]+)/i);
                const columns = extractColumns(match[1], columnNames);
                return `SELECT ${columns} FROM ${table}`;
            },
            description: "Select specific columns"
        },
        {
            pattern: /\border\s+by\b|\bsort\s+by\b|\bsorted\b/i,
            sql: (text) => {
                const orderBy = extractOrderBy(text, columnNames);
                const conditions = extractWhereConditions(text, columnNames, columnTypes);
                const whereClause = conditions ? `WHERE ${conditions}` : '';
                return `SELECT * FROM ${table} ${whereClause} ${orderBy}`;
            },
            description: "Select with ordering"
        },
        {
            pattern: /\b(avg|average|mean)\b.*\b(\w+)\b/i,
            sql: (text) => {
                const column = extractColumnForAggregate(text, columnNames, ['avg', 'average', 'mean']);
                return `SELECT AVG(${column}) as average_${column} FROM ${table}`;
            },
            description: "Calculate average"
        },
        {
            pattern: /\b(sum|total)\b.*\b(\w+)\b/i,
            sql: (text) => {
                const column = extractColumnForAggregate(text, columnNames, ['sum', 'total']);
                return `SELECT SUM(${column}) as total_${column} FROM ${table}`;
            },
            description: "Calculate sum"
        },
        {
            pattern: /\b(max|maximum|highest|largest)\b.*\b(\w+)\b/i,
            sql: (text) => {
                const column = extractColumnForAggregate(text, columnNames, ['max', 'maximum', 'highest', 'largest']);
                return `SELECT MAX(${column}) as max_${column} FROM ${table}`;
            },
            description: "Find maximum value"
        },
        {
            pattern: /\b(min|minimum|lowest|smallest)\b.*\b(\w+)\b/i,
            sql: (text) => {
                const column = extractColumnForAggregate(text, columnNames, ['min', 'minimum', 'lowest', 'smallest']);
                return `SELECT MIN(${column}) as min_${column} FROM ${table}`;
            },
            description: "Find minimum value"
        },
        {
            pattern: /\blimit\s+(\d+)\b|\bfirst\s+(\d+)\b|\btop\s+(\d+)\b/i,
            sql: (text) => {
                const limit = extractLimit(text);
                const conditions = extractWhereConditions(text, columnNames, columnTypes);
                const whereClause = conditions ? `WHERE ${conditions}` : '';
                return `SELECT * FROM ${table} ${whereClause} LIMIT ${limit}`;
            },
            description: "Select with limit"
        }
    ];

    // Try to match patterns in order
    for (const pattern of patterns) {
        if (pattern.pattern.test(lowerText)) {
            let sql;
            if (typeof pattern.sql === 'function') {
                try {
                    sql = pattern.sql(text);
                } catch (error) {
                    continue; // Try next pattern if this one fails
                }
            } else {
                sql = pattern.sql;
            }
            
            // Add LIMIT for safety if not already present
            if (!sql.toLowerCase().includes('limit') && !sql.toLowerCase().includes('count(') && !sql.toLowerCase().includes('avg(') && !sql.toLowerCase().includes('sum(') && !sql.toLowerCase().includes('max(') && !sql.toLowerCase().includes('min(')) {
                sql += ' LIMIT 100';
            }
            
            return { sqlQuery: sql };
        }
    }

    // Default fallback - try to extract conditions
    try {
        const conditions = extractWhereConditions(text, columnNames, columnTypes);
        const sql = conditions ? 
            `SELECT * FROM ${table} WHERE ${conditions} LIMIT 100` : 
            `SELECT * FROM ${table} LIMIT 100`;
        return { sqlQuery: sql };
    } catch (error) {
        return { 
            sqlQuery: `SELECT * FROM ${table} LIMIT 100`,
            error: "Could not understand query, showing sample data"
        };
    }
}

// Enhanced condition extraction
function extractWhereConditions(text, columnNames, columnTypes) {
    const conditions = [];
    const words = text.toLowerCase().split(/\s+/);
    
    // Common condition patterns
    const conditionPatterns = [
        // Greater than
        { 
            regex: /(\w+)\s+(?:greater than|more than|above|over)\s+([\d.]+)/i, 
            handler: (match) => {
                const column = findBestColumnMatch(match[1], columnNames);
                return column ? `${column} > ${match[2]}` : null;
            }
        },
        // Less than
        { 
            regex: /(\w+)\s+(?:less than|fewer than|below|under)\s+([\d.]+)/i, 
            handler: (match) => {
                const column = findBestColumnMatch(match[1], columnNames);
                return column ? `${column} < ${match[2]}` : null;
            }
        },
        // Equal to
        { 
            regex: /(\w+)\s+(?:equal to|exactly|is)\s+([\w.]+)/i, 
            handler: (match) => {
                const column = findBestColumnMatch(match[1], columnNames);
                const value = isNaN(match[2]) ? `'${match[2]}'` : match[2];
                return column ? `${column} = ${value}` : null;
            }
        },
        // Contains/Like
        { 
            regex: /(\w+)\s+(?:containing|contain|like|with)\s+['"]?([^'"\s]+)['"]?/i, 
            handler: (match) => {
                const column = findBestColumnMatch(match[1], columnNames);
                return column ? `${column} LIKE '%${match[2]}%'` : null;
            }
        },
        // Simple comparisons
        { 
            regex: /(\w+)\s+([><=]=?)\s+([\w.]+)/i, 
            handler: (match) => {
                const column = findBestColumnMatch(match[1], columnNames);
                let value = match[3];
                if (isNaN(value) && !['>', '<', '>=', '<='].includes(match[2])) {
                    value = `'${value}'`;
                }
                return column ? `${column} ${match[2]} ${value}` : null;
            }
        },
        // Named/Called
        { 
            regex: /(?:named|called|name is|is)\s+['"]?([^'"\s]+)['"]?/i, 
            handler: (match) => {
                const column = findBestColumnMatch('name', columnNames) || findBestColumnMatch('title', columnNames);
                return column ? `${column} = '${match[1]}'` : null;
            }
        }
    ];

    // Try each pattern
    for (const pattern of conditionPatterns) {
        const match = text.match(pattern.regex);
        if (match) {
            const condition = pattern.handler(match);
            if (condition) {
                conditions.push(condition);
            }
        }
    }

    return conditions.length > 0 ? conditions.join(' AND ') : null;
}

// Helper function to find best column match
function findBestColumnMatch(word, columnNames) {
    const lowerWord = word.toLowerCase();
    
    // Exact match
    const exactMatch = columnNames.find(col => col.toLowerCase() === lowerWord);
    if (exactMatch) return exactMatch;
    
    // Contains match
    const containsMatch = columnNames.find(col => col.toLowerCase().includes(lowerWord));
    if (containsMatch) return containsMatch;
    
    // Partial match
    const partialMatch = columnNames.find(col => lowerWord.includes(col.toLowerCase()));
    if (partialMatch) return partialMatch;
    
    return null;
}

// Extract columns for SELECT clause
function extractColumns(text, columnNames) {
    if (!text) return '*';
    
    const requestedColumns = text.split(/\s*,\s*/).map(col => col.trim());
    const validColumns = [];
    
    for (const col of requestedColumns) {
        const matchedColumn = findBestColumnMatch(col, columnNames);
        if (matchedColumn) {
            validColumns.push(matchedColumn);
        }
    }
    
    return validColumns.length > 0 ? validColumns.join(', ') : '*';
}

// Extract ORDER BY clause
function extractOrderBy(text, columnNames) {
    const orderMatch = text.match(/(?:order by|sort by)\s+(\w+)(?:\s+(asc|desc))?/i);
    if (orderMatch) {
        const column = findBestColumnMatch(orderMatch[1], columnNames);
        const direction = (orderMatch[2] || 'asc').toUpperCase();
        return column ? `ORDER BY ${column} ${direction}` : '';
    }
    return '';
}

// Extract column for aggregate functions
function extractColumnForAggregate(text, columnNames, keywords) {
    // Look for column name after aggregate keyword
    for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b.*?\\b(\\w+)\\b`, 'i');
        const match = text.match(regex);
        if (match) {
            const column = findBestColumnMatch(match[1], columnNames);
            if (column) return column;
        }
    }
    
    // Fallback: look for any numeric column
    const numericColumns = columnNames.filter(col => 
        col.toLowerCase().includes('id') || 
        col.toLowerCase().includes('age') || 
        col.toLowerCase().includes('salary') ||
        col.toLowerCase().includes('price') ||
        col.toLowerCase().includes('amount')
    );
    
    return numericColumns[0] || columnNames[0];
}

// Extract LIMIT
function extractLimit(text) {
    const limitMatch = text.match(/(?:limit|first|top)\s+(\d+)/i);
    return limitMatch ? limitMatch[1] : '100';
}

// Execute raw SQL query
app.post('/query', (req, res) => {
    const { database, sql } = req.body;
    
    if (!database || !sql) {
        return res.status(400).json({ error: 'Database and SQL query are required' });
    }
    
    const db = getDBConnection(database);
    
    // Check if it's a SELECT query or other type
    const isSelectQuery = sql.trim().toLowerCase().startsWith('select');
    
    if (isSelectQuery) {
        db.all(sql, [], (err, rows) => {
            if (err) {
                return res.status(500).json({ error: `SQL Error: ${err.message}` });
            }
            
            res.json({
                message: 'Query executed successfully',
                results: rows,
                row_count: rows.length
            });
        });
    } else {
        // For INSERT, UPDATE, DELETE queries
        db.run(sql, [], function(err) {
            if (err) {
                return res.status(500).json({ error: `SQL Error: ${err.message}` });
            }
            
            res.json({
                message: 'Query executed successfully',
                changes: this.changes
            });
        });
    }
});

// Get table data
app.get('/data/:database/:table', (req, res) => {
    const { database, table } = req.params;
    
    const db = getDBConnection(database);
    const query = `SELECT *, rowid FROM ${table} LIMIT 100`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.json({ data: rows });
    });
});

// Insert data into table
app.post('/data/:database/:table', (req, res) => {
    const { database, table } = req.params;
    const { data } = req.body;
    
    if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Data object is required' });
    }
    
    const db = getDBConnection(database);
    
    // Get table schema to validate columns
    db.all(`PRAGMA table_info(${table})`, [], (err, columns) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        const columnNames = columns.map(col => col.name);
        const providedColumns = Object.keys(data);
        
        // Validate that all provided columns exist in the table
        const invalidColumns = providedColumns.filter(col => !columnNames.includes(col));
        if (invalidColumns.length > 0) {
            return res.status(400).json({ 
                error: `Invalid columns: ${invalidColumns.join(', ')}` 
            });
        }
        
        // Build INSERT query
        const columnsStr = providedColumns.join(', ');
        const placeholders = providedColumns.map(() => '?').join(', ');
        const values = providedColumns.map(col => data[col]);
        
        const insertSQL = `INSERT INTO ${table} (${columnsStr}) VALUES (${placeholders})`;
        
        db.run(insertSQL, values, function(err) {
            if (err) {
                return res.status(500).json({ error: `Insert failed: ${err.message}` });
            }
            
            res.json({ 
                message: 'Data inserted successfully',
                id: this.lastID,
                changes: this.changes
            });
        });
    });
});

// Update data in table
app.put('/data/:database/:table/:id', (req, res) => {
    const { database, table, id } = req.params;
    const { data } = req.body;
    
    if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Data object is required' });
    }
    
    const db = getDBConnection(database);
    
    // Build UPDATE query
    const setClause = Object.keys(data).map(col => `${col} = ?`).join(', ');
    const values = [...Object.values(data), id];
    
    const updateSQL = `UPDATE ${table} SET ${setClause} WHERE rowid = ?`;
    
    db.run(updateSQL, values, function(err) {
        if (err) {
            return res.status(500).json({ error: `Update failed: ${err.message}` });
        }
        
        res.json({ 
            message: 'Data updated successfully',
            changes: this.changes
        });
    });
});

// Delete data from table
app.delete('/data/:database/:table/:id', (req, res) => {
    const { database, table, id } = req.params;
    
    const db = getDBConnection(database);
    const deleteSQL = `DELETE FROM ${table} WHERE rowid = ?`;
    
    db.run(deleteSQL, [id], function(err) {
        if (err) {
            return res.status(500).json({ error: `Delete failed: ${err.message}` });
        }
        
        res.json({ 
            message: 'Data deleted successfully',
            changes: this.changes
        });
    });
});

// Get table schema
app.get('/schema/:database/:table', (req, res) => {
    const { database, table } = req.params;
    
    const db = getDBConnection(database);
    
    db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.json({ schema: rows });
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('  GET  /health');
    console.log('  GET  /databases');
    console.log('  POST /databases');
    console.log('  GET  /tables/:database');
    console.log('  POST /tables');
    console.log('  POST /convert');
    console.log('  POST /query');
    console.log('  GET  /data/:database/:table');
    console.log('  POST /data/:database/:table');
    console.log('  PUT  /data/:database/:table/:id');
    console.log('  DELETE /data/:database/:table/:id');
    console.log('  GET  /schema/:database/:table');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    
    // Close all database connections
    dbConnections.forEach((db, name) => {
        db.close((err) => {
            if (err) {
                console.error(`Error closing database ${name}:`, err);
            }
        });
    });
    
    metadataDB.close((err) => {
        if (err) {
            console.error('Error closing metadata database:', err);
        }
        process.exit(0);
    });
});