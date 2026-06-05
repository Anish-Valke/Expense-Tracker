const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const cors = require('cors');
const { connectDB } = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();

// Enable CORS for cross-origin frontend requests
app.use(cors({
  origin: true, // Automatically mirrors request origin, allowing local files and custom local ports
  credentials: true
}));

// Body parser & Cookie parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Connect to database
connectDB();

// Mount routers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/reports', require('./routes/reports'));

// Static files are handled by express.static, no wildcard fallback needed.

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`Expense Tracker server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`Local Access URL: http://localhost:${PORT}`);
  console.log(`================================================================`);
});
