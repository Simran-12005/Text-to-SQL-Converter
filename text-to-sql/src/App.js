// app.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const App = () => {
    const [activeTab, setActiveTab] = useState('query');
    const [databases, setDatabases] = useState([]);
    const [tables, setTables] = useState([]);
    const [selectedDatabase, setSelectedDatabase] = useState('');
    const [selectedTable, setSelectedTable] = useState('');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [sqlQuery, setSqlQuery] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Database creation states
    const [showCreateDb, setShowCreateDb] = useState(false);
    const [newDatabase, setNewDatabase] = useState({ name: '', description: '' });
    
    // Table creation states
    const [showCreateTable, setShowCreateTable] = useState(false);
    const [newTable, setNewTable] = useState({
        name: '',
        description: '',
        columns: [{ name: 'id', type: 'INTEGER', primaryKey: true, nullable: false }]
    });

    // Fetch databases on component mount
    useEffect(() => {
        fetchDatabases();
    }, []);

    // Fetch tables when database changes
    useEffect(() => {
        if (selectedDatabase) {
            fetchTables(selectedDatabase);
        } else {
            setTables([]);
            setSelectedTable('');
        }
    }, [selectedDatabase]);

    const fetchDatabases = async () => {
        try {
            const response = await axios.get('http://localhost:8000/databases');
            setDatabases(response.data.databases);
        } catch (error) {
            console.error('Error fetching databases:', error);
        }
    };

    const fetchTables = async (dbName) => {
        try {
            const response = await axios.get(`http://localhost:8000/tables/${dbName}`);
            setTables(response.data.tables);
        } catch (error) {
            console.error('Error fetching tables:', error);
        }
    };

    const executeQuery = async () => {
        if (!selectedDatabase || !selectedTable || !query.trim()) {
            alert('Please select a database, table, and enter a query');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post('http://localhost:8000/convert', {
                text: query,
                database: selectedDatabase,
                table: selectedTable
            });

            setResults(response.data.results);
            setSqlQuery(response.data.sql_query);
        } catch (error) {
            console.error('Error executing query:', error);
            alert('Error executing query: ' + error.response?.data?.detail || error.message);
        } finally {
            setLoading(false);
        }
    };

    const executeRawSQL = async () => {
        if (!selectedDatabase || !sqlQuery.trim()) {
            alert('Please select a database and enter a SQL query');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post('http://localhost:8000/query', {
                database: selectedDatabase,
                sql: sqlQuery
            });

            if (response.data.results) {
                setResults(response.data.results);
            }
            alert(response.data.message || 'Query executed successfully');
        } catch (error) {
            console.error('Error executing SQL:', error);
            alert('Error executing SQL: ' + error.response?.data?.detail || error.message);
        } finally {
            setLoading(false);
        }
    };

    // Database management functions
    const createDatabase = async () => {
        if (!newDatabase.name.trim()) {
            alert('Please enter a database name');
            return;
        }

        try {
            await axios.post('http://localhost:8000/databases', newDatabase);
            setShowCreateDb(false);
            setNewDatabase({ name: '', description: '' });
            fetchDatabases();
            alert('Database created successfully!');
        } catch (error) {
            console.error('Error creating database:', error);
            alert('Error creating database: ' + error.response?.data?.detail || error.message);
        }
    };

    const addColumn = () => {
        setNewTable({
            ...newTable,
            columns: [...newTable.columns, { name: '', type: 'TEXT', primaryKey: false, nullable: true }]
        });
    };

    const removeColumn = (index) => {
        if (newTable.columns.length === 1) return;
        const newColumns = newTable.columns.filter((_, i) => i !== index);
        setNewTable({ ...newTable, columns: newColumns });
    };

    const updateColumn = (index, field, value) => {
        const newColumns = [...newTable.columns];
        newColumns[index][field] = value;
        
        // Ensure only one primary key
        if (field === 'primaryKey' && value) {
            newColumns.forEach((col, i) => {
                if (i !== index) col.primaryKey = false;
            });
        }
        
        setNewTable({ ...newTable, columns: newColumns });
    };

    const createTable = async () => {
        if (!selectedDatabase) {
            alert('Please select a database first');
            return;
        }

        if (!newTable.name.trim()) {
            alert('Please enter a table name');
            return;
        }

        if (newTable.columns.some(col => !col.name.trim())) {
            alert('Please fill in all column names');
            return;
        }

        try {
            const tableData = {
                database: selectedDatabase,
                table_name: newTable.name,
                description: newTable.description,
                columns: newTable.columns.map(col => ({
                    column_name: col.name,
                    data_type: col.type,
                    is_primary_key: col.primaryKey,
                    is_nullable: col.nullable,
                    description: ''
                }))
            };

            await axios.post('http://localhost:8000/tables', tableData);
            setShowCreateTable(false);
            setNewTable({
                name: '',
                description: '',
                columns: [{ name: 'id', type: 'INTEGER', primaryKey: true, nullable: false }]
            });
            fetchTables(selectedDatabase);
            alert('Table created successfully!');
        } catch (error) {
            console.error('Error creating table:', error);
            alert('Error creating table: ' + error.response?.data?.detail || error.message);
        }
    };

    const clearResults = () => {
        setResults([]);
        setSqlQuery('');
        setQuery('');
    };

    return (
        <div className="app">
            <header className="app-header">
                <h1>Text to SQL Converter</h1>
                <nav className="tabs">
                    <button 
                        className={activeTab === 'query' ? 'active' : ''}
                        onClick={() => setActiveTab('query')}
                    >
                        Query Converter
                    </button>
                    <button 
                        className={activeTab === 'manage' ? 'active' : ''}
                        onClick={() => setActiveTab('manage')}
                    >
                        Database Manager
                    </button>
                    <button 
                        className={activeTab === 'sql' ? 'active' : ''}
                        onClick={() => setActiveTab('sql')}
                    >
                        SQL Editor
                    </button>
                </nav>
            </header>

            <main className="app-main">
                {/* Database Selection */}
                <div className="database-selection">
                    <div className="selection-group">
                        <label>Select Database:</label>
                        <select 
                            value={selectedDatabase} 
                            onChange={(e) => setSelectedDatabase(e.target.value)}
                        >
                            <option value="">Choose a database</option>
                            {databases.map(db => (
                                <option key={db.name} value={db.name}>
                                    {db.name} ({db.table_count} tables)
                                </option>
                            ))}
                        </select>
                        <button onClick={() => setShowCreateDb(true)}>Create New Database</button>
                    </div>

                    {selectedDatabase && (
                        <div className="selection-group">
                            <label>Select Table:</label>
                            <select 
                                value={selectedTable} 
                                onChange={(e) => setSelectedTable(e.target.value)}
                            >
                                <option value="">Choose a table</option>
                                {tables.map(table => (
                                    <option key={table.table_name} value={table.table_name}>
                                        {table.table_name} ({table.column_count} columns)
                                    </option>
                                ))}
                            </select>
                            <button onClick={() => setShowCreateTable(true)}>Create New Table</button>
                        </div>
                    )}
                </div>

                {/* Query Converter Tab */}
                {activeTab === 'query' && (
                    <div className="tab-content">
                        <div className="query-section">
                            <h2>Natural Language to SQL</h2>
                            <div className="input-group">
                                <label>Enter your question:</label>
                                <textarea
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="e.g., Show me all users with age greater than 25"
                                    rows="3"
                                />
                            </div>
                            <div className="button-group">
                                <button onClick={executeQuery} disabled={loading}>
                                    {loading ? 'Converting...' : 'Convert & Execute'}
                                </button>
                                <button onClick={clearResults}>Clear</button>
                            </div>
                        </div>

                        {sqlQuery && (
                            <div className="sql-preview">
                                <h3>Generated SQL:</h3>
                                <pre>{sqlQuery}</pre>
                            </div>
                        )}

                        {results.length > 0 && (
                            <div className="results-section">
                                <h3>Results ({results.length} rows)</h3>
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                {Object.keys(results[0]).map(key => (
                                                    <th key={key}>{key}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.map((row, index) => (
                                                <tr key={index}>
                                                    {Object.values(row).map((value, i) => (
                                                        <td key={i}>{value}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Database Manager Tab */}
                {activeTab === 'manage' && (
                    <div className="tab-content">
                        <div className="database-manager">
                            <h2>Database Management</h2>
                            
                            <div className="databases-section">
                                <h3>Your Databases</h3>
                                <div className="database-grid">
                                    {databases.map(db => (
                                        <div 
                                            key={db.name} 
                                            className={`database-card ${selectedDatabase === db.name ? 'selected' : ''}`}
                                            onClick={() => setSelectedDatabase(db.name)}
                                        >
                                            <h4>{db.name}</h4>
                                            <p className="description">{db.description || 'No description'}</p>
                                            <div className="database-meta">
                                                <span>📊 {db.table_count} tables</span>
                                                <span>🕒 {new Date(db.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {selectedDatabase && (
                                <div className="tables-section">
                                    <h3>Tables in {selectedDatabase}</h3>
                                    <div className="table-grid">
                                        {tables.map(table => (
                                            <div key={table.table_name} className="table-card">
                                                <h4>{table.table_name}</h4>
                                                <p className="description">{table.description || 'No description'}</p>
                                                <div className="table-meta">
                                                    <span>📋 {table.column_count} columns</span>
                                                    <span>🕒 {new Date(table.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* SQL Editor Tab */}
                {activeTab === 'sql' && (
                    <div className="tab-content">
                        <div className="sql-editor">
                            <h2>SQL Editor</h2>
                            <div className="input-group">
                                <label>Enter SQL Query:</label>
                                <textarea
                                    value={sqlQuery}
                                    onChange={(e) => setSqlQuery(e.target.value)}
                                    placeholder="e.g., SELECT * FROM users WHERE age > 25"
                                    rows="5"
                                />
                            </div>
                            <div className="button-group">
                                <button onClick={executeRawSQL} disabled={loading}>
                                    {loading ? 'Executing...' : 'Execute SQL'}
                                </button>
                                <button onClick={clearResults}>Clear</button>
                            </div>

                            {results.length > 0 && (
                                <div className="results-section">
                                    <h3>Results ({results.length} rows)</h3>
                                    <div className="table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    {Object.keys(results[0]).map(key => (
                                                        <th key={key}>{key}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {results.map((row, index) => (
                                                    <tr key={index}>
                                                        {Object.values(row).map((value, i) => (
                                                            <td key={i}>{value}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Create Database Modal */}
            {showCreateDb && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Create New Database</h3>
                        <div className="input-group">
                            <label>Database Name:</label>
                            <input
                                type="text"
                                value={newDatabase.name}
                                onChange={(e) => setNewDatabase({...newDatabase, name: e.target.value})}
                                placeholder="e.g., my_database"
                            />
                        </div>
                        <div className="input-group">
                            <label>Description (optional):</label>
                            <textarea
                                value={newDatabase.description}
                                onChange={(e) => setNewDatabase({...newDatabase, description: e.target.value})}
                                placeholder="Describe your database..."
                                rows="3"
                            />
                        </div>
                        <div className="modal-actions">
                            <button onClick={createDatabase}>Create Database</button>
                            <button onClick={() => setShowCreateDb(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Table Modal */}
            {showCreateTable && (
                <div className="modal-overlay">
                    <div className="modal large">
                        <h3>Create New Table in {selectedDatabase}</h3>
                        
                        <div className="input-group">
                            <label>Table Name:</label>
                            <input
                                type="text"
                                value={newTable.name}
                                onChange={(e) => setNewTable({...newTable, name: e.target.value})}
                                placeholder="e.g., users"
                            />
                        </div>
                        
                        <div className="input-group">
                            <label>Description (optional):</label>
                            <textarea
                                value={newTable.description}
                                onChange={(e) => setNewTable({...newTable, description: e.target.value})}
                                placeholder="Describe your table..."
                                rows="2"
                            />
                        </div>
                        
                        <h4>Table Columns</h4>
                        <div className="columns-section">
                            {newTable.columns.map((column, index) => (
                                <div key={index} className="column-definition">
                                    <input
                                        type="text"
                                        placeholder="Column name"
                                        value={column.name}
                                        onChange={(e) => updateColumn(index, 'name', e.target.value)}
                                    />
                                    <select
                                        value={column.type}
                                        onChange={(e) => updateColumn(index, 'type', e.target.value)}
                                    >
                                        <option value="INTEGER">INTEGER</option>
                                        <option value="TEXT">TEXT</option>
                                        <option value="REAL">REAL</option>
                                        <option value="NUMERIC">NUMERIC</option>
                                        <option value="BLOB">BLOB</option>
                                        <option value="DATE">DATE</option>
                                    </select>
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={column.primaryKey}
                                            onChange={(e) => updateColumn(index, 'primaryKey', e.target.checked)}
                                        />
                                        Primary Key
                                    </label>
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={column.nullable}
                                            onChange={(e) => updateColumn(index, 'nullable', e.target.checked)}
                                        />
                                        Nullable
                                    </label>
                                    <button 
                                        onClick={() => removeColumn(index)}
                                        disabled={newTable.columns.length === 1}
                                        className="remove-btn"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                            
                            <button onClick={addColumn} className="add-column-btn">
                                + Add Column
                            </button>
                        </div>
                        
                        <div className="modal-actions">
                            <button onClick={createTable}>Create Table</button>
                            <button onClick={() => setShowCreateTable(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;