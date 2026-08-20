const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('./db');

async function seed() {
  const dataPath = path.join(__dirname, '..', 'public', 'seed-data.json');
  const rawData = fs.readFileSync(dataPath);
  const seedData = JSON.parse(rawData);

  await db.query(`
    DROP TABLE IF EXISTS files;
    DROP TABLE IF EXISTS users;

    CREATE TABLE users (
      id VARCHAR(50) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255),
      display_name VARCHAR(255),
      bio TEXT,
      created_at TIMESTAMP,
      role VARCHAR(50)
    );

    CREATE TABLE files (
      id VARCHAR(50) PRIMARY KEY,
      owner_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
      file_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100),
      size_bytes INT,
      uploaded_at TIMESTAMP
    );
  `);

  for (const user of seedData.users) {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(user.password, saltRounds);

    await db.query(
      `INSERT INTO users (id, email, password_hash, full_name, display_name, bio, created_at, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [user.id, user.email, passwordHash, user.profile.fullName, user.profile.displayName, user.profile.bio, user.profile.createdAt, user.profile.role]
    );

    for (const file of user.files) {
      await db.query(
        `INSERT INTO files (id, owner_id, file_name, mime_type, size_bytes, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [file.id, file.ownerId, file.fileName, file.mimeType, file.sizeBytes, file.uploadedAt]
      );
    }
  }

  console.log("Database seeded successfully!");
  process.exit();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});