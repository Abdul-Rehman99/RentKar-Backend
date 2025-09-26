// src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
    return;
  }
  next();
};

// Auth validations
export const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  handleValidationErrors
];

export const validateRegister = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .isIn(['admin', 'delivery_partner'])
    .withMessage('Role must be either admin or delivery_partner'),
  handleValidationErrors
];

// Order validations
export const validateCreateOrder = [
  body('orderId')
    .notEmpty()
    .withMessage('Order ID is required')
    .trim(),
  body('itemName')
    .notEmpty()
    .withMessage('Item name is required')
    .trim(),
  body('customerName')
    .notEmpty()
    .withMessage('Customer name is required')
    .trim(),
  body('deliveryLocation.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('deliveryLocation.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('deliveryLocation.address')
    .optional()
    .trim(),
  handleValidationErrors
];

export const validateAssignOrder = [
  param('id')
    .isMongoId()
    .withMessage('Invalid order ID'),
  body('partnerId')
    .isMongoId()
    .withMessage('Invalid partner ID'),
  handleValidationErrors
];

// Partner validations
export const validateCreatePartner = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .trim(),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('contactNumber')
    .notEmpty()
    .withMessage('Contact number is required')
    .trim(),
  body('currentLocation.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('currentLocation.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  handleValidationErrors
];

export const validateUpdateOrderStatus = [
  param('id')
    .isMongoId()
    .withMessage('Invalid order ID'),
  body('status')
    .isIn(['pending', 'assigned', 'picked_up', 'delivered'])
    .withMessage('Invalid status value'),
  handleValidationErrors
];

export const validateUpdatePartnerStatus = [
  body('availabilityStatus')
    .isIn(['available', 'unavailable'])
    .withMessage('Status must be either available or unavailable'),
  handleValidationErrors
];

export const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  handleValidationErrors
];