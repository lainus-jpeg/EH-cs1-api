require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://wonderful-mushroom-0ea303e03-preview.westeurope.3.azurestaticapps.net',
      'https://wonderful-mushroom-0ea303e03.3.azurestaticapps.net',
      'https://fonteynbackend.wittypebble-be3e1c7a.spaincentral.azurecontainerapps.io'
    ],
    methods: ['GET', 'POST']
  },
  allowEIO3: true
});
const PORT = process.env.PORT || 3000;

// WebSocket connection
io.on('connection', (socket) => {
  console.log('📡 Client connected for live updates');
  
  socket.on('disconnect', () => {
    console.log('📡 Client disconnected');
  });
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://wonderful-mushroom-0ea303e03-preview.westeurope.3.azurestaticapps.net',
    'https://wonderful-mushroom-0ea303e03.3.azurestaticapps.net',
    'https://fonteynbackend.wittypebble-be3e1c7a.spaincentral.azurecontainerapps.io'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Database configuration
const pool = new Pool({
  host: process.env.DB_SERVER,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  ssl: {
    rejectUnauthorized: false
  }
});

// Connect to database
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    console.error('Database connection error:', err);
    console.error('DB_SERVER:', process.env.DB_SERVER);
    console.error('DB_NAME:', process.env.DB_NAME);
    console.error('DB_USER:', process.env.DB_USER);
  } else {
    console.log('✅ Connected to PostgreSQL Database');
    console.log('Database Host:', process.env.DB_SERVER);
    console.log('Database Name:', process.env.DB_NAME);
    // Create tables on startup
    createTables();
  }
});

// Create necessary tables
async function createTables() {
  try {
    // Create Users table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(20),
        password VARCHAR(255) NOT NULL
      )
    `);
    
    // Create NewsletterEmails table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS newsletter_emails (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('Tables created or already exist');
  } catch (err) {
    console.error('Error creating tables:', err);
  }
}

// Routes
app.post('/v1/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validation
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into database
    const query = `
      INSERT INTO users (name, email, phone, password)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;

    await pool.query(query, [name, email, phone, hashedPassword]);

    res.status(201).json({ success: true, message: 'User registered successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    
    // Check for duplicate email (PostgreSQL unique constraint violation)
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' });
    }

    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// Health check
app.get('/v1/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Login endpoint
app.post('/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const query = `SELECT id, name, password FROM users WHERE email = $1`;
    const result = await pool.query(query, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Login successful
    res.json({ 
      success: true, 
      message: 'Login successful',
      userId: user.id,
      name: user.name
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// Admin verification endpoint (for Entra ID)
app.post('/v1/auth/verify-admin', async (req, res) => {
  try {
    const { email } = req.body;
    const authHeader = req.headers.authorization;
    
    console.log('🔐 Admin verification request:', { email, hasToken: !!authHeader });

    if (!authHeader || !email) {
      return res.status(400).json({ error: 'Missing token or email' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(400).json({ error: 'Invalid authorization header' });
    }

    // Decode token (without verification for now - frontend is trusted)
    // In production, you'd verify the token signature with Azure public keys
    let decodedToken;
    try {
      decodedToken = jwt.decode(token);
      console.log('🔑 Token decoded:', { 
        upn: decodedToken?.upn,
        oid: decodedToken?.oid,
        appid: decodedToken?.appid 
      });
    } catch (decodeErr) {
      console.error('Token decode error:', decodeErr);
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // List of authorized admin emails
    const adminEmails = [
      'studentadmin@fictproftaak07.onmicrosoft.com'
    ];

    const emailLower = email.toLowerCase();
    const isAuthorized = adminEmails.includes(emailLower);
    
    console.log('✅ Admin check:', { email: emailLower, authorized: isAuthorized });

    // Check if email is authorized
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not authorized as admin' });
    }

    // Token is valid and user is admin
    res.json({ 
      success: true, 
      message: 'Admin verified',
      email: email
    });
  } catch (err) {
    console.error('Admin verification error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// =========================
// Newsletter Signup
// =========================
app.post('/v1/newsletter-signup', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    // Ensure table exists before inserting
    await pool.query(`
      CREATE TABLE IF NOT EXISTS newsletter_emails (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    const query = `INSERT INTO newsletter_emails (email) VALUES ($1) RETURNING id`;
    
    const result = await pool.query(query, [email]);
    console.log(`✅ Newsletter signup saved (ID: ${result.rows[0].id}): ${email}`);
    
    // Emit live update to all connected clients
    io.emit('newsletter-signup', { email, timestamp: new Date() });

    // Send to Discord webhook if configured
    if (process.env.WEBHOOK_URL) {
      try {
        await axios.post(process.env.WEBHOOK_URL, {
          content: `📬 New newsletter signup: ${email}`
        });
        console.log('Discord webhook sent');
      } catch (webhookErr) {
        console.error('Webhook error:', webhookErr.message);
      }
    }
    
    res.status(200).json({ success: true, message: 'Email saved' });
  } catch (err) {
    console.error('❌ Newsletter signup error:', err);
    console.error('Error details:', err.message, err.code);
    
    // Check for duplicate email (PostgreSQL unique constraint violation)
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already subscribed' });
    }
    
    res.status(500).json({ error: 'Error saving email: ' + err.message });
  }
});

// =========================
// Get Newsletter Emails (for admin)
// =========================
app.get('/v1/newsletter-emails', async (req, res) => {
  try {
    const result = await pool.query(`SELECT email FROM newsletter_emails ORDER BY email`);
    
    res.json({
      success: true,
      count: result.rows.length,
      emails: result.rows.map(row => row.email)
    });
  } catch (err) {
    console.error('Error fetching newsletter emails:', err);
    res.status(500).json({ error: 'Error fetching emails' });
  }
});

// =========================
// Send Newsletter Email
// =========================
app.post('/v1/send-newsletter', async (req, res) => {
  const { subject, message } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ error: 'Subject and message are required' });
  }

  try {
    const result = await pool.query(`SELECT email FROM newsletter_emails`);
    const emails = result.rows.map(row => row.email);

    if (emails.length === 0) {
      return res.status(400).json({ error: 'No subscribers found' });
    }

    // Setup email transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Email options
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: emails.join(','),
      subject: subject,
      text: message,
      html: `<p>${message.replace(/\n/g, '<br>')}</p>`
    };

    // Send email
    await transporter.sendMail(mailOptions);
    
    console.log(`📧 Newsletter sent to ${emails.length} subscribers: "${subject}"`);
    
    res.json({ 
      success: true, 
      message: `Newsletter sent to ${emails.length} subscribers!` 
    });
  } catch (err) {
    console.error('Newsletter send error:', err);
    res.status(500).json({ error: 'Error sending newsletter: ' + err.message });
  }
});

// Start server!!
server.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready for live updates`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  pool.close();
  process.exit();
});
