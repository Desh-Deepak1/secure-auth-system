const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const tokenBlacklist = new Set();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again later.' }
});

app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const userExists = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = 'usr_' + Math.random().toString(36).substring(2, 9);
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    await db.query(
      'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)',
      [id, email, passwordHash]
    );

    res.status(201).json({ id, email });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    tokenBlacklist.add(token);
  }
  res.status(200).json({ message: 'Logged out successfully' });
});

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const token = authHeader.split(' ')[1];
  
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
};

app.get('/me', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, full_name, display_name, bio, created_at, role FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = result.rows[0];
    res.status(200).json({
      id: user.id,
      email: user.email,
      profile: {
        fullName: user.full_name,
        displayName: user.display_name,
        bio: user.bio,
        createdAt: user.created_at,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/files', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM files WHERE owner_id = $1', [req.user.id]);
    const mappedFiles = result.rows.map(file => ({
      id: file.id,
      ownerId: file.owner_id,
      fileName: file.file_name,
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes,
      uploadedAt: file.uploaded_at
    }));
    res.status(200).json({ files: mappedFiles });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/files/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM files WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const file = result.rows[0];
    
    if (file.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have access to this file' });
    }
    
    res.status(200).json({
      file: {
        id: file.id,
        ownerId: file.owner_id,
        fileName: file.file_name,
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes,
        uploadedAt: file.uploaded_at
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/files/:id/download', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM files WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).send('File not found');
    }
    
    const file = result.rows[0];
    
    if (file.owner_id !== req.user.id) {
      return res.status(403).send('Forbidden');
    }
    
    const simulatedContent = `This is a simulated download for "${file.file_name}" (${file.mime_type}, ${file.size_bytes} bytes).`;
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
    res.status(200).send(simulatedContent);
  } catch (error) {
    res.status(500).send('Internal server error');
  }
});

module.exports = { app, tokenBlacklist };

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}