import { prisma } from '../utils/prisma.js';
import { errorResponse } from '../utils/response.js';

/**
 * Reusable Customer Ownership and IDOR prevention middleware
 *
 * @param {'customer' | 'invoice' | 'quotation' | 'subscription' | 'payment'} resourceType
 * @param {string} paramKey - URL parameter containing the resource ID (default: 'id')
 */
export function authorizeOwnership(resourceType, paramKey = 'id') {
  return async (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, {
        message: 'Authentication required',
        statusCode: 401
      });
    }

    // ADMINs bypass ownership checks across all resources
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // STAFF have operational access to customer, invoice, subscription, and payment records
    if (req.user.role === 'STAFF') {
      return next();
    }

    // For CUSTOMER role, verify actual database ownership
    if (req.user.role === 'CUSTOMER') {
      const customerId = req.user.customerId;
      if (!customerId) {
        return errorResponse(res, {
          message: 'Access denied: no customer profile linked to this user account',
          statusCode: 403
        });
      }

      const resourceId = req.params[paramKey];
      if (!resourceId) {
        return errorResponse(res, {
          message: 'Resource identifier is required',
          statusCode: 400
        });
      }

      try {
        switch (resourceType) {
          case 'customer': {
            if (resourceId !== customerId) {
              return errorResponse(res, {
                message: 'Access denied: you do not have permission to access another customer profile',
                statusCode: 403
              });
            }
            return next();
          }

          case 'invoice': {
            const invoice = await prisma.invoice.findUnique({
              where: { id: resourceId },
              select: { id: true, customerId: true }
            });

            if (!invoice) {
              return errorResponse(res, {
                message: 'Invoice not found',
                statusCode: 404
              });
            }

            if (invoice.customerId !== customerId) {
              return errorResponse(res, {
                message: 'Access denied: you do not own this invoice',
                statusCode: 403
              });
            }

            req.resource = invoice;
            return next();
          }

                    case 'quotation': {
            const quotation = await prisma.quotation.findUnique({
              where: { id: resourceId },
              select: { id: true, customerId: true }
            });

            if (!quotation) {
              return errorResponse(res, {
                message: 'Quotation not found',
                statusCode: 404
              });
            }

            if (quotation.customerId !== customerId) {
              return errorResponse(res, {
                message: 'Access denied: you do not own this quotation',
                statusCode: 403
              });
            }

            req.resource = quotation;
            return next();
          }

          case 'subscription': {
            const subscription = await prisma.subscription.findUnique({
              where: { id: resourceId },
              select: { id: true, customerId: true }
            });

            if (!subscription) {
              return errorResponse(res, {
                message: 'Subscription not found',
                statusCode: 404
              });
            }

            if (subscription.customerId !== customerId) {
              return errorResponse(res, {
                message: 'Access denied: you do not own this subscription',
                statusCode: 403
              });
            }

            req.resource = subscription;
            return next();
          }

          case 'payment': {
            const payment = await prisma.payment.findUnique({
              where: { id: resourceId },
              select: {
                id: true,
                customerId: true,
                invoice: {
                  select: { customerId: true }
                }
              }
            });

            if (!payment) {
              return errorResponse(res, {
                message: 'Payment not found',
                statusCode: 404
              });
            }

            const ownerId = payment.customerId || payment.invoice?.customerId;
            if (ownerId !== customerId) {
              return errorResponse(res, {
                message: 'Access denied: you do not own this payment record',
                statusCode: 403
              });
            }

            req.resource = payment;
            return next();
          }

          default:
            return errorResponse(res, {
              message: 'Invalid resource ownership verification configuration',
              statusCode: 500
            });
        }
      } catch (error) {
        return next(error);
      }
    }

    return errorResponse(res, {
      message: 'Access denied',
      statusCode: 403
    });
  };
}

