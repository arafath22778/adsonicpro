const mongoose = require('mongoose');

const bonusCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  reward: { type: Number, default: 10 },
  active: { type: Boolean, default: true },
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

module.exports = mongoose.models.BonusCode || mongoose.model('BonusCode', bonusCodeSchema);