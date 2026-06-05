const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const dbConfig = require('../config/db');

// Helper to generate and send JWT token in HTTP-only cookie and JSON response
const sendTokenResponse = (user, statusCode, res) => {
  const token = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET || 'super_secret_key_for_expense_tracker',
    { expiresIn: '30d' }
  );

  const cookieOptions = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: 'Please provide username, email and password' });
  }

  try {
    if (dbConfig.getIsMockMode()) {
      // In-Memory Registration
      const emailExists = dbConfig.mockStore.users.some(u => u.email === email.toLowerCase());
      if (emailExists) {
        return res.status(400).json({ success: false, error: 'Email already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = 'user_' + Math.random().toString(36).substr(2, 9);
      const newUser = {
        _id: userId,
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
        createdAt: new Date()
      };

      dbConfig.mockStore.users.push(newUser);



      sendTokenResponse(newUser, 201, res);
    } else {
      // MongoDB Registration
      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({ success: false, error: 'Email already registered' });
      }

      const user = await User.create({ username, email, password });
      sendTokenResponse(user, 201, res);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Please provide email and password' });
  }

  try {
    if (dbConfig.getIsMockMode()) {
      // In-Memory Login
      const user = dbConfig.mockStore.users.find(u => u.email === email.toLowerCase());
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      sendTokenResponse(user, 200, res);
    } else {
      // MongoDB Login
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      sendTokenResponse(user, 200, res);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @desc    Log user out / clear cookie
// @route   GET /api/auth/logout
// @access  Public
router.get('/logout', (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({ success: true, data: {} });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  // req.user is attached by protect middleware
  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email
    }
  });
});

module.exports = router;
