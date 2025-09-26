// src/models/index.ts
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Location interface for reuse
export interface ILocation {
  latitude: number;
  longitude: number;
  address?: string;
}

// User Model
export interface IUser extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  role: 'admin' | 'delivery_partner';
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new mongoose.Schema<IUser>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'delivery_partner'],
    required: [true, 'Role is required']
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', userSchema);

// Delivery Partner Model
export interface IDeliveryPartner extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  userId: mongoose.Types.ObjectId;
  contactNumber: string;
  currentLocation: ILocation;
  availabilityStatus: 'available' | 'unavailable';
}

const deliveryPartnerSchema = new mongoose.Schema<IDeliveryPartner>({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true
  },
  contactNumber: {
    type: String,
    required: [true, 'Contact number is required'],
    trim: true
  },
  currentLocation: {
    latitude: {
      type: Number,
      required: [true, 'Latitude is required']
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required']
    }
  },
  availabilityStatus: {
    type: String,
    enum: ['available', 'unavailable'],
    default: 'available'
  }
}, {
  timestamps: true
});

export const DeliveryPartner = mongoose.model<IDeliveryPartner>('DeliveryPartner', deliveryPartnerSchema);

// Order Model
export interface IOrder extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  orderId: string;
  itemName: string;
  customerName: string;
  deliveryLocation: ILocation;
  status: 'pending' | 'assigned' | 'picked_up' | 'delivered';
  assignedTo?: mongoose.Types.ObjectId;
}

const orderSchema = new mongoose.Schema<IOrder>({
  orderId: {
    type: String,
    required: [true, 'Order ID is required'],
    unique: true,
    trim: true
  },
  itemName: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true
  },
  customerName: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true
  },
  deliveryLocation: {
    latitude: {
      type: Number,
      required: [true, 'Delivery latitude is required']
    },
    longitude: {
      type: Number,
      required: [true, 'Delivery longitude is required']
    },
    address: {
      type: String,
      trim: true
    }
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'picked_up', 'delivered'],
    default: 'pending'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryPartner',
    default: null
  }
}, {
  timestamps: true
});

export const Order = mongoose.model<IOrder>('Order', orderSchema);