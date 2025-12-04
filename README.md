
# 🚀 Text-to-SQL Backend (Express.js + SQLite)

This is the **backend server** for the Text-to-SQL Converter application.
It provides APIs for:

*  Natural language → SQL conversion
*  Database creation (SQLite)
*  Table creation
*  Insert / Update / Delete data
*  Fetching data and schema
*  Running raw SQL
* Dedicated metadata database for tracking structure

It works seamlessly with the **React frontend**.

---

## 🛠 Tech Stack

| Component             | Technology                           |
| --------------------- | ------------------------------------ |
| Backend Framework     | **Express.js**                       |
| Database Engine       | **SQLite3**                          |
| Metadata Store        | **metadata.db**                      |
| File-based DB Storage | `/databases/` folder                 |
| Text → SQL Engine     | Custom keywords + pattern extraction |
| Language              | Node.js                              |

---

## 📦 Folder Structure (Backend)

```
backend/
│
├── server.js         # Main backend file (your code)
├── databases/        # Auto-created databases (each *.db)
├── metadata.db       # Stores DB, table, column metadata
└── README.md         # (this file)
```

---

## ▶️ Run the Backend Server

### Install dependencies

```sh
npm install express cors sqlite3
```

### Start the server

```sh
node server.js
```

The backend runs on:

```
http://localhost:8000
```

---

# 🗄 Database Architecture

### 1️⃣ **Physical Databases**

Stored inside:

```
/databases/*.db
```

Each DB is created from:

```js
new sqlite3.Database(`${name}.db`)
```

---

### 2️⃣ **Metadata Database (`metadata.db`)**

Tracks:

| Table         | Purpose                              |
| ------------- | ------------------------------------ |
| **databases** | Stores database names + descriptions |
| **tables**    | Stores table-level metadata          |
| **columns**   | Column structures for each table     |

This allows GUI display in React.

---

# 📡 API Documentation

---

## ⭐ 1. Health Check

### `GET /health`

**Response**

```json
{ "status": "OK", "timestamp": "2025-12-04T18:30:00Z" }
```

---

# 🛢 DATABASE ROUTES

## 2. Get All Databases

### `GET /databases`

Returns metadata + table count.

---

## 3. Create Database

### `POST /databases`

**Body**

```json
{
  "name": "mydb",
  "description": "Sample DB"
}
```

Creates:

* Physical DB: `/databases/mydb.db`
* Metadata entry

---

# 📋 TABLE ROUTES

## 4. Get Tables of a Database

### `GET /tables/:database`

Returns table list + column count.

---

## 5. Create Table

### `POST /tables`

**Body**

```json
{
  "database": "mydb",
  "table_name": "users",
  "description": "User table",
  "columns": [
    {
      "column_name": "id",
      "data_type": "INTEGER",
      "is_primary_key": true,
      "is_nullable": false
    },
    {
      "column_name": "name",
      "data_type": "TEXT",
      "is_primary_key": false,
      "is_nullable": true
    }
  ]
}
```

Creates table + metadata.

---

# 📦 DATA ROUTES

## 6. Fetch Table Data

### `GET /data/:database/:table`

Returns max 100 rows.

---

## 7. Insert Data

### `POST /data/:database/:table`

**Body**

```json
{
  "data": { "name": "Simran", "age": 22 }
}
```

---

## 8. Update Data

### `PUT /data/:database/:table/:id`

Updates record based on SQLite `rowid`.

---

## 9. Delete Data

### `DELETE /data/:database/:table/:id`

Deletes record.

---

# 📐 SCHEMA ROUTES

## 10. Get Table Schema

### `GET /schema/:database/:table`

Uses:

```sql
PRAGMA table_info(tablename)
```

---

# 🤖 TEXT → SQL ROUTE

## 11. Convert Natural Language to SQL

### `POST /convert`

**Body**

```json
{
  "text": "show me all users where age greater than 20",
  "database": "mydb",
  "table": "users"
}
```

### How SQL is generated

The backend:

1. Reads schema via PRAGMA
2. Extracts:

   * conditions
   * limits
   * aggregates
   * filters
   * order by
3. Maps English → SQL via **pattern matchers**

### Example Result

```json
{
  "sql_query": "SELECT * FROM users WHERE age > 20 LIMIT 100",
  "results": [ ... ]
}
```

---

# 📜 RAW SQL EXECUTION

## 12. Run SQL manually

### `POST /query`

**Body**

```json
{
  "database": "mydb",
  "sql": "SELECT * FROM users WHERE age > 20"
}
```

Supports:

* SELECT
* UPDATE
* DELETE
* INSERT

SELECT returns result rows.
Others return:

```json
{ "changes": 1 }
```

---

# 🧠 Text → SQL Engine (Overview)

Your backend includes custom logic:

### ➤ Condition extraction

Handles:

* greater than
* less than
* equal to
* LIKE queries
* contains
* numeric comparison

### ➤ Aggregates

Supports:

* AVG
* SUM
* MAX
* MIN

### ➤ Column matching

Smart matching:

* exact
* contains
* partial

### ➤ Safety

Adds `LIMIT 100` automatically unless using aggregates.

This is a powerful mini-NLP engine.

---

# 📤 Server Output at Startup

When running:

```
Server running on http://localhost:8000
Available endpoints:
  GET  /health
  GET  /databases
  POST /databases
  GET  /tables/:database
  POST /tables
  POST /convert
  POST /query
  GET  /data/:database/:table
  POST /data/:database/:table
  PUT  /data/:database/:table/:id
  DELETE /data/:database/:table/:id
  GET  /schema/:database/:table
```

---

# 🧹 Cleanup & Shutdown

Graceful shutdown closes all SQLite connections using:

```js
process.on('SIGINT', ...)
```

---

# ❤️ Author

**Simran Gupta**
Creator of full Text-to-SQL suite (Frontend + Backend)

