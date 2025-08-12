const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  source: { type: String, required: true },
  note: { type: String },
  createdAt: { type: Date, default: Date.now }  // ✅ গুরুত্বপূর্ণ
});

module.exports = mongoose.models.Commission || mongoose.model('Commission', commissionSchema);