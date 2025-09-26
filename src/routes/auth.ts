// src/routes/auth.ts
import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User, DeliveryPartner } from '../models/index';
import { validateLogin, validateRegister } from '../middleware/validation';
import { AuthRequest, authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

const generateToken = (userId: string): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined');
  }

  return jwt.sign(
    { id: userId },   // only userId
    jwtSecret,
    { expiresIn: '1h' }
  );
};


// POST /api/auth/login
router.post('/login', validateLogin, async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Generate token
    const token = generateToken(user._id.toString());

    // Get additional info for delivery partners
    let partnerInfo = null;
    if (user.role === 'delivery_partner') {
      partnerInfo = await DeliveryPartner.findOne({ userId: user._id });
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role
        },
        partnerInfo: partnerInfo ? {
          id: partnerInfo._id,
          name: partnerInfo.name,
          contactNumber: partnerInfo.contactNumber,
          availabilityStatus: partnerInfo.availabilityStatus
        } : null
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// POST /api/auth/register - Admin only (to register delivery partners)
router.post('/register', 
  // authenticateToken, 
  // requireAdmin,
  validateRegister, 
  async (req: AuthRequest, res: Response) => {
    try {
      const { email, password, role } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
        return;
      }

      // Create new user
      const newUser = new User({
        email,
        password,
        role
      });

      await newUser.save();

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: newUser._id,
            email: newUser.email,
            role: newUser.role
          }
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during registration'
      });
    }
  }
);

// GET /api/auth/me - Get current user info
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Get additional info for delivery partners
    let partnerInfo = null;
    if (req.user.role === 'delivery_partner') {
      partnerInfo = await DeliveryPartner.findOne({ userId: req.user._id });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        partnerInfo: partnerInfo ? {
          id: partnerInfo._id,
          name: partnerInfo.name,
          contactNumber: partnerInfo.contactNumber,
          availabilityStatus: partnerInfo.availabilityStatus,
          currentLocation: partnerInfo.currentLocation
        } : null
      }
    });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting user information'
    });
  }
});

export default router;