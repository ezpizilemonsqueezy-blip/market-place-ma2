const http = require('http');

const baseUrl = 'http://localhost:3000';

const request = (method, path, data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            data: JSON.parse(body)
          };
          resolve(response);
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

const triggerForgotPassword = async () => {
  try {
    console.log('Triggering forgot password for admin user...');

    const response = await request('POST', '/api/v1/users/forgotPassword', {
      email: 'admin1776499715680@example.com'
    });

    console.log('Response status:', response.status);
    console.log('Response data:', response.data);

    if (response.status === 200) {
      console.log('✅ Password reset email sent successfully!');
      console.log('📧 Check your Mailtrap inbox for the reset email.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

triggerForgotPassword();