// models/SpinHistory.js
const mongoose = require('mongoose');

const spinHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reward: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SpinHistory', spinHistorySchema);