const mongoose = require('mongoose');
const slugify = require('slugify');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A product must have a name'],
      unique: true,
      trim: true
    },
    price: {
      type: Number,
      required: [true, 'A product must have a price']
    },
    category: {
      type: String,
      required: [true, 'A product must have a category']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [50, 'Description must not exceed 50 characters']
    },
    seller: String,
    summary: String,
    ratingsAverage: {
      type: Number,
      default: 4.5
    },
    postedDate: {
      type: Date,
      default: Date.now
    },
    productSlug: String,
    premiumProducts: {
      type: Boolean,
      default: false
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function(val) {
          if (val == null) return true;

          const currentPrice =
            this.price ??
            this.get?.('price') ??
            this._update?.price ??
            this._update?.$set?.price;

          if (currentPrice == null) return true;
          return val < currentPrice;
        },
        message: 'Discount price {VALUE} should be below regular price'
      }
    },
    createdAt: {
      type: Date,
      default: Date.now,
      select: false
    }
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    timestamps: true
  }
);

productSchema.virtual('daysPosted').get(function() {
  if (!this.postedDate) return 0;
  const diffTime = Date.now() - this.postedDate.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
});

productSchema.pre('save', function() {
  if (this.isModified('name')) {
    this.productSlug = slugify(this.name, { lower: false }).toUpperCase();
  }
});

productSchema.pre(/^find/, function() {
  this.where({ premiumProducts: { $ne: true } });
});

productSchema.pre('aggregate', function() {
  const pipeline = this.pipeline();
  if (pipeline.length > 0 && pipeline[0].$geoNear) {
    pipeline.splice(1, 0, { $match: { premiumProducts: { $ne: true } } });
  } else {
    pipeline.unshift({ $match: { premiumProducts: { $ne: true } } });
  }
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
