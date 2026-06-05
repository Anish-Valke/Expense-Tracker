const jwt = require('jsonwebtoken');
const User = require('../models/User');
const dbConfig = require('../config/db');

exports.protect = async (req, res, next) => {
  let token;

  // Check for token in cookies first, then in Authorization header
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_key_for_expense_tracker');

    if (dbConfig.getIsMockMode()) {
      // Find in-memory user
      const user = dbConfig.mockStore.users.find(u => u._id === decoded.id);
      if (!user) {
        return res.status(401).json({ success: false, error: 'User not found in demo session' });
      }
      req.user = user;
    } else {
      // Find database user
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({ success: false, error: 'User not found' });
      }
      req.user = user;
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
  }
};
