const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const emailLogDir = path.join(__dirname, '..', 'logs', 'emails');

const createTransport = () => {
  if (process.env.EMAIL_HOST && process.env.EMAIL_PORT) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  return nodemailer.createTransport({
    jsonTransport: true
  });
};

exports.sendEmail = async options => {
  const transport = createTransport();
  const info = await transport.sendMail({
    from: process.env.EMAIL_FROM || 'marketplace@example.com',
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html
  });

  fs.mkdirSync(emailLogDir, { recursive: true });
  fs.writeFileSync(
    path.join(emailLogDir, 'latest-email.json'),
    JSON.stringify(
      {
        to: options.email,
        subject: options.subject,
        message: options.message,
        html: options.html || null,
        transport: process.env.EMAIL_HOST ? 'mailtrap' : 'json',
        info
      },
      null,
      2
    )
  );

  return info;
};
