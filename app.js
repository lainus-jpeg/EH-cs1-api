require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const sql = require('mssql');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
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
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(express.json());

// Database configuration
const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    }
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 30000,
    requestTimeout: 30000
  }
};

// Create connection pool
const pool = new sql.ConnectionPool(config);

// Connect to database
pool.connect((err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to Azure SQL Database');
    // Create tables on startup
    createTables();
  }
});

// Create necessary tables
async function createTables() {
  try {
    const request = pool.request();
    
    // Create Users table if it doesn't exist
    await request.query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Users')
      BEGIN
        CREATE TABLE Users (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          Name NVARCHAR(255) NOT NULL,
          Email NVARCHAR(255) NOT NULL UNIQUE,
          Phone NVARCHAR(20),
          Password NVARCHAR(255) NOT NULL
        );
      END
    `);
    
    // Create NewsletterEmails table if it doesn't exist
    await request.query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'NewsletterEmails')
      BEGIN
        CREATE TABLE NewsletterEmails (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          Email NVARCHAR(255) NOT NULL UNIQUE,
          CreatedAt DATETIME DEFAULT GETDATE()
        );
      END
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
    const request = pool.request();
    const query = `
      INSERT INTO Users (Name, Email, Phone, Password)
      VALUES (@name, @email, @phone, @password)
    `;

    request.input('name', sql.NVarChar, name);
    request.input('email', sql.NVarChar, email);
    request.input('phone', sql.NVarChar, phone);
    request.input('password', sql.NVarChar, hashedPassword);

    await request.query(query);

    res.status(201).json({ success: true, message: 'User registered successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    
    // Check for duplicate email
    if (err.originalError && err.originalError.info && err.originalError.info.number === 2627) {
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
    const request = pool.request();
    const query = `SELECT Id, Name, Email, Password FROM Users WHERE Email = @email`;
    request.input('email', sql.NVarChar, email);

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.recordset[0];

    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, user.Password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Login successful
    res.json({ 
      success: true, 
      message: 'Login successful',
      userId: user.Id,
      name: user.Name
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
    const request = pool.request();
    const query = `INSERT INTO NewsletterEmails (Email) VALUES (@email)`;
    request.input('email', sql.NVarChar, email);
    
    await request.query(query);
    
    // Emit live update to all connected clients
    io.emit('newsletter-signup', { email, timestamp: new Date() });
    console.log(`📬 New newsletter signup: ${email}`);

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
    console.error('Newsletter signup error:', err);
    
    // Check for duplicate email
    if (err.originalError && err.originalError.info && err.originalError.info.number === 2627) {
      return res.status(400).json({ error: 'Email already subscribed' });
    }
    
    res.status(500).json({ error: 'Error saving email' });
  }
});

// =========================
// Get Newsletter Emails (for admin)
// =========================
app.get('/v1/newsletter-emails', async (req, res) => {
  try {
    const request = pool.request();
    const result = await request.query(`SELECT Email FROM NewsletterEmails ORDER BY Email`);
    
    res.json({
      success: true,
      count: result.recordset.length,
      emails: result.recordset.map(row => row.Email)
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
    const request = pool.request();
    const result = await request.query(`SELECT Email FROM NewsletterEmails`);
    const emails = result.recordset.map(row => row.Email);

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

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready for live updates`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  pool.close();
  process.exit();
});
