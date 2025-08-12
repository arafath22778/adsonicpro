// models/Deposit.js
const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: Number,
  phone: String,
  transactionId: String,
  method: String,
  screenshotUrl: String,
  status: { type: String, default: 'pending' } // new: pending, approved, rejected
}, { timestamps: true });

module.exports = mongoose.model('Deposit', depositSchema);