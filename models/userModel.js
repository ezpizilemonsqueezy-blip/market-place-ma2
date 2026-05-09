const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const passwordExpiryDays = Number(process.env.PASSWORD_EXPIRY_DAYS || 90);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please tell us your name'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, 'Please provide a valid email']
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 8,
      select: false
    },
    passwordConfirm: {
      type: String,
      required: [true, 'Please confirm your password'],
      validate: {
        validator(value) {
          return value === this.password;
        },
        message: 'Passwords do not match'
      }
    },
    passwordChangedAt: Date,
    passwordExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + passwordExpiryDays * 24 * 60 * 60 * 1000)
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
    active: {
      type: Boolean,
      default: true,
      select: false
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre(/^find/, function() {
  this.find({ active: { $ne: false } });
});

userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
  this.passwordExpiresAt = new Date(Date.now() + passwordExpiryDays * 24 * 60 * 60 * 1000);
});

userSchema.pre('save', function() {
  if (!this.isModified('password') || this.isNew) return;

  this.passwordChangedAt = new Date(Date.now() - 1000);
});

userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (!this.passwordChangedAt) return false;

  const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
  return JWTTimestamp < changedTimestamp;
};

userSchema.methods.passwordExpired = function() {
  if (!this.passwordExpiresAt) return false;
  return this.passwordExpiresAt.getTime() <= Date.now();
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
