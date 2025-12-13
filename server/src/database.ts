import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// SQLite database file (stored in server directory)
const dbPath = path.join(__dirname, '..', 'data', 'blindrally.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize database tables
export function initDatabase() {
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'player',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create index on username for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)
  `);
  
  console.log('✅ SQLite database initialized at:', dbPath);
}

// User interface
export interface DbUser {
  id: string;
  username: string;
  password: string;
  role: 'player' | 'monitor';
  created_at: string;
}

// Get user by username
export function getUserByUsername(username: string): DbUser | null {
  const stmt = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)');
  return stmt.get(username) as DbUser | null;
}

// Get user by ID
export function getUserById(id: string): DbUser | null {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as DbUser | null;
}

// Create user
export function createUser(user: { id: string; username: string; password: string; role: string }): DbUser {
  const stmt = db.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)');
  stmt.run(user.id, user.username, user.password, user.role);
  return getUserById(user.id)!;
}

// Check if username exists
export function usernameExists(username: string): boolean {
  const stmt = db.prepare('SELECT 1 FROM users WHERE LOWER(username) = LOWER(?)');
  return stmt.get(username) !== undefined;
}
