const express = require('express');
const router = express.Router();
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');
const dbConfig = require('../config/db');

// Helper to get start and end dates of the current month
const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

// @desc    Get all budgets with current month's actual expenses
// @route   GET /api/budgets
// @access  Private
router.get('/', protect, async (req, res) => {
  const userId = req.user._id;
  const { start, end } = getCurrentMonthRange();

  try {
    let budgets = [];
    let expensesByCategory = {};

    if (dbConfig.getIsMockMode()) {
      // 1. Get mock budgets
      budgets = dbConfig.mockStore.budgets
        .filter(b => b.user === userId)
        .map(b => ({ ...b }));

      // 2. Sum expenses in mockStore for current month
      const currentMonthExpenses = dbConfig.mockStore.transactions.filter(t => 
        t.user === userId &&
        t.type === 'expense' &&
        new Date(t.date) >= start &&
        new Date(t.date) <= end
      );

      currentMonthExpenses.forEach(t => {
        if (!expensesByCategory[t.category]) {
          expensesByCategory[t.category] = 0;
        }
        expensesByCategory[t.category] += t.amount;
      });
    } else {
      // 1. Get database budgets
      budgets = await Budget.find({ user: userId }).lean();

      // 2. Aggregate current month's expenses using Mongoose aggregation
      const expenses = await Transaction.aggregate([
        {
          $match: {
            user: userId,
            type: 'expense',
            date: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: '$category',
            totalSpent: { $sum: '$amount' }
          }
        }
      ]);

      expenses.forEach(item => {
        expensesByCategory[item._id] = item.totalSpent;
      });
    }

    // Combine budget limit and current month's actual spent value
    const data = budgets.map(b => ({
      _id: b._id,
      category: b.category,
      limit: b.limit,
      spent: expensesByCategory[b.category] || 0
    }));

    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @desc    Set or update budget for a category
// @route   POST /api/budgets
// @access  Private
router.post('/', protect, async (req, res) => {
  const { category, limit } = req.body;

  if (!category || limit === undefined) {
    return res.status(400).json({ success: false, error: 'Please provide category and budget limit' });
  }

  const limitNum = Number(limit);
  if (isNaN(limitNum) || limitNum < 0) {
    return res.status(400).json({ success: false, error: 'Budget limit must be a positive number' });
  }

  try {
    let budget;

    if (dbConfig.getIsMockMode()) {
      const idx = dbConfig.mockStore.budgets.findIndex(
        b => b.user === req.user._id && b.category === category
      );

      if (idx !== -1) {
        // Update budget
        dbConfig.mockStore.budgets[idx].limit = limitNum;
        budget = dbConfig.mockStore.budgets[idx];
      } else {
        // Create budget
        budget = {
          _id: 'bd_' + Math.random().toString(36).substr(2, 9),
          user: req.user._id,
          category,
          limit: limitNum,
          createdAt: new Date()
        };
        dbConfig.mockStore.budgets.push(budget);
      }
    } else {
      // Find budget for this category and user; update if exists, else insert (upsert)
      budget = await Budget.findOneAndUpdate(
        { user: req.user._id, category },
        { limit: limitNum },
        { new: true, upsert: true, runValidators: true }
      );
    }

    res.status(200).json({ success: true, data: budget });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @desc    Delete a budget
// @route   DELETE /api/budgets/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  const budgetId = req.params.id;

  try {
    if (dbConfig.getIsMockMode()) {
      const idx = dbConfig.mockStore.budgets.findIndex(
        b => b._id === budgetId && b.user === req.user._id
      );

      if (idx === -1) {
        return res.status(404).json({ success: false, error: 'Budget not found' });
      }

      dbConfig.mockStore.budgets.splice(idx, 1);
    } else {
      const budget = await Budget.findById(budgetId);

      if (!budget) {
        return res.status(404).json({ success: false, error: 'Budget not found' });
      }

      // Check ownership
      if (budget.user.toString() !== req.user._id.toString()) {
        return res.status(401).json({ success: false, error: 'Not authorized to delete this budget' });
      }

      await budget.deleteOne();
    }

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
