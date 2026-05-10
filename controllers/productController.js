const Product = require('../models/productModel');
const replaceTemplate = require('../modules/replaceTemplate');
const fs = require('fs');
const path = require('path');

const tempOverview = fs.readFileSync(`${__dirname}/../public/template-overview.html`, 'utf-8');
const tempCard = fs.readFileSync(`${__dirname}/../public/template-card.html`, 'utf-8');
const tempItem = fs.readFileSync(`${__dirname}/../public/template-item.html`, 'utf-8');
const seedProductsPath = path.join(__dirname, '../data/products.json');

const getSeedProducts = () => JSON.parse(fs.readFileSync(seedProductsPath, 'utf-8'));

const getSeedProductById = id => getSeedProducts().find(product => String(product.id) === String(id));

const getProductsOrSeed = async query => {
  const products = await query;
  return products.length > 0 ? products : getSeedProducts();
};

exports.checkID = async (req, res, next, val) => {
  try {
    const product = await Product.findById(val);
    if (product) {
      req.product = product;
      return next();
    }

    const seedProduct = getSeedProductById(val);
    if (!seedProduct) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found'
      });
    }

    req.product = seedProduct;
    next();
  } catch (error) {
    const seedProduct = getSeedProductById(val);
    if (seedProduct) {
      req.product = seedProduct;
      return next();
    }

    return res.status(400).json({
      status: 'fail',
      message: 'Invalid product ID'
    });
  }
};

exports.checkBody = (req, res, next) => {
  console.log('Request body:', req.body);
  console.log('Content-Type:', req.headers['content-type']);

  // Check if body was parsed
  if (!req.body) {
    return res.status(400).json({
      status: 'fail',
      message: 'Request body is missing. Make sure to set Content-Type: application/json and send valid JSON.'
    });
  }

  // Check for required fields
  if (!req.body.name || !req.body.price) {
    return res.status(400).json({
      status: 'fail',
      message: 'Missing required fields: name and price are required'
    });
  }
  next();
};

// Template/Page Handlers
exports.getHomePage = (req, res) => {
  res.status(200).sendFile(`${__dirname}/../public/index.html`);
};

exports.getOverviewPage = async (req, res) => {
  try {
    const products = await getProductsOrSeed(Product.find());
    const cardsHtml = products.map(el => replaceTemplate(tempCard, el)).join('');
    const output = tempOverview.replace('{%PRODUCT_CARDS%}', cardsHtml);
    res.status(200).set('Content-Type', 'text/html');
    res.send(output);
  } catch (err) {
    console.error('ERROR 💥:', err);
    const products = getSeedProducts();
    const cardsHtml = products.map(el => replaceTemplate(tempCard, el)).join('');
    const output = tempOverview.replace('{%PRODUCT_CARDS%}', cardsHtml);
    res.status(200).set('Content-Type', 'text/html');
    res.send(output);
  }
};

exports.getItemPage = async (req, res) => {
  const id = req.query.id;
  const format = req.query.format;

  try {
    const product = await Product.findById(id) || getSeedProductById(id);

    if (!product) {
      if (format === 'json') {
        res.status(404).set('Content-Type', 'application/json');
        res.send(JSON.stringify({ status: 'fail', message: 'Product not found' }));
      } else {
        res.status(404).set('Content-Type', 'text/html');
        res.send('<h1>Product not found</h1>');
      }
      return;
    }

    if (format === 'json') {
      res.status(200).set('Content-Type', 'application/json');
      res.send(JSON.stringify({ status: 'success', data: { product } }));
    } else {
      res.status(200).set('Content-Type', 'text/html');
      const output = replaceTemplate(tempItem, product);
      res.send(output);
    }
  } catch (error) {
    const product = getSeedProductById(id);

    if (product) {
      if (format === 'json') {
        res.status(200).set('Content-Type', 'application/json');
        res.send(JSON.stringify({ status: 'success', data: { product } }));
      } else {
        res.status(200).set('Content-Type', 'text/html');
        const output = replaceTemplate(tempItem, product);
        res.send(output);
      }
    } else {
      if (format === 'json') {
        res.status(400).set('Content-Type', 'application/json');
        res.send(JSON.stringify({ status: 'fail', message: 'Invalid product ID' }));
      } else {
        res.status(400).set('Content-Type', 'text/html');
        res.send('<h1>Invalid product ID</h1>');
      }
    }
  }
};

exports.getAPIData = async (req, res) => {
  try {
    const products = await getProductsOrSeed(Product.find());
    res.status(200).json({
      status: 'success',
      results: products.length,
      data: {
        products
      }
    });
  } catch (error) {
    const products = getSeedProducts();
    res.status(200).json({
      status: 'success',
      results: products.length,
      data: {
        products
      }
    });
  }
};

