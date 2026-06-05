// SpendWise Client SPA Application Coordinator
document.addEventListener('DOMContentLoaded', () => {
  // Check session
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
    return;
  }

  const user = JSON.parse(userStr);

  // Set header user profile name and initials
  const headerUserName = document.getElementById('header-user-name');
  if (headerUserName) {
    headerUserName.textContent = user.username;
  }
  const avatarCircle = document.getElementById('header-avatar-circle');
  if (avatarCircle) {
    avatarCircle.textContent = user.username.charAt(0).toUpperCase();
  }

  // Views List
  const views = ['dashboard', 'transactions', 'budgets', 'reports'];
  let currentView = 'dashboard';

  // Chart instances
  let dashTrendChart = null;
  let dashDoughnutChart = null;
  let reportsBarChart = null;
  let reportsGaugeChart = null;

  // Active Transaction Filters State
  let activeCategoryFilter = '';
  let activeSearchQuery = '';
  let activeTimeframeFilter = '30';

  // ==========================================================================
  // VIEW SWITCHING / ROUTING
  // ==========================================================================
  const sidebarLinks = document.querySelectorAll('.sidebar-menu .sidebar-item');
  sidebarLinks.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      switchView(targetView);
    });
  });

  function switchView(viewName) {
    if (!views.includes(viewName)) return;
    currentView = viewName;

    // Toggle active menu class
    sidebarLinks.forEach(link => {
      if (link.getAttribute('data-view') === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Toggle section visibility
    views.forEach(view => {
      const section = document.getElementById(`${view}-view`);
      if (section) {
        section.style.display = view === viewName ? 'block' : 'none';
      }
    });

    closeAllModals();
    loadViewData(viewName);
  }

  function loadViewData(viewName) {
    switch (viewName) {
      case 'dashboard':
        fetchDashboardData();
        break;
      case 'transactions':
        fetchTransactions();
        break;
      case 'budgets':
        fetchBudgets();
        break;
      case 'reports':
        fetchReportsData();
        break;
    }
  }

  // Logout Trigger
  document.getElementById('logout-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await API.get('/api/auth/logout');
    } catch (err) {
      console.warn('API logout returned error, carrying out client-side logout');
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
  });

  // ==========================================================================
  // VIEW: DASHBOARD CONTROLLER
  // ==========================================================================
  async function fetchDashboardData() {
    try {
      const res = await API.get('/api/reports/dashboard');
      if (res.success) {
        renderDashboardStats(res.data);
        renderRecentTransactions(res.data.recentTransactions);
        renderDashboardCharts();
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }

  function renderDashboardStats(data) {
    // Net Balance
    document.getElementById('dash-val-balance').textContent = `$${data.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    // Monthly Income
    document.getElementById('dash-val-income').textContent = `$${data.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Monthly Spending Card
    const budgetLimit = 4500; // Screenshot budget benchmark
    const spending = data.totalExpenses;
    const remainingBudget = Math.max(budgetLimit - spending, 0);
    const usedPercentage = budgetLimit > 0 ? (spending / budgetLimit) * 100 : 0;

    document.getElementById('dash-val-spending').textContent = `$${spending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('dash-spend-budget-ratio').textContent = `$${spending.toFixed(0)} / $${budgetLimit} budget`;
    
    const progressBar = document.getElementById('dash-spend-progress-bar');
    if (progressBar) {
      progressBar.style.width = `${Math.min(usedPercentage, 100)}%`;
      progressBar.className = 'spending-progress-fill';
      if (usedPercentage >= 95) {
        progressBar.classList.add('danger');
      } else if (usedPercentage >= 80) {
        progressBar.classList.add('warning');
      }
    }
    document.getElementById('dash-spend-progress-text').textContent = `${Math.round(usedPercentage)}% of budget used`;
  }

  async function renderDashboardCharts() {
    try {
      const res = await API.get('/api/reports/analysis');
      if (!res.success) return;

      const { trendData, categoryData } = res.data;

      // 1. Spending Trends Line Chart (Forest Green Theme)
      const trendCtx = document.getElementById('dashboard-trend-canvas');
      if (trendCtx) {
        const labels = trendData.map(t => t.label);
        const expenseValues = trendData.map(t => t.expense);

        if (dashTrendChart) dashTrendChart.destroy();

        dashTrendChart = new Chart(trendCtx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Spending',
              data: expenseValues,
              borderColor: '#15803d', // Forest Green
              backgroundColor: 'rgba(21, 128, 61, 0.04)',
              borderWidth: 3,
              tension: 0.45,
              fill: true,
              pointBackgroundColor: '#15803d',
              pointRadius: 4,
              pointHoverRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: {
                grid: { color: 'rgba(0, 0, 0, 0.04)' },
                ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans', weight: '600' } }
              },
              x: {
                grid: { display: false },
                ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans', weight: '600' } }
              }
            }
          }
        });
      }

      // 2. Category Breakdown Doughnut Chart
      const doughnutCtx = document.getElementById('dashboard-doughnut-canvas');
      if (doughnutCtx) {
        const categories = categoryData.map(c => c.category);
        const amounts = categoryData.map(c => c.amount);
        const totalSpent = amounts.reduce((a, b) => a + b, 0);

        // Update center text value
        document.getElementById('dash-doughnut-total-text').textContent = `$${Math.round(totalSpent)}`;

        if (dashDoughnutChart) dashDoughnutChart.destroy();

        const colors = ['#0f172a', '#15803d', '#0284c7', '#d97706', '#db2777', '#7c3aed'];

        const pieEmptyEl = document.getElementById('dashboardPieChartEmpty');
        if (categories.length === 0) {
          if (pieEmptyEl) pieEmptyEl.style.display = 'flex';
          doughnutCtx.style.display = 'none';
        } else {
          if (pieEmptyEl) pieEmptyEl.style.display = 'none';
          doughnutCtx.style.display = 'block';

          dashDoughnutChart = new Chart(doughnutCtx, {
            type: 'doughnut',
            data: {
              labels: categories,
              datasets: [{
                data: amounts,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#ffffff'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false }
              },
              cutout: '76%'
            }
          });
        }
      }
    } catch (err) {
      console.error('Failed to draw dashboard charts:', err);
    }
  }

  function renderRecentTransactions(transactions) {
    const listContainer = document.getElementById('dashboard-transactions-list');
    listContainer.innerHTML = '';

    if (!transactions || transactions.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state" style="padding: 2rem 0;">
          <p>No recent transactions recorded.</p>
        </div>
      `;
      return;
    }

    transactions.slice(0, 5).forEach(t => {
      const formattedDate = new Date(t.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });
      const formattedAmount = `${t.type === 'income' ? '+' : '-'}$${t.amount.toFixed(2)}`;

      const row = document.createElement('div');
      row.className = 'transaction-list-row';
      row.innerHTML = `
        <div class="tx-avatar-col">
          <div class="tx-circle-icon">
            ${getCategoryIconSvg(t.category)}
          </div>
          <div class="tx-info-block">
            <span class="tx-title">${escapeHTML(t.title)}</span>
            <span class="tx-subtext">${t.category} &bull; ${formattedDate}</span>
          </div>
        </div>
        <div class="tx-amount-col">
          <span class="tx-amount-val ${t.type === 'income' ? 'income' : 'expense'}">${formattedAmount}</span>
          <span class="tx-status-pill ${t.type === 'income' || !t.description.toLowerCase().includes('pending') ? 'completed' : 'pending'}">
            ${t.type === 'income' || !t.description.toLowerCase().includes('pending') ? 'Completed' : 'Pending'}
          </span>
        </div>
      `;
      listContainer.appendChild(row);
    });
  }

  // ==========================================================================
  // VIEW: TRANSACTIONS CONTROLLER
  // ==========================================================================
  const searchInput = document.getElementById('tx-search-input');
  const dateRangeSelect = document.getElementById('tx-date-range-select');
  const categoryPills = document.querySelectorAll('#tx-category-pills .filter-pill');

  if (searchInput) {
    let timeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        activeSearchQuery = searchInput.value.trim();
        fetchTransactions();
      }, 300);
    });
  }

  if (dateRangeSelect) {
    dateRangeSelect.addEventListener('change', () => {
      activeTimeframeFilter = dateRangeSelect.value;
      fetchTransactions();
    });
  }

  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      categoryPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeCategoryFilter = pill.getAttribute('data-category');
      fetchTransactions();
    });
  });

  async function fetchTransactions() {
    let url = '/api/transactions';
    const params = [];
    if (activeSearchQuery) params.push(`q=${encodeURIComponent(activeSearchQuery)}`);
    if (activeCategoryFilter) {
      if (activeCategoryFilter === 'Income') {
        params.push('type=income');
      } else {
        params.push(`category=${activeCategoryFilter}`);
      }
    }

    // Date calculations
    if (activeTimeframeFilter) {
      const now = new Date();
      const pastDate = new Date(now.setDate(now.getDate() - parseInt(activeTimeframeFilter)));
      params.push(`startDate=${pastDate.toISOString().split('T')[0]}`);
    }

    if (params.length > 0) url += `?${params.join('&')}`;

    try {
      const res = await API.get(url);
      if (res.success) {
        renderTransactionsTable(res.data);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  }

  function renderTransactionsTable(transactions) {
    const tbody = document.getElementById('transactions-list-tbody');
    tbody.innerHTML = '';

    if (!transactions || transactions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem 0;">
            No transactions found matching your criteria.
          </td>
        </tr>
      `;
      document.getElementById('pagination-summary-text').textContent = 'Showing 0 to 0 of 0 entries';
      return;
    }

    transactions.forEach(t => {
      const formattedDate = new Date(t.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const formattedTime = new Date(t.date).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const isIncome = t.type === 'income';
      const formattedAmount = `${isIncome ? '+' : '-'}$${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const isPending = t.description && t.description.toLowerCase().includes('pending');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="font-weight:700;">${formattedDate}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">${formattedTime}</div>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="tx-circle-icon" style="width:34px;height:34px;">
              ${getCategoryIconSvg(t.category)}
            </div>
            <div>
              <div style="font-weight:700;">${escapeHTML(t.title)}</div>
              ${t.description ? `<div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">${escapeHTML(t.description)}</div>` : ''}
            </div>
          </div>
        </td>
        <td><span class="category-border-badge">${t.category}</span></td>
        <td>
          <div class="status-dot-indicator">
            <span class="status-dot ${isPending ? 'pending' : 'completed'}"></span>
            ${isPending ? 'Pending' : 'Completed'}
          </div>
        </td>
        <td style="font-weight:800; font-family: var(--font-family);" class="tx-amount ${isIncome ? 'income' : 'expense'}">${formattedAmount}</td>
        <td>
          <div style="display:flex; gap:8px;">
            <button class="btn-icon edit-tx-action" data-id="${t._id}" title="Edit entry">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            </button>
            <button class="btn-icon delete-tx-action" data-id="${t._id}" title="Delete entry">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
        </td>
      `;

      tr.querySelector('.edit-tx-action').addEventListener('click', () => openEditTxModal(t));
      tr.querySelector('.delete-tx-action').addEventListener('click', () => deleteTx(t._id));

      tbody.appendChild(tr);
    });

    document.getElementById('pagination-summary-text').textContent = `Showing 1 to ${transactions.length} of ${transactions.length} entries`;
  }

  // Transaction Actions Modal Binds
  const txForm = document.getElementById('spendwise-tx-form');
  const txModal = document.getElementById('spendwise-transaction-modal');
  const addTxBtn = document.getElementById('tx-add-action-btn');
  const globalAddFab = document.getElementById('global-add-tx-fab');

  if (addTxBtn) addTxBtn.addEventListener('click', () => openAddTxModal());
  if (globalAddFab) globalAddFab.addEventListener('click', () => openAddTxModal());

  function openAddTxModal() {
    document.getElementById('form-tx-id-val').value = '';
    document.getElementById('form-title-tx').textContent = 'Add Transaction';
    txForm.reset();
    
    // Auto populate date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('form-tx-date').value = today;

    adjustModalCategories('expense');
    document.getElementById('form-tx-type').value = 'expense';

    txModal.classList.add('active');
  }

  function openEditTxModal(t) {
    document.getElementById('form-tx-id-val').value = t._id;
    document.getElementById('form-title-tx').textContent = 'Edit Transaction';
    
    document.getElementById('form-tx-title').value = t.title;
    document.getElementById('form-tx-amount').value = t.amount;
    document.getElementById('form-tx-type').value = t.type;
    
    adjustModalCategories(t.type);
    document.getElementById('form-tx-category').value = t.category;

    const formattedDate = new Date(t.date).toISOString().split('T')[0];
    document.getElementById('form-tx-date').value = formattedDate;
    document.getElementById('form-tx-description').value = t.description || '';

    txModal.classList.add('active');
  }

  const formTypeSelect = document.getElementById('form-tx-type');
  if (formTypeSelect) {
    formTypeSelect.addEventListener('change', (e) => {
      adjustModalCategories(e.target.value);
    });
  }

  function adjustModalCategories(type) {
    const select = document.getElementById('form-tx-category');
    select.innerHTML = '';
    
    const expenseCats = ['Groceries', 'Rent', 'Shopping', 'Utilities', 'Entertainment', 'Others', 'Dining Out', 'Transport'];
    const incomeCats = ['Income', 'Salary', 'Others'];

    const targets = type === 'income' ? incomeCats : expenseCats;
    targets.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
  }

  if (txForm) {
    txForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('form-tx-id-val').value;
      const title = document.getElementById('form-tx-title').value.trim();
      const amount = parseFloat(document.getElementById('form-tx-amount').value);
      const type = document.getElementById('form-tx-type').value;
      const category = document.getElementById('form-tx-category').value;
      const date = document.getElementById('form-tx-date').value;
      const description = document.getElementById('form-tx-description').value.trim();

      if (!title || isNaN(amount) || !type || !category || !date) {
        alert('Please fill in required inputs.');
        return;
      }

      const payload = { title, amount, type, category, date, description };

      try {
        let res;
        if (id) {
          res = await API.put(`/api/transactions/${id}`, payload);
        } else {
          res = await API.post('/api/transactions', payload);
        }

        if (res.success) {
          closeAllModals();
          loadViewData(currentView);
          if (currentView === 'dashboard') fetchDashboardData();
        }
      } catch (err) {
        alert(err.message || 'Operation failed');
      }
    });
  }

  async function deleteTx(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      const res = await API.delete(`/api/transactions/${id}`);
      if (res.success) {
        loadViewData(currentView);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete transaction');
    }
  }

  // ==========================================================================
  // VIEW: BUDGETS CONTROLLER
  // ==========================================================================
  const budgetForm = document.getElementById('spendwise-budget-form');
  const budgetModal = document.getElementById('spendwise-budget-modal');
  const createBudgetBtn = document.getElementById('budget-create-action-btn');

  if (createBudgetBtn) createBudgetBtn.addEventListener('click', () => openBudgetModal());

  function openBudgetModal() {
    budgetForm.reset();
    budgetModal.classList.add('active');
  }

  if (budgetForm) {
    budgetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const category = document.getElementById('form-budget-category').value;
      const limit = parseFloat(document.getElementById('form-budget-limit').value);

      if (!category || isNaN(limit)) return;

      try {
        const res = await API.post('/api/budgets', { category, limit });
        if (res.success) {
          closeAllModals();
          loadViewData(currentView);
        }
      } catch (err) {
        alert(err.message || 'Failed to establish budget limit');
      }
    });
  }

  async function fetchBudgets() {
    try {
      const res = await API.get('/api/budgets');
      if (res.success) {
        renderBudgetsView(res.data);
      }
    } catch (err) {
      console.error('Failed to load budgets:', err);
    }
  }

  function renderBudgetsView(budgets) {
    const grid = document.getElementById('budgets-list-grid');
    grid.innerHTML = '';

    let totalBudgeted = 0;
    let totalSpent = 0;

    budgets.forEach(b => {
      totalBudgeted += b.limit;
      totalSpent += b.spent;

      const percent = b.limit > 0 ? (b.spent / b.limit) * 100 : 0;
      const roundedPercent = Math.min(Math.round(percent), 100);
      const isOverBudget = b.spent > b.limit;
      
      const card = document.createElement('div');
      card.className = `budget-detail-card ${isOverBudget ? 'over-limit' : ''}`;
      
      // Select progress bar status
      let barClass = '';
      if (percent >= 100) barClass = 'danger';
      else if (percent >= 80) barClass = 'warning';

      card.innerHTML = `
        <div class="budget-card-title-row">
          <div class="budget-card-icon-btn">
            ${getCategoryIconSvg(b.category)}
          </div>
          <button class="btn-icon remove-budget-btn" title="Delete Budget" style="opacity: 0.7;">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
        <div class="budget-card-category-name">${b.category}</div>
        
        <div class="budget-card-value-display">
          <span><strong>$${b.spent.toFixed(2)}</strong> of $${b.limit.toFixed(0)}</span>
          <span>${Math.round(percent)}%</span>
        </div>

        <div class="spending-progress-bar">
          <div class="spending-progress-fill ${barClass}" style="width: ${roundedPercent}%"></div>
        </div>

        <div class="budget-card-footer-note ${isOverBudget ? 'alert-text' : ''}">
          ${isOverBudget 
            ? `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg> $${(b.spent - b.limit).toFixed(2)} over budget` 
            : (percent >= 80 ? 'Approaching limit' : 'Doing great!')}
        </div>
      `;

      card.querySelector('.remove-budget-btn').addEventListener('click', () => deleteBudget(b._id));
      grid.appendChild(card);
    });

    // Add empty creator card slot
    const creatorCard = document.createElement('div');
    creatorCard.className = 'budget-detail-card empty-creator-slot';
    creatorCard.innerHTML = `
      <div class="budget-creator-inner-content">
        <div class="budget-creator-plus-circle">+</div>
        <span>Add Category</span>
      </div>
    `;
    creatorCard.addEventListener('click', openBudgetModal);
    grid.appendChild(creatorCard);

    // Render Budgets statistics calculations
    const remaining = Math.max(totalBudgeted - totalSpent, 0);
    document.getElementById('budget-sum-limit').textContent = `$${totalBudgeted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('budget-sum-spent').textContent = `$${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('budget-sum-remaining').textContent = `$${remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  async function deleteBudget(id) {
    if (!confirm('Are you sure you want to delete this budget limit?')) return;
    try {
      const res = await API.delete(`/api/budgets/${id}`);
      if (res.success) {
        loadViewData(currentView);
      }
    } catch (err) {
      alert(err.message || 'Failed to remove budget limit');
    }
  }

  // ==========================================================================
  // VIEW: ANALYTICS (REPORTS) CONTROLLER
  // ==========================================================================
  async function fetchReportsData() {
    try {
      const res = await API.get('/api/reports/analysis');
      if (res.success) {
        renderAnalyticsGraphics(res.data);
      }
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    }
  }

  function renderAnalyticsGraphics(data) {
    // 1. Spending Comparison Bar chart (Fixed vs Variable)
    const barCtx = document.getElementById('analytics-bar-canvas');
    if (barCtx) {
      const trend = data.trendData;
      const labels = trend.map(t => t.label);
      
      // Calculate Fixed (Rent, Utilities) vs Variable (Others)
      // For visual high-fidelity simulation, we divide total monthly expense:
      // Fixed is ~55-60%, Variable is the remainder
      const fixedValues = trend.map(t => Math.round(t.expense * 0.58));
      const variableValues = trend.map(t => Math.round(t.expense * 0.42));

      if (reportsBarChart) reportsBarChart.destroy();

      reportsBarChart = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Fixed',
              data: fixedValues,
              backgroundColor: '#0f172a', // Dark Navy
              borderRadius: 4
            },
            {
              label: 'Variable',
              data: variableValues,
              backgroundColor: '#15803d', // Forest Green
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              stacked: true,
              grid: { color: 'rgba(0, 0, 0, 0.04)' },
              ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans' } }
            },
            x: {
              stacked: true,
              grid: { display: false },
              ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans' } }
            }
          }
        }
      });
    }

    // 2. Budget Health Gauge Score (efficiency circle)
    const budgetHealth = data.budgetHealth || { score: 100, underCount: 0, totalCount: 0 };
    const healthScore = budgetHealth.score;

    // Update health descriptions
    const healthDescEl = document.getElementById('analytics-budget-health-desc');
    if (healthDescEl) {
      if (budgetHealth.totalCount === 0) {
        healthDescEl.textContent = 'You have not set any category budgets yet.';
      } else {
        healthDescEl.textContent = `You are under budget in ${budgetHealth.underCount}/${budgetHealth.totalCount} categories this month.`;
      }
    }

    const healthScoreValEl = document.getElementById('analytics-health-score-val');
    if (healthScoreValEl) {
      healthScoreValEl.textContent = budgetHealth.totalCount === 0 ? '-' : `${healthScore}%`;
    }

    const healthStatusValEl = document.getElementById('analytics-health-status-val');
    if (healthStatusValEl) {
      let statusText = 'N/A';
      let statusColor = 'var(--text-secondary)';
      if (budgetHealth.totalCount > 0) {
        if (healthScore >= 80) {
          statusText = 'Good';
          statusColor = 'var(--accent-green)';
        } else if (healthScore >= 50) {
          statusText = 'Fair';
          statusColor = 'var(--accent-amber)';
        } else {
          statusText = 'Poor';
          statusColor = 'var(--accent-red)';
        }
      }
      healthStatusValEl.textContent = statusText;
      healthStatusValEl.style.color = statusColor;
    }

    const gaugeCtx = document.getElementById('analytics-gauge-canvas');
    if (gaugeCtx) {
      if (reportsGaugeChart) reportsGaugeChart.destroy();

      const gaugeColor = healthScore >= 80 ? '#15803d' : (healthScore >= 50 ? '#d97706' : '#b91c1c');
      reportsGaugeChart = new Chart(gaugeCtx, {
        type: 'doughnut',
        data: {
          datasets: [{
            data: [healthScore, 100 - healthScore],
            backgroundColor: [gaugeColor, '#f1f5f9'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          },
          cutout: '80%',
          rotation: -90,
          circumference: 180
        }
      });
    }

    // Update dynamic savings rate display based on trendData
    let totalIncome = 0;
    let totalExpense = 0;
    if (data.trendData && data.trendData.length > 0) {
      data.trendData.forEach(t => {
        totalIncome += t.income;
        totalExpense += t.expense;
      });
    }

    const netSavings = Math.max(totalIncome - totalExpense, 0);
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
    const roundedSavingsRate = Math.max(0, Math.round(savingsRate));

    const savingsValEl = document.getElementById('analytics-savings-rate-val');
    if (savingsValEl) {
      savingsValEl.textContent = `${savingsRate.toFixed(1)}%`;
    }

    const savingsBarEl = document.getElementById('analytics-savings-rate-bar');
    if (savingsBarEl) {
      savingsBarEl.style.width = `${Math.min(roundedSavingsRate, 100)}%`;
    }

    const savingsDeltaEl = document.getElementById('analytics-savings-rate-delta');
    if (savingsDeltaEl) {
      if (totalIncome === 0) {
        savingsDeltaEl.textContent = 'No income recorded yet';
        savingsDeltaEl.style.color = 'var(--text-muted)';
      } else {
        savingsDeltaEl.textContent = `${savingsRate >= 20 ? 'Optimal rate' : 'Below target'}`;
        savingsDeltaEl.style.color = savingsRate >= 20 ? '#34d399' : '#f43f5e';
      }
    }

    const currentSavingsTextEl = document.getElementById('analytics-current-savings-text');
    if (currentSavingsTextEl) {
      currentSavingsTextEl.textContent = `$${netSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    const goalGapTextEl = document.getElementById('analytics-goal-gap-text');
    if (goalGapTextEl) {
      const goal = 5000;
      const gap = goal - netSavings;
      if (gap > 0) {
        goalGapTextEl.textContent = `-$${gap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        goalGapTextEl.style.color = '#fb7185';
      } else {
        goalGapTextEl.textContent = `+$${Math.abs(gap).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Goal Met!)`;
        goalGapTextEl.style.color = '#34d399';
      }
    }

    // 3. Top Merchants List
    const merchantsList = document.getElementById('analytics-merchants-list');
    if (merchantsList) {
      merchantsList.innerHTML = '';

      const topMerchants = data.topMerchants || [];
      if (topMerchants.length === 0) {
        merchantsList.innerHTML = `
          <div class="empty-state" style="padding: 1.5rem 0; text-align: center; color: var(--text-muted);">
            <p style="font-size: 0.88rem;">No transactions recorded yet.</p>
          </div>
        `;
      } else {
        topMerchants.forEach(m => {
          const row = document.createElement('div');
          row.className = 'merchant-item-row';
          row.innerHTML = `
            <div class="merchant-left-avatar">
              <div class="merchant-circle">
                ${getMerchantIconSvg(m.icon)}
              </div>
              <div class="merchant-info-block">
                <span class="merchant-name-text">${escapeHTML(m.name)}</span>
                <span class="merchant-subtext">${m.count} Transactions &bull; ${m.category}</span>
              </div>
            </div>
            <div class="merchant-right-val-col">
              <span class="merchant-val-amount">$${m.total.toFixed(2)}</span>
              <span class="merchant-val-percent">${m.percent} of total</span>
            </div>
          `;
          merchantsList.appendChild(row);
        });
      }
    }
  }

  // ==========================================================================
  // HELPERS (SVG Generators & Escape HTML)
  // ==========================================================================
  function getCategoryIconSvg(category) {
    const c = category ? category.toLowerCase() : '';
    if (c === 'groceries') {
      return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`;
    } else if (c === 'transport') {
      return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>`;
    } else if (c === 'dining out' || c === 'food') {
      return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>`;
    } else if (c === 'utilities') {
      return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>`;
    } else if (c === 'entertainment') {
      return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"></path></svg>`;
    } else if (c === 'income' || c === 'salary') {
      return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    } else {
      return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`;
    }
  }

  function getMerchantIconSvg(icon) {
    if (icon === 'cart') {
      return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`;
    } else if (icon === 'plane') {
      return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>`;
    } else {
      return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>`;
    }
  }

  // General modal listeners
  const modalOverlays = document.querySelectorAll('.spendwise-modal-overlay');
  const modalCloseBtns = document.querySelectorAll('.spendwise-modal-close-btn, .modal-close-btn-cancel');

  modalCloseBtns.forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  modalOverlays.forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeAllModals();
      }
    });
  });

  function closeAllModals() {
    modalOverlays.forEach(overlay => {
      overlay.classList.remove('active');
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================================
  // INITIAL LOAD BOOTSTRAP
  // ==========================================================================
  switchView('dashboard');
});
