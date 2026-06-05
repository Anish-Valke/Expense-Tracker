const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const { protect } = require('../middleware/auth');
const dbConfig = require('../config/db');

// Helper to get last 6 months name labels
const getLast6MonthsLabels = () => {
  const labels = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      name: d.toLocaleString('default', { month: 'short' }) + ' ' + d.getFullYear().toString().substr(-2)
    });
  }
  return labels;
};

// @desc    Get dashboard summary stats
// @route   GET /api/reports/dashboard
// @access  Private
router.get('/dashboard', protect, async (req, res) => {
  const userId = req.user._id;

  try {
    let allTransactions = [];
    
    if (dbConfig.getIsMockMode()) {
      allTransactions = dbConfig.mockStore.transactions.filter(t => t.user === userId);
    } else {
      allTransactions = await Transaction.find({ user: userId });
    }

    let totalIncome = 0;
    let totalExpenses = 0;

    allTransactions.forEach(t => {
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else {
        totalExpenses += t.amount;
      }
    });

    const balance = totalIncome - totalExpenses;

    // Get 5 recent transactions sorted by date descending
    const recentTransactions = [...allTransactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    // Calculate budget alerts: budgets >= 80% limit
    let budgetAlerts = [];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    if (dbConfig.getIsMockMode()) {
      const budgets = dbConfig.mockStore.budgets.filter(b => b.user === userId);
      const expenses = dbConfig.mockStore.transactions.filter(t => 
        t.user === userId && 
        t.type === 'expense' && 
        new Date(t.date) >= startOfMonth && 
        new Date(t.date) <= endOfMonth
      );

      budgets.forEach(b => {
        const spent = expenses
          .filter(e => e.category === b.category)
          .reduce((sum, e) => sum + e.amount, 0);
        
        const percent = b.limit > 0 ? (spent / b.limit) * 100 : 0;
        if (percent >= 80) {
          budgetAlerts.push({
            category: b.category,
            limit: b.limit,
            spent,
            percent: Math.round(percent)
          });
        }
      });
    } else {
      const budgets = await Budget.find({ user: userId }).lean();
      const expenses = await Transaction.aggregate([
        {
          $match: {
            user: userId,
            type: 'expense',
            date: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: {
            _id: '$category',
            spent: { $sum: '$amount' }
          }
        }
      ]);

      const expenseMap = {};
      expenses.forEach(e => { expenseMap[e._id] = e.spent; });

      budgets.forEach(b => {
        const spent = expenseMap[b.category] || 0;
        const percent = b.limit > 0 ? (spent / b.limit) * 100 : 0;
        if (percent >= 80) {
          budgetAlerts.push({
            category: b.category,
            limit: b.limit,
            spent,
            percent: Math.round(percent)
          });
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        balance,
        recentTransactions,
        budgetAlerts
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @desc    Get detailed analysis reports
// @route   GET /api/reports/analysis
// @access  Private
router.get('/analysis', protect, async (req, res) => {
  const userId = req.user._id;

  try {
    let allTransactions = [];
    if (dbConfig.getIsMockMode()) {
      allTransactions = dbConfig.mockStore.transactions.filter(t => t.user === userId);
    } else {
      allTransactions = await Transaction.find({ user: userId });
    }

    // 1. Category spending breakdown
    const categoryBreakdown = {};
    let totalExpenseAmount = 0;
    
    allTransactions.forEach(t => {
      if (t.type === 'expense') {
        categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + t.amount;
        totalExpenseAmount += t.amount;
      }
    });

    const categoryData = Object.keys(categoryBreakdown).map(cat => ({
      category: cat,
      amount: categoryBreakdown[cat],
      percentage: totalExpenseAmount > 0 ? Math.round((categoryBreakdown[cat] / totalExpenseAmount) * 100) : 0
    }));

    // Sort category data by amount descending
    categoryData.sort((a, b) => b.amount - a.amount);

    // 2. Last 6 months trends (income vs expense)
    const months = getLast6MonthsLabels();
    const trendData = months.map(m => {
      let income = 0;
      let expense = 0;

      allTransactions.forEach(t => {
        const tDate = new Date(t.date);
        if (tDate.getFullYear() === m.year && tDate.getMonth() === m.month) {
          if (t.type === 'income') {
            income += t.amount;
          } else if (t.type === 'expense') {
            expense += t.amount;
          }
        }
      });

      return {
        label: m.name,
        income,
        expense
      };
    });

    // 3. Generate Insights (rules-based smart notifications)
    const insights = [];
    const now = new Date();
    
    // Calculate current month vs last month spending
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    let curMonthSpent = 0;
    let lastMonthSpent = 0;

    allTransactions.forEach(t => {
      if (t.type === 'expense') {
        const d = new Date(t.date);
        if (d >= startOfCurrentMonth) {
          curMonthSpent += t.amount;
        } else if (d >= startOfLastMonth && d <= endOfLastMonth) {
          lastMonthSpent += t.amount;
        }
      }
    });

    if (lastMonthSpent > 0) {
      const diff = curMonthSpent - lastMonthSpent;
      const percent = Math.round((Math.abs(diff) / lastMonthSpent) * 100);
      if (diff > 0) {
        insights.push({
          type: 'warning',
          text: `Your spending this month is ${percent}% higher than last month ($${curMonthSpent} vs $${lastMonthSpent}). Try reviewing your recent transactions.`
        });
      } else if (diff < 0) {
        insights.push({
          type: 'success',
          text: `Fantastic! You have spent ${percent}% less this month compared to last month ($${curMonthSpent} vs $${lastMonthSpent}). Keep it up!`
        });
      }
    } else if (curMonthSpent > 0) {
      insights.push({
        type: 'info',
        text: `You have spent $${curMonthSpent} this month. Add transactions regularly to track trends next month.`
      });
    }

    // Identify highest expense category
    if (categoryData.length > 0) {
      const highest = categoryData[0];
      if (highest.percentage >= 35) {
        insights.push({
          type: 'warning',
          text: `Your spending in "${highest.category}" accounts for ${highest.percentage}% of your total expenses. Consider settings budgets to curb this category.`
        });
      } else {
        insights.push({
          type: 'info',
          text: `Your top expense category is "${highest.category}" representing $${highest.amount} (${highest.percentage}% of all expenses).`
        });
      }
    }

    // Savings rate insight
    let totalIncomeAmount = 0;
    allTransactions.forEach(t => {
      if (t.type === 'income') totalIncomeAmount += t.amount;
    });

    if (totalIncomeAmount > 0) {
      const savingsRate = Math.round(((totalIncomeAmount - totalExpenseAmount) / totalIncomeAmount) * 100);
      if (savingsRate > 20) {
        insights.push({
          type: 'success',
          text: `Awesome! Your lifetime savings rate is ${savingsRate}%. Financial experts recommend saving at least 20% of your income.`
        });
      } else if (savingsRate < 5 && savingsRate >= 0) {
        insights.push({
          type: 'warning',
          text: `Your savings rate is currently very low (${savingsRate}%). Try to target saving at least 10% to 20% of your earnings.`
        });
      } else if (savingsRate < 0) {
        insights.push({
          type: 'danger',
          text: `Warning: You are spending more than your income (Savings Rate: ${savingsRate}%). Check budgets to prevent debt building.`
        });
      }
    }

    // Fallback default insight if empty
    if (insights.length === 0) {
      insights.push({
        type: 'info',
        text: 'Add transaction income and expenses to unlock personalized AI financial health insights.'
      });
    }

    // Calculate Budget Health score
    let budgetHealthScore = 100;
    let underBudgetsCount = 0;
    let totalBudgetsCount = 0;

    let budgets = [];
    if (dbConfig.getIsMockMode()) {
      budgets = dbConfig.mockStore.budgets.filter(b => b.user === userId);
    } else {
      budgets = await Budget.find({ user: userId });
    }

    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    if (budgets.length > 0) {
      totalBudgetsCount = budgets.length;
      
      // Calculate current month's spending per category
      const categorySpent = {};
      allTransactions.forEach(t => {
        if (t.type === 'expense') {
          const d = new Date(t.date);
          if (d >= startOfCurrentMonth && d <= endOfCurrentMonth) {
            categorySpent[t.category] = (categorySpent[t.category] || 0) + t.amount;
          }
        }
      });

      budgets.forEach(b => {
        const spent = categorySpent[b.category] || 0;
        if (spent <= b.limit) {
          underBudgetsCount++;
        }
      });

      budgetHealthScore = Math.round((underBudgetsCount / totalBudgetsCount) * 100);
    }

    // Calculate top merchants dynamically
    const merchantMap = {};
    allTransactions.forEach(t => {
      if (t.type === 'expense') {
        const name = t.title || 'Unknown';
        if (!merchantMap[name]) {
          merchantMap[name] = { name, count: 0, total: 0, category: t.category };
        }
        merchantMap[name].count += 1;
        merchantMap[name].total += t.amount;
      }
    });

    const merchantsList = Object.values(merchantMap);
    merchantsList.sort((a, b) => b.total - a.total);
    const topMerchants = merchantsList.slice(0, 3).map(m => {
      return {
        name: m.name,
        count: m.count,
        category: m.category,
        total: m.total,
        percent: totalExpenseAmount > 0 ? ((m.total / totalExpenseAmount) * 100).toFixed(1) + '%' : '0%',
        icon: m.category ? m.category.toLowerCase() : 'other'
      };
    });

    res.status(200).json({
      success: true,
      data: {
        categoryData,
        trendData,
        insights,
        budgetHealth: {
          score: budgetHealthScore,
          underCount: underBudgetsCount,
          totalCount: totalBudgetsCount
        },
        topMerchants
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
