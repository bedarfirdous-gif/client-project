// POS Constants and Configuration
import { Banknote, Smartphone, Building2, CreditCard, QrCode, Users, Package, Tags, Receipt, BookOpen } from 'lucide-react';

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: Banknote, color: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'gpay', label: 'GPay', icon: Smartphone, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'jk_bank', label: 'JK Bank', icon: Building2, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'hdfc_card', label: 'HDFC Card', icon: CreditCard, color: 'bg-red-100 text-red-700 border-red-200' },
  { id: 'upi', label: 'UPI', icon: QrCode, color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

export const GST_RATES = [
  { value: '0', label: '0% GST' },
  { value: '5', label: '5% GST' },
  { value: '12', label: '12% GST' },
  { value: '18', label: '18% GST' },
  { value: '28', label: '28% GST' },
];

export const POS_QUICK_ACTIONS = [
  { id: 'customers', label: 'Customers', icon: Users, color: 'bg-purple-500' },
  { id: 'items', label: 'Items', icon: Package, color: 'bg-blue-500' },
  { id: 'vouchers', label: 'Vouchers', icon: Tags, color: 'bg-pink-500' },
  { id: 'purchases', label: 'Purchases', icon: Receipt, color: 'bg-amber-500' },
  { id: 'customer-ledger', label: 'Ledger', icon: BookOpen, color: 'bg-indigo-500' },
];

// POS Calculation utilities
export const calculateSubtotal = (cart) => {
  return cart.reduce((sum, c) => sum + (c.rate * c.quantity), 0);
};

export const calculateGstAmount = (cart, gstRate, gstInclusive) => {
  if (gstInclusive) {
    return cart.reduce((sum, c) => {
      const gst = (c.rate * c.quantity * gstRate) / (100 + gstRate);
      return sum + gst;
    }, 0);
  }
  return calculateSubtotal(cart) * (gstRate / 100);
};

export const calculateManualDiscount = (subtotal, manualDiscount, discountType) => {
  return discountType === 'percent' 
    ? (subtotal * manualDiscount / 100) 
    : manualDiscount;
};

export const calculateTotalAmount = (subtotal, gstAmount, totalDiscount, gstInclusive) => {
  if (gstInclusive) {
    return subtotal - totalDiscount;
  }
  return subtotal + gstAmount - totalDiscount;
};

// Cart operations
export const createCartItem = (item, variant, rate, quantity = 1) => ({
  item_id: item.id,
  item_name: item.name,
  variant_id: variant.id,
  sku: variant.sku || variant.barcode,
  size: variant.size,
  color: variant.color,
  hsn_code: item.hsn_code || '',
  rate,
  mrp: item.mrp || variant.mrp || rate,
  quantity,
});

// Invoice number generator
export const generateInvoiceNumber = () => {
  const date = new Date();
  const prefix = 'INV';
  const timestamp = date.getFullYear().toString().slice(-2) +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};
