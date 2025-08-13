const mongoose = require('mongoose');

const withdrawSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  method: {
    type: String,
    required: true
  },
  number: {
    type: String,
    required: true
  },
  status: { // নতুন: রিকোয়েস্টের অবস্থা
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvalToken: { // নতুন: ইমেইল অনুমোদনের জন্য অনন্য টোকেন
    type: String,
    required: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Withdraw', withdrawSchema);
