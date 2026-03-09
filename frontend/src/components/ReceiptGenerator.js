import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, FileText, MessageCircle, Download, X, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import { useCurrency } from '../contexts/CurrencyContext';
import { downloadInvoicePDF } from '../utils/invoicePdfGenerator';

export default function ReceiptGenerator({ 
  isOpen, 
  onClose, 
  invoice,
  storeName = "BIJNISBOOKS",
  storeAddress = "",
  storePhone = "",
  storeGSTIN = ""
}) {
  const receiptRef = useRef(null);
  const { currencySymbol } = useCurrency();

  // Print handler using react-to-print
  const handlePrint = useReactToPrint({
    content: () => receiptRef.current,
    documentTitle: `Receipt-${invoice?.invoice_number || 'N/A'}`,
    onAfterPrint: () => toast.success('Print job sent'),
    onPrintError: () => toast.error('Print failed')
  });

  // Generate Professional A4 PDF - Uses centralized utility
  const generatePDF = () => {
    if (!invoice) return;
    
    const settings = {
      company_name: storeName,
      company_phone: storePhone,
      company_address: storeAddress,
      gstin: storeGSTIN
    };
    
    const success = downloadInvoicePDF(invoice, settings, currencySymbol);
    if (success) {
      toast.success('Invoice PDF downloaded!');
    } else {
      toast.error('Failed to generate PDF');
    }
  };

  // Share via WhatsApp
  const shareWhatsApp = () => {
    if (!invoice) return;

    const items = invoice.items || [];
    const itemsList = items.map(item => 
      `• ${item.item_name} x${item.quantity} = ${currencySymbol}${(item.quantity * item.rate).toLocaleString()}`
    ).join('\n');
    
    // Calculate CGST/SGST
    const gstRate = invoice.gst_rate || 5;
    const gstBreakdown = invoice.tax_amount > 0 
      ? `CGST (${gstRate/2}%): ${currencySymbol}${(invoice.tax_amount / 2).toFixed(2)}
SGST (${gstRate/2}%): ${currencySymbol}${(invoice.tax_amount / 2).toFixed(2)}`
      : '';

    const message = `🧾 *Receipt from ${storeName}*

📋 Invoice: ${invoice.invoice_number}
📅 Date: ${new Date(invoice.created_at).toLocaleString()}
${invoice.customer_name !== 'Walk-in Customer' ? `👤 Customer: ${invoice.customer_name}` : ''}

*Items:*
${itemsList}

─────────────
Subtotal: ${currencySymbol}${invoice.subtotal?.toLocaleString() || 0}
${invoice.discount_amount > 0 ? `Discount: -${currencySymbol}${invoice.discount_amount.toLocaleString()}` : ''}
${invoice.voucher_discount > 0 ? `Voucher: -${currencySymbol}${invoice.voucher_discount.toLocaleString()}` : ''}
${gstBreakdown}
─────────────
*TOTAL: ${currencySymbol}${(invoice.final_amount || invoice.total_amount)?.toLocaleString()}*

${invoice.loyalty_points_earned > 0 ? `🎁 You earned ${invoice.loyalty_points_earned} loyalty points!` : ''}

Thank you for shopping with us! 🙏`;

    const phoneNumber = invoice.customer_phone?.replace(/\D/g, '') || '';
    const whatsappUrl = phoneNumber 
      ? `https://wa.me/91${phoneNumber}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');
    toast.success('Opening WhatsApp...');
  };

  if (!invoice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Receipt - {invoice.invoice_number}
          </DialogTitle>
        </DialogHeader>

        {/* Receipt Preview */}
        <div className="flex-1 overflow-y-auto bg-white border rounded-lg">
          <div ref={receiptRef} className="p-4 text-sm font-mono" style={{ width: '300px', margin: '0 auto' }}>
            {/* Store Header */}
            <div className="text-center mb-3">
              <h2 className="text-lg font-bold">{storeName}</h2>
              {storeAddress && <p className="text-xs text-gray-600">{storeAddress}</p>}
              {storePhone && <p className="text-xs text-gray-600">Tel: {storePhone}</p>}
            </div>

            <div className="border-t border-b border-dashed py-2 mb-3 text-center">
              <span className="font-bold">TAX INVOICE</span>
            </div>

            {/* Invoice Details */}
            <div className="mb-3 text-xs">
              <p>Invoice: <span className="font-semibold">{invoice.invoice_number}</span></p>
              <p>Date: {new Date(invoice.created_at).toLocaleString()}</p>
              {invoice.customer_name !== 'Walk-in Customer' && (
                <p>Customer: {invoice.customer_name}</p>
              )}
              {invoice.customer_phone && <p>Phone: {invoice.customer_phone}</p>}
            </div>

            <div className="border-t border-dashed mb-2" />

            {/* Items */}
            <table className="w-full text-xs mb-2">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1">Item</th>
                  <th className="text-center py-1">Qty</th>
                  <th className="text-right py-1">Rate</th>
                  <th className="text-right py-1">Amt</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-1 truncate max-w-[100px]">{item.item_name}</td>
                    <td className="text-center py-1">{item.quantity}</td>
                    <td className="text-right py-1">{currencySymbol}{item.rate?.toLocaleString()}</td>
                    <td className="text-right py-1">{currencySymbol}{(item.quantity * item.rate)?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-dashed mb-2" />

            {/* Totals */}
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{currencySymbol}{invoice.subtotal?.toLocaleString()}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount:</span>
                  <span>-{currencySymbol}{invoice.discount_amount.toLocaleString()}</span>
                </div>
              )}
              {invoice.voucher_discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Voucher ({invoice.voucher_code}):</span>
                  <span>-{currencySymbol}{invoice.voucher_discount.toLocaleString()}</span>
                </div>
              )}
              {invoice.loyalty_discount > 0 && (
                <div className="flex justify-between text-purple-600">
                  <span>Loyalty Points:</span>
                  <span>-{currencySymbol}{invoice.loyalty_discount.toLocaleString()}</span>
                </div>
              )}
              {(() => {
                const gstRate = invoice.gst_rate || 5;
                let taxAmt = invoice.tax_amount || invoice.gst_amount;
                if (!taxAmt || taxAmt <= 0) {
                  taxAmt = (invoice.subtotal || invoice.total_amount || 0) * gstRate / (100 + gstRate);
                }
                if (taxAmt > 0) {
                  return (
                    <>
                      <div className="flex justify-between">
                        <span>CGST ({gstRate / 2}%):</span>
                        <span>{currencySymbol}{(taxAmt / 2).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST ({gstRate / 2}%):</span>
                        <span>{currencySymbol}{(taxAmt / 2).toFixed(2)}</span>
                      </div>
                    </>
                  );
                }
                return null;
              })()}
            </div>

            <div className="border-t-2 border-double my-2" />

            <div className="flex justify-between font-bold text-base">
              <span>TOTAL:</span>
              <span>{currencySymbol}{(invoice.final_amount || invoice.total_amount)?.toLocaleString()}</span>
            </div>

            <div className="border-t border-dashed mt-2 pt-2" />

            {/* Payment Methods */}
            {invoice.payment_methods?.length > 0 && (
              <div className="text-xs mb-2">
                {invoice.payment_methods.map((pm, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{pm.method?.toUpperCase()}:</span>
                    <span>{currencySymbol}{pm.amount?.toLocaleString()}</span>
                  </div>
                ))}
                {invoice.change_amount > 0 && (
                  <div className="flex justify-between font-semibold">
                    <span>Change:</span>
                    <span>{currencySymbol}{invoice.change_amount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-dashed mt-2 pt-2" />

            {/* Footer */}
            <div className="text-center text-xs">
              <p>Thank you for shopping with us!</p>
              <p className="text-gray-500">Visit again soon.</p>
              {storeGSTIN && <p className="mt-1">GSTIN: {storeGSTIN}</p>}
              {invoice.loyalty_points_earned > 0 && (
                <p className="mt-2 font-semibold text-purple-600">
                  🎁 You earned {invoice.loyalty_points_earned} loyalty points!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-4">
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button onClick={generatePDF} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            PDF
          </Button>
          <Button onClick={shareWhatsApp} variant="outline" className="gap-2 text-green-600 border-green-200 hover:bg-green-50">
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
