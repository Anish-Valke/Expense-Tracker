const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Please add an amount']
  },
  type: {
    type: String,
    required: [true, 'Please select type'],
    enum: ['income', 'expense']
  },
  category: {
    type: String,
    required: [true, 'Please select category'],
    enum: ['Groceries', 'Rent', 'Shopping', 'Utilities', 'Entertainment', 'Salary', 'Others', 'Dining Out', 'Transport', 'Income']
  },
  date: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Transaction', TransactionSchema);
