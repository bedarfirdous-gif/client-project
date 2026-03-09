/**
 * Centralized Professional A4 Invoice PDF Generator
 * This utility provides consistent PDF generation across the application
 * Used by: POSPage, SalesPage, ReceiptGenerator
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generate a professional A4 Invoice PDF
 * @param {Object} saleData - Sale/Invoice data object
 * @param {Object} settings - Invoice settings from API
 * @param {string} currencySymbol - Currency symbol to use
 * @param {Function} getStoreName - Optional function to get store name by ID
 */
export const generateProfessionalInvoicePDF = (saleData, settings = {}, currencySymbol = '₹', getStoreName = null) => {
  if (!saleData) {
    console.error('No sale data provided for PDF generation');
    return null;
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const sym = currencySymbol;
  
  // Colors
  const primaryColor = [200, 30, 30]; // Red
  const headerBg = [200, 30, 30];
  const textGray = [60, 60, 60];
  const lightGray = [100, 100, 100];
  
  // Margins
  const leftMargin = 15;
  const rightMargin = pageWidth - 15;
  
  let y = 15;
  
  // === HEADER SECTION ===
  // Company Name (Left - Red)
  doc.setTextColor(...primaryColor);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.company_name || saleData.store_name || 'Your Store', leftMargin, y);
  
  // INVOICE text (Right - Red)
  doc.setFontSize(28);
  doc.text('INVOICE', rightMargin, y, { align: 'right' });
  y += 6;
  
  // Contact info (Left)
  doc.setTextColor(...lightGray);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const contactParts = [];
  if (settings.company_phone) contactParts.push(`Tel: ${settings.company_phone}`);
  if (settings.company_email) contactParts.push(settings.company_email);
  doc.text(contactParts.join(' | ') || settings.company_address || '', leftMargin, y);
  
  // Invoice number and date (Right)
  doc.setTextColor(...textGray);
  doc.text(saleData.invoice_number, rightMargin, y, { align: 'right' });
  y += 5;
  
  const invoiceDate = saleData.created_at 
    ? new Date(saleData.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  doc.text(`Date: ${invoiceDate}`, rightMargin, y, { align: 'right' });
  y += 10;
  
  // Horizontal line
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(leftMargin, y, rightMargin, y);
  y += 10;
  
  // === BILL TO & INVOICE DETAILS SECTION ===
  const midPoint = pageWidth / 2;
  
  // BILL TO (Left)
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', leftMargin, y);
  
  // INVOICE DETAILS (Right)
  doc.text('INVOICE DETAILS', midPoint + 10, y);
  y += 6;
  
  // Customer details
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(saleData.customer_name || 'Walk-in Customer', leftMargin, y);
  
  // Invoice details
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Invoice No: ${saleData.invoice_number}`, midPoint + 10, y);
  y += 5;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (saleData.customer_phone) {
    doc.text(`Phone: ${saleData.customer_phone}`, leftMargin, y);
  }
  
  const fullDateTime = saleData.created_at 
    ? new Date(saleData.created_at).toLocaleString()
    : new Date().toLocaleString();
  doc.text(`Date: ${fullDateTime}`, midPoint + 10, y);
  y += 5;
  
  // Store name
  const storeName = getStoreName ? getStoreName(saleData.store_id) : (saleData.store_name || 'Main Store');
  doc.text(`Store: ${storeName}`, midPoint + 10, y);
  y += 15;
  
  // === ITEMS TABLE with MRP ===
  const tableHeaders = [['#', 'ITEM', 'HSN', 'QTY', 'MRP', 'RATE', 'GST%', 'AMOUNT']];
  const tableData = (saleData.items || []).map((item, idx) => {
    const gstPercent = item.gst_rate || saleData.gst_rate || 5;
    const amount = (item.quantity || 0) * (item.rate || 0);
    const mrp = item.mrp || item.rate || 0;
    const itemName = item.item_name || item.variant_name || item.name || 'Item';
    const variant = (item.size || item.color) 
      ? `\n${item.size || ''}${item.size && item.color ? ' / ' : ''}${item.color || ''}`
      : '';
    
    return [
      idx + 1,
      `${itemName}${variant}`,
      item.hsn_code || '-',
      item.quantity || 0,
      `${sym}${mrp.toFixed(0)}`,
      `${sym}${(item.rate || 0).toFixed(0)}`,
      `${gstPercent}%`,
      `${sym}${amount.toFixed(2)}`
    ];
  });
  
  autoTable(doc, {
    startY: y,
    head: tableHeaders,
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: headerBg,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: 3
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [230, 230, 230],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },    // #
      1: { cellWidth: 45 },                      // ITEM
      2: { cellWidth: 18, halign: 'center' },   // HSN
      3: { cellWidth: 12, halign: 'center' },   // QTY
      4: { cellWidth: 20, halign: 'right' },    // MRP
      5: { cellWidth: 20, halign: 'right' },    // RATE
      6: { cellWidth: 15, halign: 'center' },   // GST%
      7: { cellWidth: 25, halign: 'right' }     // AMOUNT
    },
    alternateRowStyles: {
      fillColor: [252, 252, 252]
    },
    margin: { left: leftMargin, right: leftMargin },
    tableWidth: 'auto'
  });
  
  y = doc.lastAutoTable.finalY + 10;
  
  // === TOTALS SECTION ===
  const totalsLabelX = pageWidth - 80;
  const totalsValueX = rightMargin;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textGray);
  
  // Subtotal
  doc.text('Subtotal', totalsLabelX, y, { align: 'right' });
  doc.text(`${sym}${(saleData.subtotal || 0).toFixed(2)}`, totalsValueX, y, { align: 'right' });
  y += 6;
  
  // Calculate GST
  const gstRate = saleData.gst_rate || 5;
  let gstAmount = saleData.gst_amount;
  if (!gstAmount || gstAmount <= 0) {
    // Calculate from subtotal if not provided
    gstAmount = (saleData.subtotal || saleData.total_amount || 0) * gstRate / (100 + gstRate);
  }
  
  // CGST
  doc.text(`CGST (${gstRate / 2}%)`, totalsLabelX, y, { align: 'right' });
  doc.text(`${sym}${(gstAmount / 2).toFixed(2)}`, totalsValueX, y, { align: 'right' });
  y += 6;
  
  // SGST
  doc.text(`SGST (${gstRate / 2}%)`, totalsLabelX, y, { align: 'right' });
  doc.text(`${sym}${(gstAmount / 2).toFixed(2)}`, totalsValueX, y, { align: 'right' });
  y += 6;
  
  // Discount
  const totalDiscount = (saleData.voucher_discount || 0) + (saleData.discount_amount || 0);
  if (totalDiscount > 0) {
    doc.setTextColor(...primaryColor);
    const discountLabel = saleData.voucher_code ? `Discount (${saleData.voucher_code})` : 'Discount';
    doc.text(discountLabel, totalsLabelX, y, { align: 'right' });
    doc.text(`-${sym}${totalDiscount.toFixed(2)}`, totalsValueX, y, { align: 'right' });
    y += 6;
  }
  
  y += 2;
  
  // Grand Total Box - properly aligned
  doc.setFillColor(...primaryColor);
  const boxX = pageWidth - 90;
  const boxWidth = 75;
  const boxHeight = 12;
  doc.roundedRect(boxX, y - 4, boxWidth, boxHeight, 1, 1, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  
  const gtTextY = y + 3;
  doc.text('Grand Total:', boxX + 5, gtTextY);
  const grandTotal = saleData.total_amount || saleData.final_amount || 0;
  doc.text(
    `${sym}${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    boxX + boxWidth - 5, 
    gtTextY, 
    { align: 'right' }
  );
  y += 20;
  
  // === PAYMENT INFORMATION ===
  if (saleData.payment_methods?.length > 0 || saleData.payment_method) {
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(leftMargin, y, pageWidth - 30, 25, 2, 2, 'F');
    
    doc.setTextColor(...primaryColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Information', leftMargin + 5, y + 7);
    
    doc.setTextColor(...textGray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    let payY = y + 14;
    if (saleData.payment_methods?.length > 0) {
      saleData.payment_methods.forEach(pm => {
        doc.text(`${(pm.method || 'CASH').toUpperCase()}:`, leftMargin + 5, payY);
        doc.text(`${sym}${(pm.amount || 0).toFixed(2)}`, leftMargin + 40, payY);
        payY += 5;
      });
    } else {
      doc.text(`${(saleData.payment_method || 'CASH').toUpperCase()}:`, leftMargin + 5, payY);
      doc.text(`${sym}${grandTotal.toFixed(2)}`, leftMargin + 40, payY);
    }
    y += 30;
  }
  
  // === TERMS & CONDITIONS ===
  if (settings.terms_and_conditions || settings.return_policy) {
    y += 5;
    doc.setDrawColor(220, 220, 220);
    doc.line(leftMargin, y, rightMargin, y);
    y += 8;
    
    doc.setTextColor(...lightGray);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions:', leftMargin, y);
    y += 4;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    if (settings.terms_and_conditions) {
      const terms = doc.splitTextToSize(settings.terms_and_conditions, pageWidth - 30);
      doc.text(terms.slice(0, 3), leftMargin, y);
      y += terms.slice(0, 3).length * 3;
    }
    if (settings.return_policy) {
      doc.text(`Return Policy: ${settings.return_policy}`, leftMargin, y);
    }
  }
  
  // === FOOTER ===
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(settings.footer_text || 'Thank you for your business!', pageWidth / 2, pageHeight - 15, { align: 'center' });
  
  return doc;
};

/**
 * Generate and download a professional invoice PDF
 * @param {Object} saleData - Sale/Invoice data object
 * @param {Object} settings - Invoice settings from API
 * @param {string} currencySymbol - Currency symbol to use
 * @param {Function} getStoreName - Optional function to get store name by ID
 */
export const downloadInvoicePDF = (saleData, settings = {}, currencySymbol = '₹', getStoreName = null) => {
  try {
    const doc = generateProfessionalInvoicePDF(saleData, settings, currencySymbol, getStoreName);
    if (doc) {
      doc.save(`Invoice_${saleData.invoice_number || 'N/A'}.pdf`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('PDF generation error:', error);
    return false;
  }
};

export default {
  generateProfessionalInvoicePDF,
  downloadInvoicePDF
};
