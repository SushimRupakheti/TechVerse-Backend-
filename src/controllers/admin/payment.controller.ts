import { Request, Response } from "express";
import { StripePaymentModel } from "../../models/stripePayment.model";
import { PaymentModel } from "../../models/payment.model";
import { ItemModel } from "../../models/item.model";
import mongoose from "mongoose";

export class AdminPaymentController {
  // List payments (merged from StripePaymentModel and PaymentModel)
  async getAllPayments(req: Request, res: Response) {
    try {
      const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
      const limit = Math.min(
        Math.max(parseInt((req.query.limit as string) || "10", 10), 1),
        100
      );
      const need = page * limit;

      const [stripeItems, legacyItems, stripeCount, legacyCount] = await Promise.all([
        StripePaymentModel.find().sort({ createdAt: -1 }).limit(need).lean(),
        PaymentModel.find().sort({ createdAt: -1 }).limit(need).lean(),
        StripePaymentModel.countDocuments(),
        PaymentModel.countDocuments(),
      ]);

      // Merge two sorted arrays by createdAt desc
      const merged: any[] = [];
      let i = 0,
        j = 0;
      while ((i < stripeItems.length || j < legacyItems.length) && merged.length < need) {
        const a = stripeItems[i];
        const b = legacyItems[j];
        if (!a) {
          merged.push({ source: "legacy", ...b });
          j++;
        } else if (!b) {
          merged.push({ source: "stripe", ...a });
          i++;
        } else {
          const ta = new Date(a.createdAt).getTime();
          const tb = new Date(b.createdAt).getTime();
          if (ta >= tb) {
            merged.push({ source: "stripe", ...a });
            i++;
          } else {
            merged.push({ source: "legacy", ...b });
            j++;
          }
        }
      }

      const total = stripeCount + legacyCount;
      const totalPages = Math.max(Math.ceil(total / limit), 1);

      // Slice for requested page
      const start = (page - 1) * limit;
      const pageItems = merged.slice(start, start + limit);

      // For stripe items that reference productId, try attach item snapshot or fetch item
      const productIds = pageItems
        .filter((x: any) => x.source === "stripe" && x.productId)
        .map((x: any) => x.productId)
        .filter((id: unknown) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id));

      const fetchedItemsMap: Record<string, any> = {};
      if (productIds.length) {
        const items = await ItemModel.find({ _id: { $in: productIds.map((id: any) => new mongoose.Types.ObjectId(id)) } }).lean();
        for (const it of items) fetchedItemsMap[String(it._id)] = it;
      }

      const normalized = pageItems.map((p: any) => {
        if (p.source === "stripe") {
          const itemSnap = p.itemSnapshot || fetchedItemsMap[p.productId];
          return {
            _id: p._id,
            createdAt: p.createdAt,
            amount: p.amount,
            currency: p.currency,
            status: p.status || "completed",
            buyerName: p.buyerName || p.customerEmail || (p.metadata && p.metadata.buyerName) || "",
            productName: (p.metadata && (p.metadata.productName || p.metadata.productId)) || p.productId || (itemSnap && itemSnap.phoneModel) || "",
            item: itemSnap ? { _id: itemSnap._id, phoneModel: itemSnap.phoneModel, photos: itemSnap.photos || [] } : null,
            raw: p.raw || p,
            source: "stripe",
          };
        }

        // legacy
        return {
          _id: p._id,
          createdAt: p.createdAt,
          amount: p.price || p.amt || 0,
          status: p.status || "Success",
          buyerName: p.fullName || "",
          productName: p.phoneModel || "",
          item: null,
          raw: p.raw || p,
          source: "legacy",
        };
      });

      return res.status(200).json({ success: true, data: normalized, meta: { total, totalPages, page, limit } });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Error fetching payments" });
    }
  }

  async getPaymentById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ success: false, message: "Missing id" });

      // Try find in StripePaymentModel by _id or sessionId/paymentIntentId
      const byId = await StripePaymentModel.findById(id).lean();
      if (byId) return res.status(200).json({ success: true, data: byId, source: "stripe" });

      const bySession = await StripePaymentModel.findOne({ sessionId: id }).lean();
      if (bySession) return res.status(200).json({ success: true, data: bySession, source: "stripe" });

      const byIntent = await StripePaymentModel.findOne({ paymentIntentId: id }).lean();
      if (byIntent) return res.status(200).json({ success: true, data: byIntent, source: "stripe" });

      // Fallback to legacy payment id
      const legacy = await PaymentModel.findById(id).lean();
      if (legacy) return res.status(200).json({ success: true, data: legacy, source: "legacy" });

      return res.status(404).json({ success: false, message: "Payment not found" });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Error fetching payment" });
    }
  }
}

export default new AdminPaymentController();
