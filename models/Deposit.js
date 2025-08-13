const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  transactionId: {
    type: String,
    required: true
  },
  method: {
    type: String,
    required: true
  },
  screenshotUrl: {
    type: String
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

module.exports = mongoose.model('Deposit', depositSchema);
