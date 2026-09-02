# Money Collection — Node.js + MySQL Backend

Backend API for the **Money Calculator** Android app.

> **Important:** This server does **NOT** calculate interest or EMI.  
> The Android app performs all calculations locally. The backend only **stores and syncs** pre-calculated data (records, payments, history, settings).

---

## Tech Stack

| Layer      | Technology        |
|-----------|-------------------|
| Runtime   | Node.js 18+       |
| Framework | Express.js        |
| Database  | MySQL 8+          |
| Auth      | JWT + bcrypt      |

---

## Quick Start (Windows)

### 1. Install MySQL

Install MySQL Server 8+ and note your `root` password.

Create database (optional — migration script does this too):

```sql
CREATE DATABASE money_collection CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Configure environment

```bash
cd backend
copy .env.example .env
```

Edit `.env`:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=money_collection
JWT_SECRET=your_long_random_secret
PORT=3000
```

### 3. Install & migrate

```bash
npm install
npm run db:migrate
```

### 4. Start server

```bash
npm run dev
```

Open: http://localhost:3000/health

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login → JWT token |
| GET | `/api/auth/profile` | Current user (Bearer token) |

### Money Records (pre-calculated from app)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/records` | List all records |
| GET | `/api/records/:id` | Get one record |
| POST | `/api/records` | Create record |
| PUT | `/api/records/:id` | Update record |
| DELETE | `/api/records/:id` | Delete record |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/records/:recordId/payments` | List payments |
| POST | `/api/records/:recordId/payments` | Add payment (updates paid/remaining) |
| DELETE | `/api/records/:recordId/payments/:paymentId` | Delete payment |

### Dashboard & Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/summary` | Total given, received, outstanding |
| GET/PUT | `/api/settings` | App settings sync |
| GET/POST/DELETE | `/api/history` | Calculation history |

### Backup Sync (Android compatible)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sync/backup` | Export all user data |
| POST | `/api/sync/backup` | Import backup JSON |

---

## Example: Register & Save Record

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Sahil\",\"email\":\"sahil@test.com\",\"password\":\"123456\"}"

# Login
curl -X POST http://localhost:3000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"sahil@test.com\",\"password\":\"123456\"}"

# Create record (values already calculated by Android app)
curl -X POST http://localhost:3000/api/records ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_TOKEN" ^
  -d "{\"name\":\"Rajesh\",\"direction\":\"GIVEN\",\"principal\":10000,\"interestType\":\"SIMPLE\",\"rate\":10,\"ratePeriod\":\"YEARLY\",\"totalInterest\":2000,\"totalAmount\":12000,\"paidAmount\":0,\"remainingAmount\":12000,\"startDate\":\"2026-01-01\"}"

# Add payment
curl -X POST http://localhost:3000/api/records/1/payments ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_TOKEN" ^
  -d "{\"amount\":500,\"date\":\"2026-02-01\",\"method\":\"UPI\"}"
```

---

## Database Tables

- `users` — accounts
- `money_records` — loan records (principal, interest, totals from app)
- `payments` — installment payments
- `calculation_history` — calculator history
- `app_settings` — per-user settings

---

## Android App Integration (Future)

The Android app is **unchanged**. When you want cloud sync later:

1. App calculates locally (same as now)
2. App sends calculated `totalAmount`, `totalInterest`, `scheduleJson` to API
3. App pulls backup via `/api/sync/backup`

No calculation logic needs to move to the server.

---

## Project Structure

```
backend/
├── src/
│   ├── index.js              # Server entry
│   ├── config/database.js    # MySQL pool
│   ├── db/schema.sql         # MySQL schema
│   ├── controllers/          # Route handlers
│   ├── routes/               # Express routes
│   ├── middleware/           # Auth, errors
│   └── utils/helpers.js      # Mappers
├── package.json
├── .env.example
└── README.md
```

---

## License

Private — for Money Calculator app backend sync.
