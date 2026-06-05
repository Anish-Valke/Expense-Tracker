const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');
const dbConfig = require('../config/db');

// @desc    Get all transactions (filtered/searched)
// @route   GET /api/transactions
// @access  Private
router.get('/', protect, async (req, res) => {
  const userId = req.user._id;

  try {
    let transactions = [];

    if (dbConfig.getIsMockMode()) {
      // Fetch in-memory transactions and clone them
      transactions = dbConfig.mockStore.transactions
        .filter(t => t.user === userId)
        .map(t => ({ ...t }));
        
      // Apply search / filter locally
      const { type, category, q, startDate, endDate } = req.query;

      if (type) {
        transactions = transactions.filter(t => t.type === type);
      }
      if (category) {
        transactions = transactions.filter(t => t.category === category);
      }
      if (q) {
        const queryLower = q.toLowerCase();
        transactions = transactions.filter(
          t => t.title.toLowerCase().includes(queryLower) || 
               (t.description && t.description.toLowerCase().includes(queryLower))
        );
      }
      if (startDate) {
        const start = new Date(startDate);
        transactions = transactions.filter(t => new Date(t.date) >= start);
      }
      if (endDate) {
        const end = new Date(endDate);
        // Extend end date to end of the day
        end.setHours(23, 59, 59, 999);
        transactions = transactions.filter(t => new Date(t.date) <= end);
      }

      // Sort by date descending
      transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else {
      // MongoDB query building
      const query = { user: userId };
      const { type, category, q, startDate, endDate } = req.query;

      if (type) query.type = type;
      if (category) query.category = category;
      if (q) {
        query.$or = [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } }
        ];
      }
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          query.date.$lte = end;
        }
      }

      transactions = await Transaction.find(query).sort({ date: -1 });
    }

    res.status(200).json({ success: true, count: transactions.length, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @desc    Add a new transaction
// @route   POST /api/transactions
// @access  Private
router.post('/', protect, async (req, res) => {
  const { title, amount, type, category, date, description } = req.body;

  if (!title || amount === undefined || !type || !category) {
    return res.status(400).json({ success: false, error: 'Please provide title, amount, type and category' });
  }

  try {
    let transaction;

    if (dbConfig.getIsMockMode()) {
      transaction = {
        _id: 'tx_' + Math.random().toString(36).substr(2, 9),
        user: req.user._id,
        title,
        amount: Number(amount),
        type,
        category,
        date: date ? new Date(date) : new Date(),
        description: description || '',
        createdAt: new Date()
      };
      dbConfig.mockStore.transactions.push(transaction);
    } else {
      transaction = await Transaction.create({
        user: req.user._id,
        title,
        amount,
        type,
        category,
        date: date || undefined,
        description
      });
    }

    res.status(201).json({ success: true, data: transaction });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @desc    Update a transaction
// @route   PUT /api/transactions/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
  const transactionId = req.params.id;
  const { title, amount, type, category, date, description } = req.body;

  try {
    let transaction;

    if (dbConfig.getIsMockMode()) {
      const idx = dbConfig.mockStore.transactions.findIndex(
        t => t._id === transactionId && t.user === req.user._id
      );

      if (idx === -1) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }

      const existing = dbConfig.mockStore.transactions[idx];
      transaction = {
        ...existing,
        title: title !== undefined ? title : existing.title,
        amount: amount !== undefined ? Number(amount) : existing.amount,
        type: type !== undefined ? type : existing.type,
        category: category !== undefined ? category : existing.category,
        date: date !== undefined ? new Date(date) : existing.date,
        description: description !== undefined ? description : existing.description
      };

      dbConfig.mockStore.transactions[idx] = transaction;
    } else {
      let dbTx = await Transaction.findById(transactionId);

      if (!dbTx) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }

      // Check ownership
      if (dbTx.user.toString() !== req.user._id.toString()) {
        return res.status(401).json({ success: false, error: 'Not authorized to update this transaction' });
      }

      dbTx = await Transaction.findByIdAndUpdate(transactionId, req.body, {
        new: true,
        runValidators: true
      });
      transaction = dbTx;
    }

    res.status(200).json({ success: true, data: transaction });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  const transactionId = req.params.id;

  try {
    if (dbConfig.getIsMockMode()) {
      const idx = dbConfig.mockStore.transactions.findIndex(
        t => t._id === transactionId && t.user === req.user._id
      );

      if (idx === -1) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }

      dbConfig.mockStore.transactions.splice(idx, 1);
    } else {
      const transaction = await Transaction.findById(transactionId);

      if (!transaction) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }

      // Check ownership
      if (transaction.user.toString() !== req.user._id.toString()) {
        return res.status(401).json({ success: false, error: 'Not authorized to delete this transaction' });
      }

      await transaction.deleteOne();
    }

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