// API Handlers
exports.getAllProducts = async (req, res) => {
  try {
    const getQueryValue = value => (Array.isArray(value) ? value[0] : value);

    // BUILD QUERY
    // 1A) Filtering
    const queryObj = { ...req.query };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(el => delete queryObj[el]);

    // 1B) Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);
    let query = Product.find(JSON.parse(queryStr));

    // 2) Sorting
    const sortQuery = getQueryValue(req.query.sort);
    if (sortQuery) {
      const sortBy = sortQuery.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // 3) Field limiting
    const fieldsQuery = getQueryValue(req.query.fields);
    if (fieldsQuery) {
      const fields = fieldsQuery.split(',').join(' ');
      query = query.select(fields);
    } else {
      query = query.select('-__v');
    }

    // 4) Pagination
    const page = getQueryValue(req.query.page) * 1 || 1;
    const limit = getQueryValue(req.query.limit) * 1 || 100;
    const skip = (page - 1) * limit;
    query = query.skip(skip).limit(limit);

    if (req.query.page) {
      const numProducts = await Product.countDocuments();
      if (skip >= numProducts) throw new Error('This page does not exist');
    }

    // EXECUTE QUERY
    const products = await getProductsOrSeed(query);

    // SEND RESPONSE
    res.status(200).json({
      status: 'success',
      results: products.length,
      data: {
        products
      }
    });
  } catch (error) {
    console.error('Database error in getAllProducts:', error);
    const products = getSeedProducts();
    res.status(200).json({
      status: 'success',
      results: products.length,
      data: {
        products
      }
    });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const product = req.product;
    res.status(200).json({
      status: 'success',
      data: {
        product
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch product'
    });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const newProduct = await Product.create(req.body);
    res.status(201).json({
      status: 'success',
      data: {
        product: newProduct
      }
    });
  } catch (error) {
    console.error('Database error in createProduct:', error);
    if (error.name === 'ValidationError') {
      res.status(400).json({
        status: 'fail',
        message: error.message
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Database connection failed. Please check your MongoDB Atlas configuration.'
      });
    }
  }
};

exports.updateProduct = async (req, res) => {
  try {
    console.log('PATCH request received:');
    console.log('ID:', req.params.id);
    console.log('Body:', req.body);
    console.log('Content-Type:', req.headers['content-type']);

    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
      context: 'query',
      returnDocument: 'after'
    });

    if (!product) {
      console.log('Product not found with ID:', req.params.id);
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found'
      });
    }

    console.log('Product updated successfully:', product.name);
    res.status(200).json({
      status: 'success',
      data: {
        product
      }
    });
  } catch (error) {
    console.error('Error in updateProduct:', error);
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};

exports.getTopCheapest = async (req, res) => {
  try {
    const products = await Product.aggregate([
      {
        $sort: { price: 1 }
      },
      {
        $limit: 3
      },
      {
        $project: {
          productName: '$name',
          cost: '$price',
          category: 1,
          description: 1,
          seller: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ]);

    res.status(200).json({
      status: 'success',
      results: products.length,
      data: {
        products
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch top cheapest products'
    });
  }
};

exports.getProductStats = async (req, res) => {
  try {
    const productCategories = await Product.aggregate([
      {
        $match: { price: { $lt: 1000 } }
      },
      {
        $group: {
          _id: { $toUpper: '$category' },
          totalProducts: { $sum: 1 },
          products: {
            $push: {
              name: '$name',
              price: '$price',
              productSlug: '$productSlug',
              postedDate: '$postedDate'
            }
          },
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        }
      },
      {
        $addFields: {
          averagePrice: { $round: ['$avgPrice', 2] },
          minimumPrice: '$minPrice',
          maximumPrice: '$maxPrice'
        }
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          totalProducts: 1,
          products: 1,
          averagePrice: 1,
          minimumPrice: 1,
          maximumPrice: 1
        }
      },
      {
        $sort: { averagePrice: 1 }
      }
    ]);

    res.status(200).json({
      status: 'success',
      results: productCategories.length,
      data: {
        productCategories
      }
    });
  } catch (error) {
    res.status(404).json({
      status: 'fail',
      message: error.message
    });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found'
      });
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};

exports.aliasTopCheap = (req, res, next) => {
  // Preset the query parameters
  req.query.limit = '3';
  req.query.sort = 'price'; // Ascending order for "cheap"
  req.query.fields = 'name,price,ratingsAverage,summary'; // Optional: limit fields
  next();
};
