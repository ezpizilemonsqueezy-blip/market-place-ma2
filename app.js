const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const { clean: cleanXss } = require('xss-clean/lib/xss');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const productController = require('./controllers/productController');
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

const mongoSanitizeMiddleware = (req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  if (req.headers) mongoSanitize.sanitize(req.headers);
  if (req.query) mongoSanitize.sanitize(req.query);
  next();
};

const xssCleanMiddleware = (req, res, next) => {
  if (req.body) req.body = cleanXss(req.body);
  if (req.params) req.params = cleanXss(req.params);
  if (req.query) cleanXss(req.query);
  next();
};

// 1) MIDDLEWARES
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(helmet());
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(mongoSanitizeMiddleware);
app.use(xssCleanMiddleware);
app.use(
  hpp({
    whitelist: ['fields']
  })
);
app.use(express.static(`${__dirname}/public`));

const limiter = rateLimit({
  max: Number(process.env.RATE_LIMIT_MAX || 100),
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', limiter);

// 2) ROUTES
// Template/Page Routes
app
  .route('/')
  .get(productController.getHomePage);

app
  .route('/overview')
  .get(productController.getOverviewPage);

app
  .route('/item')
  .get(productController.getItemPage);

// API Routes
app
  .route('/api')
  .get(productController.getAPIData);

app.use(['/api/v1/products', '/api/v1/product'], productRoutes);
app.use('/api/v1/users', userRoutes);

app.use((req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server`
  });
});

module.exports = app;


