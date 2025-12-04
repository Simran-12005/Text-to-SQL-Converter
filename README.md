

# 🧠 Text-to-SQL Converter (React + Node.js + SQLite)

A complete full-stack application that converts **natural language questions** into **SQL queries**, executes them, and provides a powerful GUI to manage databases, tables, and data.

This project includes:

* 🔍 Natural Language → SQL conversion
* 🗄 SQLite database creation
* 📋 Table designer
* 🧪 Data insertion & deletion
* 🧑‍💻 SQL editor
* 🧠 Smart SQL generation engine (custom NLP rules)
* 🎨 React frontend
* 🚀 Node.js backend

---

# 📂 Project Structure

```
Text-to-SQL-Converter/
│
├── backend/
│   ├── server.js          # FULL backend logic (your code)
│   ├── metadata.db        # Metadata storage
│   ├── databases/         # Auto-created databases (*.db)
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── App.js        # FULL UI logic (your code)
    │   ├── App.css
    │   └── index.js
    ├── package.json
    └── public/
```

---

# 🚀 Running the Project

## 1️⃣ Start Backend (Node.js)

```sh
cd backend
npm install
node server.js
```

Backend will run on:

```
http://localhost:8000
```

---

## 2️⃣ Start Frontend (React)

```sh
cd frontend
npm install
npm start
```

Frontend will run on:

```
http://localhost:3000
```

Make sure backend is running first.

---

# 🛠 Backend (Node.js + SQLite + Text-to-SQL Engine)

Your backend (`server.js`) includes:

### ✔ Automatic SQLite DB creation

Stored under:

```
backend/databases/*.db
```

### ✔ Metadata Database (`metadata.db`)

Stores:

* databases
* tables
* columns
  Used by frontend to show structure.

### ✔ Dynamic DB connections

Each DB is accessed via:

```js
getDBConnection(database)
```

---

# 📡 Backend API Endpoints (Matched EXACTLY to your code)

## 🔹 Health Check

`GET /health`

---

## 🔹 Databases

### Get all databases

`GET /databases`

### Create database

`POST /databases`

```json
{
  "name": "mydb",
  "description": "sample database"
}
```

---

## 🔹 Tables

### Get tables of a database

`GET /tables/:database`

### Create table

`POST /tables`

```json
{
  "database": "mydb",
  "table_name": "users",
  "description": "",
  "columns": [
    { "column_name": "id", "data_type": "INTEGER", "is_primary_key": true, "is_nullable": false },
    { "column_name": "name", "data_type": "TEXT", "is_primary_key": false, "is_nullable": true }
  ]
}
```

---

## 🔹 Data

### Fetch data

`GET /data/:database/:table`

### Insert data

`POST /data/:database/:table`

```json
{ "data": { "name": "Simran", "age": 22 } }
```

### Update

`PUT /data/:database/:table/:id`

### Delete

`DELETE /data/:database/:table/:id`

---

## 🔹 Schema

### Get table schema

`GET /schema/:database/:table`

---

## 🔹 Natural Language → SQL

### Convert & Execute

`POST /convert`

```json
{
  "text": "show all users where age greater than 20",
  "database": "mydb",
  "table": "users"
}
```

Response:

```json
{
  "sql_query": "SELECT * FROM users WHERE age > 20 LIMIT 100",
  "results": [...]
}
```

---

## 🔹 Raw SQL

### Run SQL manually

`POST /query`

```json
{
  "database": "mydb",
  "sql": "SELECT * FROM users"
}
```

---

# 🧠 Text-to-SQL Engine (Exactly Your Code)

Your backend intelligently parses English sentences:

Supports:

* count
* filter
* where conditions
* greater than / less than
* equal to
* contains
* ordering
* aggregates (SUM, AVG, MIN, MAX)
* LIMIT extraction

Functions used:

* `generateSQLFromText()`
* `extractWhereConditions()`
* `extractColumns()`
* `extractOrderBy()`
* `extractLimit()`
* `findBestColumnMatch()`

This is a powerful custom SQL generator.

---

# 🎨 Frontend (React)

Your frontend UI (`src/App.js`) contains 4 complete modules.

## 1️⃣ Query Converter (Natural Language → SQL)

* User enters natural language
* Calls `/convert`
* Shows:

  * generated SQL
  * results table

---

## 2️⃣ Database Manager

* Shows all databases
* Create DB modal
* Shows DB details:

  * description
  * table count
  * created date

Uses:

```
GET  /databases
POST /databases
GET  /tables/:database
```

---

## 3️⃣ Data Manager

* Shows table data
* Insert modal (generated from schema)
* Delete rows (via rowid)
* Dynamic inputs based on PRAGMA schema

Uses:

```
GET /schema/:database/:table
GET /data/:database/:table
POST /data/:database/:table
DELETE /data/:database/:table/:id
```

---

## 4️⃣ SQL Editor

* Write custom SQL
* Execute
* Show results

Uses:

```
POST /query
```

---

# 🎛 UI Features (Based on Your App.js)

* Dropdown for databases + tables
* Modals for:

  * Create Database
  * Create Table
  * Insert Data
* Auto-refresh on changes
* Scrollable result tables
* Loading indicators
* Clear buttons
* Responsive layouts

All React state:

```js
useState for:
- databases
- tables
- selectedDatabase
- selectedTable
- query / sqlQuery
- results
- tableData
- tableSchema
- modals
```

---

# 📘 Example Natural Query

Input:

```
Show me products cheaper than 500
```

Backend generates:

```sql
SELECT * FROM products WHERE price < 500 LIMIT 100
```

Frontend displays:

* SQL preview
* Results in table

---

# ❤️ Author

**Simran Gupta**
Creator of full Text-to-SQL suite (Frontend + Backend)

