// src/routes/partner.ts
import { Router, Response } from 'express';
import { Order, DeliveryPartner } from '../models/index';
import { AuthRequest, authenticateToken, requireDeliveryPartner } from '../middleware/auth';
import { validateUpdateOrderStatus, validateUpdatePartnerStatus } from '../middleware/validation';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Debug route to check authentication (remove in production)
router.get('/debug-auth', (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    user: req.user ? {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role
    } : null,
    message: req.user ? 'User authenticated' : 'No user found'
  });
});

// ============= PARTNER ORDERS =============

// GET /api/partner/orders - Get orders assigned to logged-in partner
router.get('/orders', requireDeliveryPartner, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Find the partner record for this user
    const partner = await DeliveryPartner.findOne({ userId: req.user._id });
    if (!partner) {
      res.status(404).json({
        success: false,
        message: 'Partner profile not found'
      });
      return;
    }

    // Get query parameters for filtering
    const { status } = req.query;
    const filter: any = { assignedTo: partner._id };
    
    if (status && typeof status === 'string') {
      filter.status = status;
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        orders,
        count: orders.length,
        partnerId: partner._id
      }
    });

  } catch (error) {
    console.error('Get partner orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching orders'
    });
  }
});

// GET /api/partner/orders/active - Get only active orders (assigned, picked_up)
router.get('/orders/active', requireDeliveryPartner, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const partner = await DeliveryPartner.findOne({ userId: req.user._id });
    if (!partner) {
      res.status(404).json({
        success: false,
        message: 'Partner profile not found'
      });
      return;
    }

    const orders = await Order.find({
      assignedTo: partner._id,
      status: { $in: ['assigned', 'picked_up'] }
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        orders,
        count: orders.length
      }
    });

  } catch (error) {
    console.error('Get active orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching active orders'
    });
  }
});

// PUT /api/orders/:id/status - Update order status
router.put('/orders/:id/status', requireDeliveryPartner, validateUpdateOrderStatus, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Find the partner record
    const partner = await DeliveryPartner.findOne({ userId: req.user._id });
    if (!partner) {
      res.status(404).json({
        success: false,
        message: 'Partner profile not found'
      });
      return;
    }

    // Find the order and verify it's assigned to this partner
    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    if (!order.assignedTo || !order.assignedTo.equals(partner._id)) {
      res.status(403).json({
        success: false,
        message: 'This order is not assigned to you'
      });
      return;
    }

    // Validate status transition
    const validTransitions: { [key: string]: string[] } = {
      assigned: ['picked_up'],
      picked_up: ['delivered']
    };

    if (!validTransitions[order.status] || !validTransitions[order.status].includes(status)) {
      res.status(400).json({
        success: false,
        message: `Cannot change status from ${order.status} to ${status}`
      });
      return;
    }

    // Update the order status
    order.status = status as 'pending' | 'assigned' | 'picked_up' | 'delivered';
    await order.save();

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      data: { order }
    });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating order status'
    });
  }
});

// ============= PARTNER STATUS =============

// PUT /api/partner/status - Update partner availability status
router.put('/status', requireDeliveryPartner, validateUpdatePartnerStatus, async (req: AuthRequest, res: Response) => {
  try {
    const { availabilityStatus } = req.body;

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const partner = await DeliveryPartner.findOne({ userId: req.user._id });
    if (!partner) {
      res.status(404).json({
        success: false,
        message: 'Partner profile not found'
      });
      return;
    }

    // Check if partner has active orders when trying to go unavailable
    if (availabilityStatus === 'unavailable') {
      const activeOrders = await Order.countDocuments({
        assignedTo: partner._id,
        status: { $in: ['assigned', 'picked_up'] }
      });

      if (activeOrders > 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot set status to unavailable while you have active orders'
        });
        return;
      }
    }

    partner.availabilityStatus = availabilityStatus;
    await partner.save();

    res.json({
      success: true,
      message: `Status updated to ${availabilityStatus}`,
      data: {
        partner: {
          id: partner._id,
          name: partner.name,
          availabilityStatus: partner.availabilityStatus
        }
      }
    });

  } catch (error) {
    console.error('Update partner status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating status'
    });
  }
});

// GET /api/partner/profile - Get partner profile with stats
router.get('/profile', requireDeliveryPartner, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const partner = await DeliveryPartner.findOne({ userId: req.user._id })
      .populate('userId', 'email');

    if (!partner) {
      res.status(404).json({
        success: false,
        message: 'Partner profile not found'
      });
      return;
    }

    // Get partner statistics
    const stats = {
      totalOrders: await Order.countDocuments({ assignedTo: partner._id }),
      completedOrders: await Order.countDocuments({ 
        assignedTo: partner._id, 
        status: 'delivered' 
      }),
      activeOrders: await Order.countDocuments({ 
        assignedTo: partner._id, 
        status: { $in: ['assigned', 'picked_up'] }
      }),
      pickedUpOrders: await Order.countDocuments({ 
        assignedTo: partner._id, 
        status: 'picked_up' 
      })
    };

    res.json({
      success: true,
      data: {
        partner,
        stats
      }
    });

  } catch (error) {
    console.error('Get partner profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching profile'
    });
  }
});

// PUT /api/partner/location - Update current location
router.put('/location', requireDeliveryPartner, async (req: AuthRequest, res: Response) => {
  try {
    const { latitude, longitude } = req.body;

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Validate coordinates
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      res.status(400).json({
        success: false,
        message: 'Valid latitude and longitude are required'
      });
      return;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
      return;
    }

    const partner = await DeliveryPartner.findOne({ userId: req.user._id });
    if (!partner) {
      res.status(404).json({
        success: false,
        message: 'Partner profile not found'
      });
      return;
    }

    partner.currentLocation = { latitude, longitude };
    await partner.save();

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        currentLocation: partner.currentLocation
      }
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating location'
    });
  }
});

export default router;