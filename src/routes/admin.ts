// src/routes/admin.ts
import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { User, Order, DeliveryPartner } from '../models/index';
import { AuthRequest, authenticateToken, requireAdmin } from '../middleware/auth';
import { 
  validateCreateOrder, 
  validateAssignOrder, 
  validateCreatePartner,
  validateMongoId 
} from '../middleware/validation';

const router = Router();

// Apply authentication and admin role check to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// ============= ORDER MANAGEMENT =============

// GET /api/orders - Get all orders
router.get('/orders', async (req: AuthRequest, res: Response) => {
  try {
    const orders = await Order.find()
      .populate('assignedTo', 'name contactNumber availabilityStatus')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        orders,
        count: orders.length
      }
    });

  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching orders'
    });
  }
});

// POST /api/orders - Create new order
router.post('/orders', validateCreateOrder, async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, itemName, customerName, deliveryLocation } = req.body;

    // Check if order ID already exists
    const existingOrder = await Order.findOne({ orderId });
    if (existingOrder) {
      res.status(400).json({
        success: false,
        message: 'Order with this ID already exists'
      });
      return;
    }

    const newOrder = new Order({
      orderId,
      itemName,
      customerName,
      deliveryLocation,
      status: 'pending'
    });

    await newOrder.save();

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order: newOrder }
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating order'
    });
  }
});

// GET /api/orders/:id - Get single order
router.get('/orders/:id', validateMongoId, async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('assignedTo', 'name contactNumber availabilityStatus currentLocation');

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    res.json({
      success: true,
      data: { order }
    });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching order'
    });
  }
});

// PUT /api/orders/:id/assign - Assign order to delivery partner
router.put('/orders/:id/assign', validateAssignOrder, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { partnerId } = req.body;

    // Check if order exists
    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    // Check if partner exists and is available
    const partner = await DeliveryPartner.findById(partnerId);
    if (!partner) {
      res.status(404).json({
        success: false,
        message: 'Delivery partner not found'
      });
      return;
    }

    if (partner.availabilityStatus !== 'available') {
      res.status(400).json({
        success: false,
        message: 'Partner is not available for assignment'
      });
      return;
    }

    // Assign order
    order.assignedTo = new mongoose.Types.ObjectId(partnerId);
    order.status = 'assigned';
    await order.save();

    // Populate the assigned partner info
    await order.populate('assignedTo', 'name contactNumber');

    res.json({
      success: true,
      message: 'Order assigned successfully',
      data: { order }
    });

  } catch (error) {
    console.error('Assign order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error assigning order'
    });
  }
});

// ============= PARTNER MANAGEMENT =============

// GET /api/partners - Get all delivery partners
router.get('/partners', async (req: AuthRequest, res: Response) => {
  try {
    const partners = await DeliveryPartner.find()
      .populate('userId', 'email')
      .sort({ createdAt: -1 });

    // Get order counts for each partner
    const partnersWithStats = await Promise.all(
      partners.map(async (partner) => {
        const orderCount = await Order.countDocuments({ assignedTo: partner._id });
        const activeOrders = await Order.countDocuments({ 
          assignedTo: partner._id, 
          status: { $in: ['assigned', 'picked_up'] }
        });
        
        return {
          ...partner.toObject(),
          stats: {
            totalOrders: orderCount,
            activeOrders
          }
        };
      })
    );

    res.json({
      success: true,
      data: {
        partners: partnersWithStats,
        count: partners.length
      }
    });

  } catch (error) {
    console.error('Get partners error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching partners'
    });
  }
});

// POST /api/partners - Create new delivery partner
router.post('/partners', validateCreatePartner, async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, contactNumber, currentLocation } = req.body;

    // Check if user with email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
      return;
    }

    // Create user account
    const user = new User({
      email,
      password,
      role: 'delivery_partner'
    });

    await user.save();

    // Create delivery partner profile
    const partner = new DeliveryPartner({
      name,
      userId: user._id,
      contactNumber,
      currentLocation,
      availabilityStatus: 'available'
    });

    await partner.save();

    // Populate user info
    await partner.populate('userId', 'email');

    res.status(201).json({
      success: true,
      message: 'Delivery partner created successfully',
      data: { partner }
    });

  } catch (error) {
    console.error('Create partner error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating partner'
    });
  }
});

// GET /api/partners/:id - Get single partner with detailed stats
router.get('/partners/:id', validateMongoId, async (req: AuthRequest, res: Response) => {
  try {
    const partner = await DeliveryPartner.findById(req.params.id)
      .populate('userId', 'email');

    if (!partner) {
      res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
      return;
    }

    // Get partner's order history
    const orders = await Order.find({ assignedTo: partner._id })
      .sort({ createdAt: -1 })
      .limit(10);

    const stats = {
      totalOrders: await Order.countDocuments({ assignedTo: partner._id }),
      completedOrders: await Order.countDocuments({ 
        assignedTo: partner._id, 
        status: 'delivered' 
      }),
      activeOrders: await Order.countDocuments({ 
        assignedTo: partner._id, 
        status: { $in: ['assigned', 'picked_up'] }
      })
    };

    res.json({
      success: true,
      data: {
        partner,
        recentOrders: orders,
        stats
      }
    });

  } catch (error) {
    console.error('Get partner error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching partner'
    });
  }
});

export default router;