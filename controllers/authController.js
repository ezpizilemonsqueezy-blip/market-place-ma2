const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const User = require('../models/userModel');
const { sendEmail } = require('../utils/email');

const signToken = id =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'dev-secret-key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  });

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieExpiresInDays = Number(process.env.JWT_COOKIE_EXPIRES_IN || 7);

  res.cookie('jwt', token, {
    expires: new Date(Date.now() + cookieExpiresInDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  user.password = undefined;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

const getTokenFromRequest = req => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }

  if (req.cookies && req.cookies.jwt) return req.cookies.jwt;
  return null;
};

const validateEmailInput = email => typeof email === 'string' && validator.isEmail(email);

exports.signup = async (req, res) => {
  try {
    if (!validateEmailInput(req.body.email)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide a valid email'
      });
    }

    const newUser = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      passwordConfirm: req.body.passwordConfirm
    });

    createSendToken(newUser, 201, res);
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};

exports.login = async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide email and password'
      });
    }

    if (typeof email !== 'string' || !validator.isEmail(email)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide a valid email'
      });
    }

    const user = await User.findOne({ email: email }).select('+password +active');

    if (!user || !(await user.correctPassword(password, user.password))) {
      return res.status(401).json({
        status: 'fail',
        message: 'Incorrect email or password'
      });
    }

    if (!user.active) {
      return res.status(401).json({
        status: 'fail',
        message: 'This user account is no longer active'
      });
    }

    createSendToken(user, 200, res);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.protect = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        status: 'fail',
        message: 'You are not logged in. Please log in to get access.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key');
    } catch (error) {
      return res.status(401).json({
        status: 'fail',
        message: error.name === 'TokenExpiredError' ? 'Your token has expired.' : 'Invalid token.'
      });
    }

    const currentUser = await User.findById(decoded.id).select('+active');

    if (!currentUser) {
      return res.status(401).json({
        status: 'fail',
        message: 'The user that owns this token no longer exists.'
      });
    }

    if (!currentUser.active) {
      return res.status(401).json({
        status: 'fail',
        message: 'This user account is no longer active.'
      });
    }

    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        status: 'fail',
        message: 'User recently changed password. Please log in again.'
      });
    }

    if (currentUser.passwordExpired()) {
      return res.status(401).json({
        status: 'fail',
        message: 'Your password has expired. Please reset or update your password.'
      });
    }

    req.user = currentUser;
    res.locals.user = currentUser;
    next();
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.restrictTo = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      status: 'fail',
      message: 'You do not have permission to perform this action.'
    });
  }

  next();
};

exports.forgotPassword = async (req, res) => {
  try {
    const email = req.body.email;

    if (!validateEmailInput(email)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide a valid email'
      });
    }

    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'There is no user with that email address.'
      });
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;
    const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}\nIf you did not forget your password, please ignore this email.`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Your password reset token (valid for 10 min)',
        message
      });

      res.status(200).json({
        status: 'success',
        message: 'Token sent to email.'
      });
    } catch (error) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      res.status(500).json({
        status: 'error',
        message: 'There was an error sending the email. Try again later.'
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        status: 'fail',
        message: 'Token is invalid or has expired.'
      });
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    createSendToken(user, 200, res);
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    if (!(await user.correctPassword(req.body.currentPassword, user.password))) {
      return res.status(401).json({
        status: 'fail',
        message: 'Your current password is wrong.'
      });
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    createSendToken(user, 200, res);
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};

exports.logout = (req, res) => {
  res.cookie('jwt', 'logged-out', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    status: 'success'
  });
};
