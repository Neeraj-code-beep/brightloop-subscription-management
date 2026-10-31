import crypto from 'crypto';

export class RazorpayAdapter {
  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || null;
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || null;
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || null;
  }

  isConfigured() {
    const keyId = this.keyId || process.env.RAZORPAY_KEY_ID;
    const keySecret = this.keySecret || process.env.RAZORPAY_KEY_SECRET;
    return Boolean(keyId && keySecret);
  }

  isWebhookConfigured() {
    return Boolean(this.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET);
  }

  /**
   * Verify Razorpay Payment Signature
   * Signature is HMAC SHA256 of `${orderId}|${paymentId}` signed with keySecret
   */
  verifyPaymentSignature({ orderId, paymentId, signature }) {
    if (!this.keySecret) {
      throw new Error('Razorpay key secret is not configured in environment variables.');
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const actualBuf = Buffer.from(signature || '', 'utf8');

    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  }

  /**
   * Verify Razorpay Webhook Signature
   * Signature header: x-razorpay-signature
   * Signed payload: raw body string or buffer
   */
  verifyWebhookSignature(rawBody, signature, customSecret = null) {
    const secret = customSecret || this.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('Razorpay webhook secret is not configured in environment variables.');
    }

    if (!rawBody || !signature) {
      return false;
    }

    const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');

    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  }

  /**
   * Create Razorpay Order (stub/live)
   */
  async createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    if (!this.isConfigured()) {
      throw new Error('Razorpay provider is not configured. Live orders cannot be initiated.');
    }

    // Amount in minor currency units (paisa)
    const amountInPaisa = Math.round(Number(amount) * 100);

    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`
      },
      body: JSON.stringify({
        amount: amountInPaisa,
        currency,
        receipt,
        notes
      })
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(`Razorpay order creation failed: ${errBody.error?.description || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Issue Razorpay Refund (stub/live)
   */
  async createRefund({ paymentId, amount, notes = {} }) {
    if (!this.isConfigured()) {
      throw new Error('Razorpay provider is not configured. Live refunds cannot be initiated.');
    }

    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const body = { notes };
    if (amount) {
      body.amount = Math.round(Number(amount) * 100);
    }

    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(`Razorpay refund failed: ${errBody.error?.description || response.statusText}`);
    }

    return await response.json();
  }
}

export const razorpayAdapter = new RazorpayAdapter();
