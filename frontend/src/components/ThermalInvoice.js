import React, { forwardRef } from 'react';
import { useCurrency } from '../contexts/CurrencyContext';

/**
 * ThermalInvoice - Compact invoice format optimized for 58mm/80mm thermal printers
 * Standard thermal paper width: 58mm (32 chars) or 80mm (48 chars)
 */
const ThermalInvoice = forwardRef(({ 
  invoice,
  storeName = "BIJNISBOOKS",
  storeAddress = "",
  storePhone = "",
  storeGSTIN = "",
  paperWidth = "80mm" // "58mm" or "80mm"
}, ref) => {
  const { currencySymbol } = useCurrency();
  
  if (!invoice) return null;

  const is58mm = paperWidth === "58mm";
  const maxWidth = is58mm ? "58mm" : "80mm";
  const fontSize = is58mm ? "10px" : "12px";
  const smallFont = is58mm ? "8px" : "10px";
  
  // Calculate totals
  const items = invoice.items || invoice.line_items || [];
  const subtotal = items.reduce((sum, item) => sum + ((item.quantity || 1) * (item.rate || item.price || 0)), 0);
  const discount = invoice.discount_amount || invoice.discount || 0;
  const tax = invoice.tax_amount || invoice.gst_amount || 0;
  const gstRate = invoice.gst_rate || 18;
  const cgst = tax / 2;
  const sgst = tax / 2;
  const total = invoice.total_amount || invoice.total || (subtotal - discount + tax);
  
  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return new Date().toLocaleString('en-IN');
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div 
      ref={ref}
      style={{
        width: maxWidth,
        maxWidth: maxWidth,
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: fontSize,
        lineHeight: '1.4',
        padding: '4mm',
        backgroundColor: 'white',
        color: 'black',
        margin: '0 auto'
      }}
      data-testid="thermal-invoice"
    >
      {/* Header - Store Info */}
      <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
        <div style={{ fontSize: is58mm ? '14px' : '16px', fontWeight: 'bold', marginBottom: '1mm' }}>
          {storeName}
        </div>
        {storeAddress && (
          <div style={{ fontSize: smallFont, wordWrap: 'break-word' }}>{storeAddress}</div>
        )}
        {storePhone && (
          <div style={{ fontSize: smallFont }}>Tel: {storePhone}</div>
        )}
        {storeGSTIN && (
          <div style={{ fontSize: smallFont }}>GSTIN: {storeGSTIN}</div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

      {/* Invoice Type & Number */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '2mm' }}>
        TAX INVOICE
      </div>

      {/* Invoice Details */}
      <div style={{ marginBottom: '3mm', fontSize: smallFont }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Invoice#:</span>
          <span style={{ fontWeight: 'bold' }}>{invoice.invoice_number || 'N/A'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Date:</span>
          <span>{formatDate(invoice.created_at || invoice.sale_date)}</span>
        </div>
        {(invoice.customer_name && invoice.customer_name !== 'Walk-in Customer') && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Customer:</span>
            <span>{invoice.customer_name}</span>
          </div>
        )}
        {invoice.customer_phone && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Phone:</span>
            <span>{invoice.customer_phone}</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #000', margin: '2mm 0' }} />

      {/* Items Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        fontWeight: 'bold',
        fontSize: smallFont,
        marginBottom: '1mm'
      }}>
        <span style={{ flex: 2 }}>Item</span>
        <span style={{ flex: 1, textAlign: 'center' }}>Qty</span>
        <span style={{ flex: 1, textAlign: 'right' }}>Rate</span>
        <span style={{ flex: 1, textAlign: 'right' }}>Amt</span>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px dashed #000', margin: '1mm 0' }} />

      {/* Items */}
      <div style={{ marginBottom: '2mm' }}>
        {items.map((item, idx) => {
          const name = item.item_name || item.name || 'Item';
          const qty = item.quantity || 1;
          const rate = item.rate || item.price || 0;
          const amount = qty * rate;
          
          return (
            <div key={idx} style={{ marginBottom: '1mm', fontSize: smallFont }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}>
                <span style={{ 
                  flex: 2, 
                  wordBreak: 'break-word',
                  paddingRight: '2mm'
                }}>
                  {is58mm ? name.substring(0, 12) : name.substring(0, 20)}
                  {item.variant_name && (
                    <span style={{ fontSize: '8px', display: 'block' }}>
                      ({item.variant_name})
                    </span>
                  )}
                </span>
                <span style={{ flex: 1, textAlign: 'center' }}>{qty}</span>
                <span style={{ flex: 1, textAlign: 'right' }}>{rate}</span>
                <span style={{ flex: 1, textAlign: 'right', fontWeight: 'bold' }}>
                  {amount.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #000', margin: '2mm 0' }} />

      {/* Totals */}
      <div style={{ fontSize: smallFont }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal:</span>
          <span>{currencySymbol}{subtotal.toLocaleString()}</span>
        </div>
        
        {discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'green' }}>
            <span>Discount:</span>
            <span>-{currencySymbol}{discount.toLocaleString()}</span>
          </div>
        )}
        
        {tax > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>CGST ({gstRate/2}%):</span>
              <span>{currencySymbol}{cgst.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>SGST ({gstRate/2}%):</span>
              <span>{currencySymbol}{sgst.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>

      {/* Double Line Divider */}
      <div style={{ borderTop: '2px double #000', margin: '2mm 0' }} />

      {/* Grand Total */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        fontWeight: 'bold',
        fontSize: is58mm ? '14px' : '16px',
        marginBottom: '2mm'
      }}>
        <span>TOTAL:</span>
        <span>{currencySymbol}{total.toLocaleString()}</span>
      </div>

      {/* Payment Info */}
      <div style={{ fontSize: smallFont, marginBottom: '2mm' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Payment:</span>
          <span>{invoice.payment_method || invoice.payment_type || 'Cash'}</span>
        </div>
        {invoice.amount_paid && invoice.amount_paid > total && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Paid:</span>
              <span>{currencySymbol}{invoice.amount_paid.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Change:</span>
              <span>{currencySymbol}{(invoice.amount_paid - total).toLocaleString()}</span>
            </div>
          </>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: smallFont }}>
        <div style={{ marginBottom: '1mm' }}>Thank you for your purchase!</div>
        <div>Visit again soon</div>
        {invoice.loyalty_points_earned > 0 && (
          <div style={{ marginTop: '2mm', fontWeight: 'bold' }}>
            Points Earned: +{invoice.loyalty_points_earned}
          </div>
        )}
      </div>

      {/* QR Code Placeholder - can be added later */}
      {invoice.invoice_number && (
        <div style={{ textAlign: 'center', marginTop: '3mm', fontSize: '8px' }}>
          Inv: {invoice.invoice_number}
        </div>
      )}

      {/* Spacer for paper cut */}
      <div style={{ height: '10mm' }} />
    </div>
  );
});

ThermalInvoice.displayName = 'ThermalInvoice';

export default ThermalInvoice;

/**
 * Utility function to print thermal invoice directly
 */
export const printThermalInvoice = (invoice, settings = {}) => {
  const {
    paperWidth = "80mm",
    storeName = "BIJNISBOOKS",
    storeAddress = "",
    storePhone = "",
    storeGSTIN = ""
  } = settings;

  // Create a hidden container
  const printContainer = document.createElement('div');
  printContainer.id = 'thermal-print-container';
  printContainer.style.position = 'fixed';
  printContainer.style.left = '-9999px';
  printContainer.style.top = '0';
  document.body.appendChild(printContainer);

  // Render the thermal invoice
  const React = require('react');
  const ReactDOM = require('react-dom/client');
  
  const root = ReactDOM.createRoot(printContainer);
  root.render(
    React.createElement(ThermalInvoice, {
      invoice,
      paperWidth,
      storeName,
      storeAddress,
      storePhone,
      storeGSTIN
    })
  );

  // Print after render
  setTimeout(() => {
    const printWindow = window.open('', '_blank', `width=${paperWidth === '58mm' ? 220 : 302},height=600`);
    
    const content = printContainer.innerHTML;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.invoice_number || ''}</title>
          <style>
            @page {
              size: ${paperWidth} auto;
              margin: 0;
            }
            @media print {
              body { margin: 0; padding: 0; }
            }
            body {
              margin: 0;
              padding: 0;
              font-family: 'Courier New', Courier, monospace;
            }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      document.body.removeChild(printContainer);
    }, 250);
  }, 100);
};
