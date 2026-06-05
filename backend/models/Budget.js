const mongoose = require('mongoose');

const BudgetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: [true, 'Please select category'],
    enum: ['Groceries', 'Rent', 'Shopping', 'Utilities', 'Entertainment', 'Others', 'Dining Out', 'Transport'] // Income categories like Salary don't have budgets
  },
  limit: {
    type: Number,
    required: [true, 'Please set budget limit']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure a user can only have one budget per category
BudgetSchema.index({ user: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('Budget', BudgetSchema);
