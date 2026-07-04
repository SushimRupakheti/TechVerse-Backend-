"use strict";

// eSewa integration removed. Keep a lightweight service stub for future payment features.
export class PaymentService {
  async verifyEsewa(): Promise<any> {
    throw new Error("eSewa integration removed. Use Stripe endpoints instead.");
  }
}

export default new PaymentService();
