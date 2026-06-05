const mongoose = require('mongoose');

let isMockMode = false;

// In-memory data store for Demo Mode
const mockStore = {
  users: [],
  transactions: [],
  budgets: []
};

async function connectDB() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense-tracker';
  
  try {
    // Set connection timeout short to fallback quickly if not running
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 3000
    });
    console.log('MongoDB Connected Successfully to:', mongoURI);
  } catch (err) {
    console.error('================================================================');
    console.error('WARNING: Could not connect to MongoDB database at:', mongoURI);
    console.error('Reason:', err.message);
    console.error('----------------------------------------------------------------');
    console.error('Activating DEMO_MODE: Server will run using an in-memory database.');
    console.error('Data will NOT be persisted across server restarts.');
    console.error('================================================================');
    isMockMode = true;
  }
}

module.exports = {
  connectDB,
  getIsMockMode: () => isMockMode,
  setMockMode: (val) => { isMockMode = val; },
  mockStore
};
