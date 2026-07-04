export type ItemType = {
  sellerId: string;

  photos: string[];

  category: string;
  phoneModel: string;
  itemName: string;

  price: number;
  finalPrice: number;

  year: number;
  deviceCondition: string;
  description: string;

  isSold?: boolean;
  status?: "pending" | "approved" | "rejected" | "sold";
};
