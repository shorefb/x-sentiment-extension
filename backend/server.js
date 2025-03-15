const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
require('dotenv').config();

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'sentiment_analyzer',
  password: process.env.PG_PASSWORD || 'yourpassword',
  port: process.env.PG_PORT || 5432,
});

pool.connect((err) => {
  if (err) {
    console.error('Error connecting to PostgreSQL:', err.stack);
    return;
  }
  console.log('Connected to PostgreSQL database');
});

// API to Capture User Data
app.post('/api/user', async (req, res) => {
  const { userId, preferences, sentimentHistory } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Ensure preferences and sentimentHistory are valid JSON strings
  const preferencesJson = JSON.stringify(preferences || {});
  const sentimentHistoryJson = JSON.stringify(sentimentHistory || []);

  try {
    const query = `
      INSERT INTO users (user_id, preferences, sentiment_history)
      VALUES ($1, $2::jsonb, $3::jsonb)
      ON CONFLICT (user_id)
      DO UPDATE SET preferences = $2::jsonb, sentiment_history = $3::jsonb
      RETURNING id
    `;
    const values = [userId, preferencesJson, sentimentHistoryJson];
    const result = await pool.query(query, values);
    res.status(200).json({ message: 'User data saved', id: result.rows[0].id });
  } catch (err) {
    console.error('Error saving user data:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// API to Retrieve User Data
app.get('/api/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const query = 'SELECT * FROM users WHERE user_id = $1';
    const result = await pool.query(query, [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    // No need to parse JSONB fields; they are already objects
    const user = result.rows[0];
    res.status(200).json({
      userId: user.user_id,
      preferences: user.preferences || {},
      sentimentHistory: user.sentiment_history || []
    });
  } catch (err) {
    console.error('Error retrieving user data:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Start the Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});