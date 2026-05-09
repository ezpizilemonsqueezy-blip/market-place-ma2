const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { MongoMemoryServer } = require('mongodb-memory-server');

dotenv.config({ path: path.join(__dirname, '..', 'config.env') });

const productsFile = path.join(__dirname, '..', 'data', 'products.json');
const jsonOutPath = path.join(__dirname, '..', 'verification-auth-output.json');
const markdownOutPath = path.join(__dirname, '..', 'AUTH_SECURITY_VERIFICATION.md');
const emailLogPath = path.join(__dirname, '..', 'logs', 'emails', 'latest-email.json');

const nowId = Date.now();

const request = async (baseUrl, method, route, options = {}) => {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.cookie ? { Cookie: options.cookie } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const rawText = await response.text();
  let data = rawText;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (error) {
    data = rawText;
  }

  const getSetCookie = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    setCookie: getSetCookie,
    data
  };
};

const seedProducts = async Product => {
  const products = JSON.parse(fs.readFileSync(productsFile, 'utf-8'));
  const sanitizedProducts = products.map(({ id, ...product }) => product);

  await Product.deleteMany();
  await Product.create(sanitizedProducts);
};

const signup = (baseUrl, body) => request(baseUrl, 'POST', '/api/v1/users/signup', { body });
const login = (baseUrl, body) => request(baseUrl, 'POST', '/api/v1/users/login', { body });

const buildMarkdown = report => {
  const lines = [
    '# Auth and Security Verification',
    '',
    '## Runtime',
    '',
    `- Generated: ${new Date().toISOString()}`,
    `- Database connected: ${report.meta.databaseConnected}`,
    `- Email transport used: ${report.meta.emailTransport}`,
    '',
    '## Key Outcomes',
    '',
    `- Unauthenticated \`GET /api/v1/products\`: ${report.tests.unauthenticatedGetAll.status} (${report.tests.unauthenticatedGetAll.message})`,
    `- Authenticated \`GET /api/v1/products\`: ${report.tests.authenticatedGetAll.status}`,
    `- Invalid token response: ${report.tests.invalidToken.status} (${report.tests.invalidToken.message})`,
    `- Expired token response: ${report.tests.expiredToken.status} (${report.tests.expiredToken.message})`,
    `- Deleted-user token response: ${report.tests.deletedUserToken.status} (${report.tests.deletedUserToken.message})`,
    `- Expired-password response: ${report.tests.expiredPassword.status} (${report.tests.expiredPassword.message})`,
    `- Normal user delete attempt: ${report.tests.deleteAuthorization.normalUser.status} (${report.tests.deleteAuthorization.normalUser.message})`,
    `- Admin delete attempt: ${report.tests.deleteAuthorization.adminUser.status}`,
    `- Forgot password email token captured: ${report.tests.forgotPassword.resetToken}`,
    `- Reset password response: ${report.tests.forgotPassword.resetResponse.status}`,
    `- Update current password response: ${report.tests.updateMyPassword.updateResponse.status}`,
    `- Update current details response: ${report.tests.updateMe.status}`,
    `- Delete current user response: ${report.tests.deleteMe.deleteResponse.status}`,
    '',
    '## Header Evidence',
    '',
    `- Rate limit headers: limit=${report.tests.headers.rateLimitHeaders['ratelimit-limit']}, remaining=${report.tests.headers.rateLimitHeaders['ratelimit-remaining']}`,
    `- Helmet CSP present: ${Boolean(report.tests.headers.helmetHeaders['content-security-policy'])}`,
    `- Helmet frame protection: ${report.tests.headers.helmetHeaders['x-frame-options'] || 'n/a'}`,
    '',
    '## Cookie Evidence',
    '',
    `- Signup Set-Cookie header: ${report.tests.cookieStorage.setCookie}`,
    '',
    '## Sanitization and HPP',
    '',
    `- XSS-sanitized name result: ${report.tests.sanitization.savedName}`,
    `- HPP duplicate sort status: ${report.tests.hpp.status}`,
    `- HPP duplicate sort first product: ${report.tests.hpp.firstProductName}`,
    '',
    '## Notes',
    '',
    '- Mailtrap-ready transport is supported through `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USERNAME`, and `EMAIL_PASSWORD`.',
    `- In this run, the email transport recorded was \`${report.meta.emailTransport}\`, and the latest email payload is stored in \`logs/emails/latest-email.json\`.`,
    '- Full structured output is saved in `verification-auth-output.json`.'
  ];

  return `${lines.join('\n')}\n`;
};

