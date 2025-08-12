const mongoose = require('mongoose');
const { Schema } = mongoose;

// সাপোর্ট টিকিটের জন্য একটি স্কিমা তৈরি করা হচ্ছে
const supportTicketSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'closed'], // টিকিটের অবস্থা
    default: 'open'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// মডেল এক্সপোর্ট করা হচ্ছে
module.exports = mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema);
