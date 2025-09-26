// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/index';

export interface AuthRequest extends Request {
  user?: IUser;
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ 
        success: false, 
        message: 'Access token is missing' 
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid token - user not found' 
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    } else {
      console.error('Auth middleware error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error during authentication' 
      });
    }
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
      return;
    }

    console.log('User role:', req.user.role, 'Required roles:', roles); // Debug log

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ 
        success: false, 
        message: `Insufficient permissions. User role: ${req.user.role}, Required: ${roles.join(', ')}` 
      });
      return;
    }

    next();
  };
};

// Convenience middleware for admin-only routes
export const requireAdmin = requireRole(['admin']);

// Convenience middleware for delivery partner routes
export const requireDeliveryPartner = requireRole(['delivery_partner']);