const run = async () => {
  let server;
  let mongod;

  try {
    mongod = await MongoMemoryServer.create();
    process.env.DATABASE = mongod.getUri('marketplace-auth-tests');

    const connectDB = require('../config/database');
    await connectDB();

    const app = require('../app');
    const Product = require('../models/productModel');
    const User = require('../models/userModel');

    await connectDB();
    await seedProducts(Product);
    await User.deleteMany({});

    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const report = {
      meta: {
        databaseConnected: mongoose.connection.readyState === 1,
        emailTransport: 'json',
        databaseUri: process.env.DATABASE
      },
      tests: {}
    };

    const productDocs = await Product.find().sort('name');
    const deleteTargetForNormal = productDocs[0];
    const deleteTargetForAdmin = productDocs[1];

    const unauthenticatedGetAll = await request(baseUrl, 'GET', '/api/v1/products');
    report.tests.unauthenticatedGetAll = {
      status: unauthenticatedGetAll.status,
      message: unauthenticatedGetAll.data.message
    };

    const normalSignup = await signup(baseUrl, {
      name: 'Normal User',
      email: `normal${nowId}@example.com`,
      password: 'Password123',
      passwordConfirm: 'Password123'
    });
    const normalToken = normalSignup.data.token;

    const authenticatedGetAll = await request(baseUrl, 'GET', '/api/v1/products', {
      token: normalToken
    });
    report.tests.authenticatedGetAll = {
      status: authenticatedGetAll.status,
      resultCount: authenticatedGetAll.data.results
    };

    const invalidToken = await request(baseUrl, 'GET', '/api/v1/products', {
      token: 'this-is-not-a-valid-token'
    });
    report.tests.invalidToken = {
      status: invalidToken.status,
      message: invalidToken.data.message
    };

    const expiredTokenValue = jwt.sign(
      { id: normalSignup.data.data.user._id },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const expiredToken = await request(baseUrl, 'GET', '/api/v1/products', {
      token: expiredTokenValue
    });
    report.tests.expiredToken = {
      status: expiredToken.status,
      message: expiredToken.data.message
    };

    const deletedUserSignup = await signup(baseUrl, {
      name: 'Deleted Token User',
      email: `deleted${nowId}@example.com`,
      password: 'Password123',
      passwordConfirm: 'Password123'
    });
    const deletedUserToken = deletedUserSignup.data.token;
    await User.findByIdAndDelete(deletedUserSignup.data.data.user._id);
    const deletedUserTokenResponse = await request(baseUrl, 'GET', '/api/v1/products', {
      token: deletedUserToken
    });
    report.tests.deletedUserToken = {
      status: deletedUserTokenResponse.status,
      message: deletedUserTokenResponse.data.message
    };

    const expiredPasswordSignup = await signup(baseUrl, {
      name: 'Expired Password User',
      email: `expired${nowId}@example.com`,
      password: 'Password123',
      passwordConfirm: 'Password123'
    });
    const expiredPasswordToken = expiredPasswordSignup.data.token;
    await User.findByIdAndUpdate(expiredPasswordSignup.data.data.user._id, {
      passwordExpiresAt: new Date(Date.now() - 60 * 1000)
    });
    const expiredPasswordResponse = await request(baseUrl, 'GET', '/api/v1/products', {
      token: expiredPasswordToken
    });
    report.tests.expiredPassword = {
      status: expiredPasswordResponse.status,
      message: expiredPasswordResponse.data.message
    };

    const adminUser = await User.create({
      name: 'Admin User',
      email: `admin${nowId}@example.com`,
      password: 'Password123',
      passwordConfirm: 'Password123',
      role: 'admin'
    });

    const adminLogin = await login(baseUrl, {
      email: adminUser.email,
      password: 'Password123'
    });

    const normalDeleteAttempt = await request(
      baseUrl,
      'DELETE',
      `/api/v1/products/${deleteTargetForNormal._id}`,
      { token: normalToken }
    );
    const adminDeleteAttempt = await request(
      baseUrl,
      'DELETE',
      `/api/v1/products/${deleteTargetForAdmin._id}`,
      { token: adminLogin.data.token }
    );
    report.tests.deleteAuthorization = {
      normalUser: {
        status: normalDeleteAttempt.status,
        message: normalDeleteAttempt.data.message
      },
      adminUser: {
        status: adminDeleteAttempt.status
      }
    };

    const forgotPasswordSignup = await signup(baseUrl, {
      name: 'Forgot Password User',
      email: `forgot${nowId}@example.com`,
      password: 'Password123',
      passwordConfirm: 'Password123'
    });

    const forgotPasswordResponse = await request(baseUrl, 'POST', '/api/v1/users/forgotPassword', {
      body: { email: `forgot${nowId}@example.com` }
    });

    const emailLog = JSON.parse(fs.readFileSync(emailLogPath, 'utf-8'));
    report.meta.emailTransport = emailLog.transport;
    const resetTokenMatch = emailLog.message.match(/resetPassword\/([a-f0-9]+)\b/i);
    const resetToken = resetTokenMatch ? resetTokenMatch[1] : null;

    const resetResponse = await request(
      baseUrl,
      'PATCH',
      `/api/v1/users/resetPassword/${resetToken}`,
      {
        body: {
          password: 'NewPassword123',
          passwordConfirm: 'NewPassword123'
        }
      }
    );
    report.tests.forgotPassword = {
      forgotResponse: {
        status: forgotPasswordResponse.status,
        message: forgotPasswordResponse.data.message
      },
      resetToken,
      emailSubject: emailLog.subject,
      emailMessage: emailLog.message,
      resetResponse: {
        status: resetResponse.status
      }
    };

    const updatePasswordSignup = await signup(baseUrl, {
      name: 'Update Password User',
      email: `updatepass${nowId}@example.com`,
      password: 'Password123',
      passwordConfirm: 'Password123'
    });
    const updatePasswordResponse = await request(
      baseUrl,
      'PATCH',
      '/api/v1/users/updateMyPassword',
      {
        token: updatePasswordSignup.data.token,
        body: {
          currentPassword: 'Password123',
          password: 'BetterPassword123',
          passwordConfirm: 'BetterPassword123'
        }
      }
    );
    const oldPasswordLogin = await login(baseUrl, {
      email: `updatepass${nowId}@example.com`,
      password: 'Password123'
    });
    const newPasswordLogin = await login(baseUrl, {
      email: `updatepass${nowId}@example.com`,
      password: 'BetterPassword123'
    });
    report.tests.updateMyPassword = {
      updateResponse: {
        status: updatePasswordResponse.status
      },
      oldPasswordLoginStatus: oldPasswordLogin.status,
      newPasswordLoginStatus: newPasswordLogin.status
    };

    const updateMeSignup = await signup(baseUrl, {
      name: 'Update Me User',
      email: `updateme${nowId}@example.com`,
      password: 'Password123',
      passwordConfirm: 'Password123'
    });
    const updateMeResponse = await request(baseUrl, 'PATCH', '/api/v1/users/updateMe', {
      token: updateMeSignup.data.token,
      body: {
        name: 'Updated Session User'
      }
    });
    report.tests.updateMe = {
      status: updateMeResponse.status,
      updatedName: updateMeResponse.data.data.user.name
    };

    const deleteMeSignup = await signup(baseUrl, {
      name: 'Delete Me User',
      email: `deleteme${nowId}@example.com`,
      password: 'Password123',
      passwordConfirm: 'Password123'
    });
    const deleteMeResponse = await request(baseUrl, 'DELETE', '/api/v1/users/deleteMe', {
      token: deleteMeSignup.data.token
    });
    const deletedSessionTokenResponse = await request(baseUrl, 'GET', '/api/v1/products', {
      token: deleteMeSignup.data.token
    });
    report.tests.deleteMe = {
      deleteResponse: {
        status: deleteMeResponse.status
      },
      oldTokenAfterDelete: {
        status: deletedSessionTokenResponse.status,
        message: deletedSessionTokenResponse.data.message
      }
    };

    const cookieSignup = await signup(baseUrl, {
      name: 'Cookie User',
      email: `cookie${nowId}@example.com`,
      password: 'Password123',
      passwordConfirm: 'Password123'
    });
    report.tests.cookieStorage = {
      status: cookieSignup.status,
      setCookie: cookieSignup.setCookie.join('; ')
    };

    const headerResponse = await request(baseUrl, 'GET', '/api/v1/products', {
      token: normalToken
    });
    report.tests.headers = {
      rateLimitHeaders: {
        'ratelimit-limit': headerResponse.headers['ratelimit-limit'],
        'ratelimit-remaining': headerResponse.headers['ratelimit-remaining'],
        'ratelimit-reset': headerResponse.headers['ratelimit-reset']
      },
      helmetHeaders: {
        'content-security-policy': headerResponse.headers['content-security-policy'],
        'x-frame-options': headerResponse.headers['x-frame-options'],
        'x-dns-prefetch-control': headerResponse.headers['x-dns-prefetch-control']
      }
    };

    const sanitizeSignup = await signup(baseUrl, {
      name: '<script>alert("xss")</script>Clean User',
      email: `sanitize${nowId}@example.com`,
      password: 'Password123',
      passwordConfirm: 'Password123'
    });
    report.tests.sanitization = {
      status: sanitizeSignup.status,
      savedName: sanitizeSignup.data.data.user.name
    };

    const hppResponse = await request(baseUrl, 'GET', '/api/v1/products?sort=price&sort=name', {
      token: normalToken
    });
    report.tests.hpp = {
      status: hppResponse.status,
      firstProductName: hppResponse.data?.data?.products?.[0]?.name || null
    };

    fs.writeFileSync(jsonOutPath, JSON.stringify(report, null, 2));
    fs.writeFileSync(markdownOutPath, buildMarkdown(report));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }

    if (mongod) {
      await mongod.stop();
    }
  }
};

run().catch(error => {
  console.error(error);
  process.exit(1);
});
