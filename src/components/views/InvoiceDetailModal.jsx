import React, { useState } from "react";
import {
  Check, Eye, FileText, AlertCircle, X, CheckCircle, Clock,
  FileCheck, CheckSquare, XCircle, ChevronLeft, RotateCcw,
  Truck, Download, Printer, Receipt, Camera, Video, Film, FileCode
} from "lucide-react";
import { getMediaFromCache, saveMediaToCache, compressAndSaveFile } from "../../utils/otherViewsShared";
import { uploadBomDocumentFile, validateClientFile } from "../../utils/bomStorageClient";
import { resolveDocumentUrlAsync } from "../../utils/documentResolver";
import { saveCloudStore } from "../../utils/supabaseDataSync";
import { centralInventoryStore } from "../../utils/centralInventoryStore";
import { addLiveNotification } from "../Header";
import TallySyncModal from "./TallySyncModal";

export default function InvoiceDetailModal({
  viewingInvoiceModal,
  setViewingInvoiceModal,
  isEditingInvoice,
  setIsEditingInvoice,
  invoiceEditForm,
  setInvoiceEditForm,
  invoiceModalActiveTab,
  setInvoiceModalActiveTab,
  bomStore,
  setBomStore,
  invoices,
  setInvoices,
  invoiceList: passedInvoiceList,
  setInvoiceList: passedSetInvoiceList,
  setPreviewDocModal,
  setActiveMediaPreviewModal = () => {}
}) {
  const invoiceList = passedInvoiceList || invoices || [];
  const setInvoiceList = passedSetInvoiceList || setInvoices || (() => {});
  const inv = viewingInvoiceModal || {};
  const [showTallyModal, setShowTallyModal] = useState(false);
  const isConfirmed = inv.status === 'Invoice Confirmed' || inv.status === 'Completed' || inv.invoiceConfirmed;
  const invNoText = isEditingInvoice
    ? (invoiceEditForm.invNo || inv.invoiceNo || inv.invNo || (isConfirmed ? (inv.code || 'INV-00027') : 'Pending Confirmation'))
    : (inv.invoiceNo || inv.invNo || (isConfirmed ? (inv.code || 'INV-00027') : 'Pending Confirmation'));
  const bomRefText = inv.poNo || inv.c3 || 'BOM-00007';
  const customerText = isEditingInvoice ? (invoiceEditForm.vendor || inv.vendor || inv.c2 || 'ABC Industries') : (inv.vendor || inv.c2 || 'ABC Industries');
  const invDateText = isEditingInvoice ? (invoiceEditForm.date || inv.date || inv.c4 || '21 May 2025') : (inv.date || inv.c4 || '21 May 2025');
  const paymentTypeText = isEditingInvoice ? (invoiceEditForm.paymentType || inv.paymentType || '100% Advance') : (inv.paymentType || '100% Advance');
  const isFullAdvance = paymentTypeText === '100% Advance';
  const is50Percent = paymentTypeText.includes('50%') || paymentTypeText === '50% Advance / 50% Dispatch';

  // Look up matching BOM from bomStore to sync items & dispatch checkboxes
  const matchingBom = bomStore.find(b =>
    b.bomCode === inv.poNo ||
    b.bomCode === inv.code ||
    b.bomCode === inv.c3 ||
    b.bomCode === bomRefText ||
    (b.salesOrderNo && (b.salesOrderNo === inv.poNo || b.salesOrderNo === inv.c3)) ||
    (b.bomCode && inv.invNo && inv.invNo.endsWith(b.bomCode.replace('BOM-', '')))
  );

  // ALWAYS check matchingBom items first so dispatch packing verification state (packed true/false) is source of truth
  const rawItems = (matchingBom && matchingBom.items && matchingBom.items.length > 0)
    ? matchingBom.items
    : (inv.items && inv.items.length > 0)
      ? inv.items
      : null;

  const baseItemsList = rawItems ? rawItems.map((it, idx) => {
    let selectedState = undefined;

    // 1. Check matchingBom dispatchPacking verification checklist by index or name
    if (matchingBom && matchingBom.dispatchPacking && Array.isArray(matchingBom.dispatchPacking) && matchingBom.dispatchPacking.length > 0) {
      if (matchingBom.dispatchPacking[idx] && matchingBom.dispatchPacking[idx].packed !== undefined) {
        selectedState = Boolean(matchingBom.dispatchPacking[idx].packed);
      } else {
        const matchInDispatch = matchingBom.dispatchPacking.find(dp =>
          dp.name === it.name || dp.code === it.code || (it.name && dp.name && dp.name.toLowerCase().trim() === it.name.toLowerCase().trim())
        );
        if (matchInDispatch !== undefined && matchInDispatch.packed !== undefined) {
          selectedState = Boolean(matchInDispatch.packed);
        }
      }
    }

    // 2. Check item level properties (selected or packed)
    if (selectedState === undefined) {
      if (it.selected !== undefined) selectedState = Boolean(it.selected);
      else if (it.packed !== undefined) selectedState = Boolean(it.packed);
      else selectedState = false;
    }

    const qty = it.qty || it.bomQty || 1;
    const rate = it.rate || it.unitPrice || 1000;
    return {
      code: it.code || `PRD-00${idx + 1}`,
      name: it.name || `Product ${idx + 1}`,
      desc: it.desc || it.category || 'High grade mounting component',
      uom: it.uom || 'Nos',
      bomQty: qty,
      invQty: qty,
      rate: rate,
      discount: it.discount || 0,
      tax: it.tax || 18,
      amt: it.amt || (qty * rate * 1.18),
      selected: selectedState
    };
  }) : [
    { code: 'PRD-001', name: 'Long Rail 3000 mm', desc: '3 Meter Heavy Duty Rail', uom: 'Nos', bomQty: 8, invQty: 8, rate: 1800.00, discount: 0, tax: 18, amt: 14400.00 * 1.18, selected: true },
    { code: 'PRD-002', name: 'Mini Rail 100 mm', desc: 'Aluminum Mounting Rail', uom: 'Nos', bomQty: 12, invQty: 12, rate: 250.00, discount: 0, tax: 18, amt: 3000.00 * 1.18, selected: false }
  ];

  // Use invoiceEditForm.items if in edit mode and items are present
  const itemsList = (isEditingInvoice && invoiceEditForm.items && invoiceEditForm.items.length > 0)
    ? invoiceEditForm.items
    : baseItemsList;

  const computedSubtotal = itemsList.reduce((acc, it) => acc + ((it.qty || it.invQty || it.bomQty || 1) * (it.rate || 0)), 0);
  const computedTaxGst = computedSubtotal * 0.18;
  const computedGrandTotal = computedSubtotal + computedTaxGst;

  const totalAmtRaw = isEditingInvoice
    ? computedGrandTotal
    : (typeof inv.invAmt === 'number'
      ? inv.invAmt
      : parseFloat((inv.invAmt || inv.c5 || '76523').toString().replace(/[^0-9.]/g, '')) || computedGrandTotal || 17400);

  const subtotal = isEditingInvoice ? computedSubtotal : (totalAmtRaw / 1.18);
  const taxGst = isEditingInvoice ? computedTaxGst : (totalAmtRaw - subtotal);

  const advanceAmt = isFullAdvance ? totalAmtRaw : (is50Percent ? totalAmtRaw * 0.5 : totalAmtRaw);
  const balanceAmt = isFullAdvance ? 0 : (is50Percent ? totalAmtRaw * 0.5 : 0);
  const paymentStatusText = inv.pay || (balanceAmt === 0 ? 'Verified & Paid (100%)' : 'Ready for Payment');

  const handleStartEditingInvoice = () => {
    const bAddrInit = inv.billingAddress || matchingBom?.billingAddress || 'Plot No 42, SIDCO Industrial Estate, Ambattur, Chennai';
    const dAddrInit = inv.deliveryAddress || matchingBom?.deliveryAddress || bAddrInit;
    setInvoiceEditForm({
      invNo: invNoText,
      date: invDateText,
      vendor: customerText,
      billingAddress: bAddrInit,
      deliveryAddress: dAddrInit,
      paymentType: paymentTypeText,
      items: baseItemsList.map(it => ({ ...it }))
    });
    setIsEditingInvoice(true);
  };

  const handleSaveInvoiceEdits = () => {
    const updatedInvAmt = `₹ ${computedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const updatedInvoiceRecord = {
      ...inv,
      invNo: invoiceEditForm.invNo || invNoText,
      code: invoiceEditForm.invNo || invNoText,
      vendor: invoiceEditForm.vendor || customerText,
      customerName: invoiceEditForm.vendor || customerText,
      date: invoiceEditForm.date || invDateText,
      paymentType: invoiceEditForm.paymentType || paymentTypeText,
      billingAddress: invoiceEditForm.billingAddress,
      deliveryAddress: invoiceEditForm.deliveryAddress,
      invAmt: updatedInvAmt,
      items: invoiceEditForm.items,
      lastModifiedAt: new Date().toISOString()
    };

    setViewingInvoiceModal(updatedInvoiceRecord);

    setInvoiceList(prev => {
      const updated = prev.map(item =>
        (item.invNo === inv.invNo || item.code === inv.code || item.bomCode === inv.bomCode)
          ? { ...item, ...updatedInvoiceRecord }
          : item
      );
      try {
        saveCloudStore("invoice_store", updated);
      } catch (e) { }
      return updated;
    });

    // Also sync customer name, paymentType, and addresses back to matching BOM
    const targetCode = inv.poNo || inv.code || bomRefText;
    setBomStore(prev => {
      const updatedBoms = prev.map(b => (
        b.bomCode === targetCode ||
        b.salesOrderNo === targetCode ||
        b.code === targetCode ||
        (inv.invNo && b.bomCode && inv.invNo.endsWith(b.bomCode.replace('BOM-', '')))
      ) ? {
        ...b,
        customerName: invoiceEditForm.vendor || b.customerName,
        paymentType: invoiceEditForm.paymentType || b.paymentType,
        billingAddress: invoiceEditForm.billingAddress || b.billingAddress,
        deliveryAddress: invoiceEditForm.deliveryAddress || b.deliveryAddress,
        grandTotal: computedGrandTotal,
        invoiceNo: invoiceEditForm.invNo || b.invoiceNo
      } : b);
      try {
        saveCloudStore("bom_store", updatedBoms);
      } catch (e) { }
      return updatedBoms;
    });

    setIsEditingInvoice(false);
    addLiveNotification({
      title: 'Invoice Details Updated',
      message: `Invoice ${invoiceEditForm.invNo || invNoText} successfully updated and saved!`,
      type: 'success',
      category: 'Invoice'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Back Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => {
            setIsEditingInvoice(false);
            setViewingInvoiceModal(null);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '700',
            color: '#475569',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          <ChevronLeft style={{ width: '16px', height: '16px' }} /> Back to Invoice List
        </button>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Print button */}
          <button
            onClick={() => setPrintTaxInvoiceModal(inv)}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '0 16px',
              height: '38px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Printer style={{ width: '15px', height: '15px', color: '#475569' }} /> Print
          </button>

          {/* Tally Sync button */}
          <button
            onClick={() => setShowTallyModal(true)}
            style={{
              backgroundColor: '#FEF3C7',
              border: '1px solid #FDE68A',
              borderRadius: '8px',
              padding: '0 16px',
              height: '38px',
              fontSize: '13px',
              fontWeight: '800',
              color: '#92400E',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Export or Sync this invoice to TallyPrime / Tally.ERP 9"
          >
            <FileCode style={{ width: '15px', height: '15px', color: '#D97706' }} /> Tally Sync
          </button>

          {/* Download button */}
          <button
            onClick={() => alert(`Downloading Invoice ${invNoText} PDF...`)}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '0 16px',
              height: '38px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download style={{ width: '15px', height: '15px', color: '#475569' }} /> Download
          </button>

          {/* Cancel Invoice button */}
          {inv.status === 'Cancelled' ? (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '0 16px',
                height: '38px',
                fontSize: '13px',
                fontWeight: '800',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <XCircle style={{ width: '15px', height: '15px', color: '#DC2626' }} /> Cancelled
            </div>
          ) : (
            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to cancel Invoice ${invNoText}? This will mark the invoice as Cancelled and return the order status.`)) {
                  const nowIso = new Date().toISOString();
                  const targetCode = inv.poNo || inv.code || bomRefText;

                  setViewingInvoiceModal(prev => prev ? {
                    ...prev,
                    status: 'Cancelled',
                    pay: 'Cancelled',
                    cancelledAt: nowIso
                  } : prev);

                  setInvoiceList(prev => {
                    const updatedInvoices = prev.map(item => (item.invNo === inv.invNo || item.code === inv.code || item.bomCode === inv.bomCode) ? {
                      ...item,
                      status: 'Cancelled',
                      pay: 'Cancelled',
                      cancelledAt: nowIso
                    } : item);
                    try {
                      saveCloudStore("invoice_store", updatedInvoices);
                    } catch (e) { }
                    return updatedInvoices;
                  });

                  setBomStore(prev => prev.map(b => (
                    b.bomCode === targetCode ||
                    b.salesOrderNo === targetCode ||
                    b.code === targetCode ||
                    (inv.invNo && b.bomCode && inv.invNo.endsWith(b.bomCode.replace('BOM-', '')))
                  ) ? {
                    ...b,
                    status: 'Invoice Cancelled',
                    invoiceConfirmed: false,
                    invoiceCancelledAt: nowIso
                  } : b));

                  try {
                    addLiveNotification({
                      title: `Invoice ${invNoText} Cancelled`,
                      message: `Invoice ${invNoText} for BOM ${bomRefText} has been marked as Cancelled.`,
                      type: 'alert'
                    });
                  } catch (e) { }

                  alert(`Invoice ${invNoText} has been successfully marked as Cancelled.`);
                }
              }}
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '0 16px',
                height: '38px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#DC2626',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              title="Cancel this invoice"
            >
              <XCircle style={{ width: '15px', height: '15px', color: '#DC2626' }} /> Cancel
            </button>
          )}

          {/* Invoices are strictly official records and read-only */}

          {/* Confirm Invoice primary button */}
          {['Invoice Confirmed', 'CLOSED', 'Completed', 'Confirmed', 'Fully Dispatched & Delivered'].includes(inv.status) ? (
            <div
              style={{
                backgroundColor: '#DCFCE7',
                color: '#166534',
                border: '1px solid #86EFAC',
                borderRadius: '8px',
                padding: '0 18px',
                height: '38px',
                fontSize: '13px',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle style={{ width: '16px', height: '16px', color: '#166534' }} /> Invoice Completed
            </div>
          ) : (
            <button
              onClick={() => {
                // 1. Identify items to deduct (if any selected, use selected, otherwise deduct ALL invoice items)
                const hasExplicitSelection = (itemsList || []).some(item => item.selected === true);
                const packedItemsToDeduct = hasExplicitSelection
                  ? (itemsList || []).filter(item => Boolean(item.selected))
                  : (itemsList || []);

                // Check if matching BOM already blocked/deducted stock at creation/verification time
                const isStockAlreadyBlocked = Boolean(matchingBom?.stockBlocked || inv.stockDeducted || inv.stockBlocked);

                if (!isStockAlreadyBlocked) {
                  // 2. Reduce stock in stockRegistry
                  setStockRegistry(prevRegistry => {
                    const updated = [...prevRegistry];
                    packedItemsToDeduct.forEach(pItem => {
                      const qtyToDeduct = parseInt(pItem.invQty || pItem.bomQty || pItem.qty || 1, 10) || 0;
                    const matchIdx = updated.findIndex(r =>
                      (r.code && pItem.code && r.code.toLowerCase().trim() === pItem.code.toLowerCase().trim()) ||
                      (r.item && pItem.name && (
                        r.item.toLowerCase().trim() === pItem.name.toLowerCase().trim() ||
                        r.item.toLowerCase().includes(pItem.name.toLowerCase().trim()) ||
                        pItem.name.toLowerCase().includes(r.item.toLowerCase().trim())
                      ))
                    );
                    if (matchIdx !== -1) {
                      const currentStock = Math.max(0, parseInt(String(updated[matchIdx].stock).replace(/,/g, ''), 10) || 0);
                      const newStock = Math.max(0, currentStock - qtyToDeduct);
                      const minLvl = parseInt(String(updated[matchIdx].minLevel || '500').replace(/,/g, ''), 10) || 500;
                      updated[matchIdx] = {
                        ...updated[matchIdx],
                        stock: String(newStock),
                        status: newStock === 0 ? 'Out of Stock' : (newStock <= minLvl ? 'Low Stock' : 'In Stock')
                      };
                    }
                  });
                  try {
                    localStorage.setItem('controlroom_stock_registry_store', JSON.stringify(updated));
                  } catch (e) { }
                  return updated;
                });

                // 3. Deduct stock directly from prodModuleEngine central live inventory
                try {
                  const engineInv = prodModuleEngine.getInventory();
                  packedItemsToDeduct.forEach(pItem => {
                    const qtyToDeduct = parseInt(pItem.invQty || pItem.bomQty || pItem.qty || 1, 10) || 0;
                    const pCode = (pItem.code || '').toUpperCase().trim();
                    const pName = (pItem.name || pItem.description || '').toLowerCase().trim();

                    let targetItem = engineInv.find(i => {
                      const iCode = (i.code || '').toUpperCase().trim();
                      const iName = (i.name || '').toLowerCase().trim();
                      if (pCode && iCode === pCode) return true;
                      if (pName && iName && (iName === pName || iName.includes(pName) || pName.includes(iName))) return true;
                      return false;
                    });

                    if (targetItem) {
                      targetItem.physicalStock = Math.max(0, targetItem.physicalStock - qtyToDeduct);
                      targetItem.availableStock = Math.max(0, targetItem.physicalStock - (targetItem.reservedStock || 0));
                    } else {
                      targetItem = {
                        code: pCode || `FG-${Date.now().toString().slice(-4)}`,
                        name: pItem.name || pItem.description || 'Finished Good Item',
                        category: 'Finished Goods',
                        unit: pItem.uom || pItem.unit || 'Nos',
                        physicalStock: Math.max(0, 1000 - qtyToDeduct),
                        availableStock: Math.max(0, 1000 - qtyToDeduct),
                        reservedStock: 0,
                        safetyStock: 50,
                        bayLocation: 'Main Store'
                      };
                      prodModuleEngine.inventory.push(targetItem);
                    }

                    // Record in central audit log ledger for inventory traceability
                    const salesRepName = inv.salesPerson || (inv.createdByName ? `${inv.createdByName} (Sales)` : 'Sales Team');
                    const targetCodeName = targetItem ? targetItem.code : (pCode || 'FG-ITEM');
                    prodModuleEngine.addLedgerEntry({
                      timestamp: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
                      type: 'PRODUCTION_CONSUMPTION',
                      woId: invNoText,
                      itemCode: targetCodeName,
                      itemName: pItem.name || pItem.description || 'Finished Good Item',
                      qty: -qtyToDeduct,
                      unit: pItem.uom || pItem.unit || 'Nos',
                      previousStock: targetItem.physicalStock + qtyToDeduct,
                      newStock: targetItem.physicalStock,
                      user: 'Accounts & Billing Department',
                      employee: salesRepName,
                      reason: `Dispatch & Invoice Outflow (-${qtyToDeduct} ${pItem.uom || pItem.unit || 'Nos'}): Sales order BOM (${bomRefText}) invoiced (${invNoText}) by ${salesRepName}. Stock deducted from inventory.`,
                      referenceDoc: invNoText
                    });
                  });
                  prodModuleEngine.saveToStorage();
                } catch (e) { console.error('Invoice stock deduction engine error:', e); }

                // 4. Update controlroom_raw_materials_store accurately
                try {
                  const savedMatStr = localStorage.getItem('controlroom_raw_materials_store');
                  let currentMats = [];
                  if (savedMatStr) {
                    try { currentMats = JSON.parse(savedMatStr); } catch (e) { }
                  }
                  if (!Array.isArray(currentMats) || currentMats.length === 0) {
                    currentMats = ALUMINUM_PROFILES.map(p => ({
                      ...p,
                      lastUpdated: 'Live Store',
                      reserved: 0,
                      openingStock: p.stock,
                      goodsReceived: 0,
                      issuedProd: 0,
                      matReturn: 0,
                      stockAdj: 0
                    }));
                  }

                  packedItemsToDeduct.forEach(pItem => {
                    const qtyToDeduct = parseInt(pItem.invQty || pItem.bomQty || pItem.qty || 1, 10) || 0;
                    const pCode = (pItem.code || '').toUpperCase().trim();
                    const pName = (pItem.name || pItem.description || '').toLowerCase().trim();

                    let match = currentMats.find(m => {
                      const mCode = (m.code || '').toUpperCase().trim();
                      const mName = (m.name || '').toLowerCase().trim();
                      if (pCode && mCode === pCode) return true;
                      if (pName && (mName === pName || mName.includes(pName) || pName.includes(mName))) return true;
                      return false;
                    });

                    if (match) {
                      const currSt = Math.max(0, parseInt(String(match.stock).replace(/,/g, ''), 10) || 0);
                      const newSt = Math.max(0, currSt - qtyToDeduct);
                      const minL = parseInt(String(match.minLevel || '100').replace(/,/g, ''), 10) || 100;
                      match.stock = newSt;
                      match.issuedProd = (match.issuedProd || 0) + qtyToDeduct;
                      match.status = newSt === 0 ? 'Out of Stock' : (newSt <= minL ? 'Low Stock' : 'In Stock');
                      match.lastUpdated = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                    } else {
                      const startStock = 1000;
                      const newSt = Math.max(0, startStock - qtyToDeduct);
                      currentMats.push({
                        code: pCode || `FG-${Date.now().toString().slice(-4)}`,
                        name: pItem.name || pItem.description || 'Finished Good Item',
                        cat: 'Finished Goods',
                        unit: pItem.uom || pItem.unit || 'Nos',
                        stock: newSt,
                        minLevel: 50,
                        status: newSt === 0 ? 'Out of Stock' : (newSt <= 50 ? 'Low Stock' : 'In Stock'),
                        store: 'Main Store',
                        hsn: '7616',
                        lastUpdated: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        reserved: 0,
                        openingStock: startStock,
                        goodsReceived: 0,
                        issuedProd: qtyToDeduct,
                        matReturn: 0,
                        stockAdj: 0
                      });
                    }
                  });

                  localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(currentMats));
                  saveCloudStore('raw_materials_store', currentMats);
                  window.dispatchEvent(new Event('controlroom_raw_materials_update'));
                } catch (err) { console.error('Error updating raw materials store:', err); }
              } // end if (!isStockAlreadyBlocked)

              // Deduct Inventory in Central Inventory Store
              try {
                centralInventoryStore.deductStockForBOM(bomRefText, packedItemsToDeduct, 'Accounts Invoice Confirmation');
                window.dispatchEvent(new Event('central_inventory_updated'));
                window.dispatchEvent(new Event('controlroom_storage_update'));
                window.dispatchEvent(new Event('storage'));
              } catch (cErr) {
                console.warn('Central inventory store deduction error in InvoiceDetailModal:', cErr);
              }

                // 5. Update Invoice status & persist to localStorage / cloud store
                setViewingInvoiceModal(prev => prev ? {
                  ...prev,
                  status: 'Invoice Confirmed',
                  match: 'Matched',
                  pay: 'Completed & Locked',
                  stockDeducted: true,
                  stockDeductionDate: new Date().toISOString()
                } : prev);

                const unpackedItems = (itemsList || []).filter(it => it.selected === false);
                setInvoiceList(prev => {
                  const updatedInvoices = prev.map(item => (item.invNo === inv.invNo || item.code === inv.code || item.bomCode === inv.bomCode) ? {
                    ...item,
                    status: 'Invoice Confirmed',
                    match: 'Matched',
                    pay: 'Completed & Locked',
                    stockDeducted: true,
                    stockDeductionDate: new Date().toISOString(),
                    packedItemsDeducted: packedItemsToDeduct,
                    unpackedItemsRemaining: unpackedItems
                  } : item);
                  try {
                    saveCloudStore("invoice_store", updatedInvoices);
                  } catch (e) { }
                  return updatedInvoices;
                });

                // 6. Update matching BOM status to 'Awaiting Vehicle Loading & Dispatch'
                const targetCode = inv.poNo || inv.code || bomRefText;
                setBomStore(prev => prev.map(b => (
                  b.bomCode === targetCode ||
                  b.salesOrderNo === targetCode ||
                  b.code === targetCode ||
                  (inv.invNo && b.bomCode && inv.invNo.endsWith(b.bomCode.replace('BOM-', '')))
                ) ? {
                  ...b,
                  status: 'Awaiting Vehicle Loading & Dispatch',
                  invoiceConfirmed: true,
                  invoiceNo: invNoText,
                  stockDeducted: true,
                  stockDeductionDate: new Date().toISOString(),
                  packedItemsDeducted: packedItemsToDeduct
                } : b));

                // 7. Post Invoice to Zoho Books API (/api/zoho/invoices) with ONLY Preset Name and Preset Price
                const presetName = matchingBom?.presetName || inv.presetName || 'Solar Mounting Structure Kit';
                const totalPresetPrice = Number(totalAmtRaw || (inv.invAmt ? String(inv.invAmt).replace(/[^0-9.]/g, '') : 0));

                try {
                  fetch('/api/zoho/invoices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      invNo: (invNoText && invNoText !== 'Pending Confirmation') ? invNoText : undefined,
                      poNo: bomRefText,
                      bomCode: bomRefText,
                      vendor: customerText,
                      customerName: customerText,
                      date: invDateText || new Date().toISOString().split('T')[0],
                      invAmt: totalPresetPrice,
                      presetName: presetName,
                      items: [{
                        name: presetName,
                        rate: totalPresetPrice,
                        quantity: 1,
                        description: `Preset Structure Package: ${presetName} (BOM Ref: ${bomRefText})`
                      }],
                      notes: `Sales Invoice confirmed for BOM ${bomRefText} (${presetName}).`
                    })
                  })
                    .then(res => res.json())
                    .then(data => {
                      if (data && data.invoice) {
                        const zohoInv = data.invoice;
                        const finalConfirmedInvNo = zohoInv.invoice_number || zohoInv.invNo || invNoText;
                        setInvoiceList(prev => (prev || []).map(item =>
                          (item.invNo === inv.invNo || item.code === inv.code || item.bomCode === inv.bomCode || item.poNo === bomRefText)
                            ? {
                                ...item,
                                invNo: finalConfirmedInvNo,
                                code: finalConfirmedInvNo,
                                invoiceNo: finalConfirmedInvNo,
                                zohoId: zohoInv.zohoId || zohoInv.id,
                                zohoInvoiceNumber: finalConfirmedInvNo,
                                syncedToZoho: true
                              }
                            : item
                        ));
                        setBomStore(prev => (prev || []).map(b =>
                          (b.bomCode === bomRefText || b.code === bomRefText)
                            ? { ...b, invoiceNo: finalConfirmedInvNo }
                            : b
                        ));
                      }
                    })
                    .catch(err => console.warn('Zoho invoice sync notice:', err));
                } catch (e) { console.error('Zoho invoice fetch trigger error:', e); }

                // Trigger Real-time Workflow Notifications with synthesized sound & deep-links for Sales & Dispatch
                notifyInvoiceCompletedReadyForDispatch({
                  invoiceNo: invNoText,
                  bomCode: bomRefText,
                  customerName: customerText,
                  salesPerson: inv.salesPerson || (matchingBom && matchingBom.salesPerson)
                });

                setViewingInvoiceModal(null);
                setConfirmInvoiceSuccessModal({
                  invNo: invNoText,
                  bomCode: bomRefText,
                  customer: customerText,
                  deliveryAddress: inv.deliveryAddress || (matchingBom && matchingBom.deliveryAddress) || 'Customer Delivery Site',
                  packedCount: packedItemsToDeduct.length,
                  totalCount: (itemsList || []).length,
                  deductedItems: packedItemsToDeduct
                });
              }}
              style={{
                backgroundColor: '#3B82F6',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '0 20px',
                height: '38px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
              }}
            >
              <CheckCircle style={{ width: '16px', height: '16px', color: '#FFFFFF' }} /> Confirm Invoice
            </button>
          )}
        </div>
      </div>

      {/* CARD 1: TOP HEADER METRICS & INVOICE SUMMARY */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '24px',
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: '24px'
      }}>
        {/* Left Header Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#EEF2FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4F46E5'
            }}>
              <Receipt style={{ width: '26px', height: '26px' }} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase' }}>Invoice Number</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#0F172A' }}>{invNoText}</h2>
                {['Invoice Confirmed', 'CLOSED', 'Completed', 'Confirmed'].includes(inv.status) ? (
                  <span style={{ backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Check style={{ width: '13px', height: '13px', strokeWidth: 3 }} /> INVOICE COMPLETED & LOCKED
                  </span>
                ) : (
                  <span style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
                    INVOICE PENDING
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '16px', fontSize: '12px' }}>
            <div>
              <div style={{ color: '#64748B', fontSize: '11px', fontWeight: '600' }}>Related BOM</div>
              <strong style={{ color: '#2563EB' }}>{bomRefText}</strong>
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '11px', fontWeight: '600' }}>Invoice Date</div>
              <strong style={{ color: '#1E293B' }}>{invDateText}</strong>
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '11px', fontWeight: '600' }}>Customer</div>
              <strong style={{ color: '#2563EB' }}>{customerText}</strong>
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '11px', fontWeight: '600' }}>Sales Person</div>
              <strong style={{ color: '#0E7490' }}>👤 {((inv.salesPerson || matchingBom?.salesPerson || localStorage.getItem('controlroom_logged_user_name') || 'Mohith JV')).replace(/\s*\([^)]*\)/g, '').trim()}</strong>
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '11px', fontWeight: '600' }}>Due Date</div>
              <strong style={{ color: '#1E293B' }}>{invDateText}</strong>
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '11px', fontWeight: '600' }}>Payment Type</div>
              <strong style={{ color: '#1E293B' }}>{paymentTypeText}</strong>
            </div>
          </div>
        </div>

        {/* Right Invoice Summary Box */}
        <div style={{
          backgroundColor: '#F8FAFC',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          justify: 'center'
        }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Invoice Summary</h4>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
            <span>Subtotal (Before Tax)</span>
            <strong style={{ color: '#0F172A' }}>₹ {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
            <span>Tax (18% GST)</span>
            <strong style={{ color: '#0F172A' }}>₹ {taxGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
            <span>Shipping Charges</span>
            <strong style={{ color: '#0F172A' }}>₹ 0.00</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
            <span>Discount</span>
            <strong style={{ color: '#0F172A' }}>- ₹ 0.00</strong>
          </div>

          <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Grand Total</span>
            <strong style={{ fontSize: '20px', fontWeight: '800', color: '#4F46E5' }}>
              ₹ {totalAmtRaw.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>

          <div style={{ fontSize: '10px', color: '#64748B', fontStyle: 'italic', marginTop: '2px' }}>
            Amount in Words: <strong>Rupees {totalAmtRaw.toLocaleString('en-IN')} Only</strong>
          </div>
        </div>
      </div>

      {/* CARD 2: INVOICE ITEMS TABTABLE */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', gap: '24px' }}>
          {['Invoice Items', 'Additional Information'].map(t => (
            <button
              key={t}
              onClick={() => setInvoiceModalActiveTab(t)}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                padding: '10px 0',
                fontSize: '13px',
                fontWeight: '800',
                color: invoiceModalActiveTab === t ? '#4F46E5' : '#64748B',
                borderBottom: invoiceModalActiveTab === t ? '2px solid #4F46E5' : '2px solid transparent',
                cursor: 'pointer'
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* TAB CONTENT: INVOICE ITEMS */}
        {invoiceModalActiveTab === 'Invoice Items' && (() => {
          const indexedItemsList = itemsList.map((it, idx) => ({ ...it, originalIndex: idx }));
          const packedItems = indexedItemsList.filter(it => it.selected !== false);
          const unpackedItems = indexedItemsList.filter(it => it.selected === false);
          const packedTotal = packedItems.reduce((acc, it) => acc + (it.amt || ((it.qty || 1) * (it.rate || 0) * 1.18)), 0);
          const unpackedTotal = unpackedItems.reduce((acc, it) => acc + (it.amt || ((it.qty || 1) * (it.rate || 0) * 1.18)), 0);

          const targetRef = inv.poNo || inv.code || inv.bomCode || bomRefText;
          const foundBom = bomStore.find(b => (b.bomCode && b.bomCode === targetRef) || (b.code && b.code === targetRef) || (b.bomCode && inv.invNo && inv.invNo.includes(b.bomCode.replace("BOM-", ""))));
          const rawAddressProof = inv.deliveryAddressProofDoc || matchingBom?.deliveryAddressProofDoc || foundBom?.deliveryAddressProofDoc || null;
          let addressProofDoc = rawAddressProof;
          if (addressProofDoc && !addressProofDoc.dataUrl && addressProofDoc.name) {
            const cached = getMediaFromCache(addressProofDoc.name);
            if (cached) {
              addressProofDoc = { ...addressProofDoc, dataUrl: cached };
            }
          }
          const bAddr = inv.billingAddress || matchingBom?.billingAddress || foundBom?.billingAddress || 'Plot No 42, SIDCO Industrial Estate, Ambattur, Chennai';
          const dAddr = inv.deliveryAddress || matchingBom?.deliveryAddress || foundBom?.deliveryAddress || bAddr;
          const isSameAddress = Boolean(
            inv.sameAsBilling ||
            matchingBom?.sameAsBilling ||
            foundBom?.sameAsBilling ||
            (bAddr && dAddr && bAddr.trim().toLowerCase() === dAddr.trim().toLowerCase())
          );

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* TABLE 1: PACKED & DISPATCHED ITEMS (GREEN THEME) */}
              <div style={{ borderRadius: '12px', border: '1px solid #86EFAC', backgroundColor: '#F0FDF4', overflow: 'hidden', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle style={{ width: '18px', height: '18px', color: '#166534' }} />
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#166534' }}>
                      1. Packed & Dispatched Items ({packedItems.length})
                    </h4>
                  </div>
                  <span style={{ backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
                    Ready for Invoice / Delivery
                  </span>
                </div>

                <div style={{ overflowX: 'auto', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #DCFCE7' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F0FDF4', color: '#166534', borderBottom: '1px solid #DCFCE7' }}>
                        <th style={{ padding: '10px', textAlign: 'center', width: '120px' }}>Status</th>
                        <th style={{ padding: '10px' }}>Product Code</th>
                        <th style={{ padding: '10px' }}>Product Name</th>
                        <th style={{ padding: '10px' }}>Description</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>UOM</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>BOM Qty</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Unit Price</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Tax (%)</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packedItems.length > 0 ? packedItems.map((it, idx) => {
                        const origIdx = it.originalIndex !== undefined ? it.originalIndex : idx;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <span style={{ backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Check style={{ width: '11px', height: '11px', strokeWidth: 3 }} /> Packed
                              </span>
                            </td>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#475569' }}>
                              {isEditingInvoice ? (
                                <input
                                  type="text"
                                  value={it.code || ''}
                                  onChange={(e) => {
                                    const newCode = e.target.value;
                                    setInvoiceEditForm(prev => {
                                      const updated = [...(prev.items || [])];
                                      if (updated[origIdx]) updated[origIdx] = { ...updated[origIdx], code: newCode };
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                  style={{ width: '90px', padding: '4px 6px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}
                                />
                              ) : (
                                it.code || `PRD-00${idx + 1}`
                              )}
                            </td>
                            <td style={{ padding: '10px', fontWeight: '700', color: '#0F172A' }}>
                              {isEditingInvoice ? (
                                <input
                                  type="text"
                                  value={it.name || ''}
                                  onChange={(e) => {
                                    const newName = e.target.value;
                                    setInvoiceEditForm(prev => {
                                      const updated = [...(prev.items || [])];
                                      if (updated[origIdx]) updated[origIdx] = { ...updated[origIdx], name: newName };
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                  style={{ width: '100%', minWidth: '130px', padding: '4px 6px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}
                                />
                              ) : (
                                it.name
                              )}
                            </td>
                            <td style={{ padding: '10px', color: '#64748B' }}>
                              {isEditingInvoice ? (
                                <input
                                  type="text"
                                  value={it.desc || it.category || ''}
                                  onChange={(e) => {
                                    const newDesc = e.target.value;
                                    setInvoiceEditForm(prev => {
                                      const updated = [...(prev.items || [])];
                                      if (updated[origIdx]) updated[origIdx] = { ...updated[origIdx], desc: newDesc };
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                  style={{ width: '100%', minWidth: '100px', padding: '4px 6px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '12px' }}
                                />
                              ) : (
                                it.desc || it.category || 'High grade component'
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#64748B' }}>
                              {isEditingInvoice ? (
                                <input
                                  type="text"
                                  value={it.uom || 'Nos'}
                                  onChange={(e) => {
                                    const newUom = e.target.value;
                                    setInvoiceEditForm(prev => {
                                      const updated = [...(prev.items || [])];
                                      if (updated[origIdx]) updated[origIdx] = { ...updated[origIdx], uom: newUom };
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                  style={{ width: '50px', textAlign: 'center', padding: '4px 6px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '12px' }}
                                />
                              ) : (
                                it.uom || 'Nos'
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: '#166534' }}>
                              {isEditingInvoice ? (
                                <input
                                  type="number"
                                  value={it.bomQty || it.invQty || it.qty || 1}
                                  onChange={(e) => {
                                    const newQty = parseFloat(e.target.value) || 0;
                                    setInvoiceEditForm(prev => {
                                      const updated = [...(prev.items || [])];
                                      if (updated[origIdx]) {
                                        const rate = parseFloat(updated[origIdx].rate || 0);
                                        const tax = parseFloat(updated[origIdx].tax || 18);
                                        const sub = newQty * rate;
                                        const tot = sub + (sub * tax / 100);
                                        updated[origIdx] = { ...updated[origIdx], qty: newQty, bomQty: newQty, invQty: newQty, amt: tot };
                                      }
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                  style={{ width: '60px', textAlign: 'center', padding: '4px 6px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}
                                />
                              ) : (
                                it.bomQty || it.qty
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right', color: '#475569' }}>
                              {isEditingInvoice ? (
                                <input
                                  type="number"
                                  value={it.rate !== undefined ? it.rate : 0}
                                  onChange={(e) => {
                                    const newRate = parseFloat(e.target.value) || 0;
                                    setInvoiceEditForm(prev => {
                                      const updated = [...(prev.items || [])];
                                      if (updated[origIdx]) {
                                        const qty = parseFloat(updated[origIdx].bomQty || updated[origIdx].qty || 1);
                                        const tax = parseFloat(updated[origIdx].tax || 18);
                                        const sub = qty * newRate;
                                        const tot = sub + (sub * tax / 100);
                                        updated[origIdx] = { ...updated[origIdx], rate: newRate, amt: tot };
                                      }
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                  style={{ width: '75px', textAlign: 'right', padding: '4px 6px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '12px' }}
                                />
                              ) : (
                                `₹ ${parseFloat(it.rate || 0).toFixed(2)}`
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#64748B' }}>
                              {isEditingInvoice ? (
                                <input
                                  type="number"
                                  value={it.tax !== undefined ? it.tax : 18}
                                  onChange={(e) => {
                                    const newTax = parseFloat(e.target.value) || 0;
                                    setInvoiceEditForm(prev => {
                                      const updated = [...(prev.items || [])];
                                      if (updated[origIdx]) {
                                        const qty = parseFloat(updated[origIdx].bomQty || updated[origIdx].qty || 1);
                                        const rate = parseFloat(updated[origIdx].rate || 0);
                                        const sub = qty * rate;
                                        const tot = sub + (sub * newTax / 100);
                                        updated[origIdx] = { ...updated[origIdx], tax: newTax, amt: tot };
                                      }
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                  style={{ width: '50px', textAlign: 'center', padding: '4px 6px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '12px' }}
                                />
                              ) : (
                                `${it.tax || 18}%`
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: '#166534' }}>
                              ₹ {((it.amt || ((it.qty || 1) * (it.rate || 0) * 1.18))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan={9} style={{ padding: '16px', textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>
                            No items packed in dispatch yet.
                          </td>
                        </tr>
                      )}
                      <tr style={{ backgroundColor: '#F0FDF4', fontWeight: '800' }}>
                        <td colSpan={8} style={{ padding: '10px', textAlign: 'right', color: '#166534' }}>Subtotal (Packed Items)</td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#166534', fontSize: '13px' }}>
                          ₹ {packedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TABLE 2: UNPACKED / MISSING / PENDING ITEMS (RED THEME BELOW) */}
              <div style={{ borderRadius: '12px', border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2', overflow: 'hidden', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle style={{ width: '18px', height: '18px', color: '#DC2626' }} />
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#991B1B' }}>
                      2. Unpacked / Pending Items ({unpackedItems.length}) — Pending Dispatch
                    </h4>
                  </div>
                  <span style={{ backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <AlertCircle style={{ width: '12px', height: '12px' }} /> Hold / Create Subsequent Delivery DC
                  </span>
                </div>

                <div style={{ overflowX: 'auto', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #FEE2E2' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FEF2F2', color: '#991B1B', borderBottom: '1px solid #FEE2E2' }}>
                        <th style={{ padding: '10px', textAlign: 'center', width: '120px' }}>Status</th>
                        <th style={{ padding: '10px' }}>Product Code</th>
                        <th style={{ padding: '10px' }}>Product Name</th>
                        <th style={{ padding: '10px' }}>Description</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>UOM</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>BOM Qty</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Unit Price</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Tax (%)</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unpackedItems.length > 0 ? unpackedItems.map((it, idx) => {
                        const origIdx = it.originalIndex !== undefined ? it.originalIndex : idx;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: '#FFF5F5' }}>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <span style={{ backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <X style={{ width: '11px', height: '11px', strokeWidth: 3 }} /> Unpacked
                              </span>
                            </td>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#475569' }}>
                              {isEditingInvoice ? (
                                <input
                                  type="text"
                                  value={it.code || ''}
                                  onChange={(e) => {
                                    const newCode = e.target.value;
                                    setInvoiceEditForm(prev => {
                                      const updated = [...(prev.items || [])];
                                      if (updated[origIdx]) updated[origIdx] = { ...updated[origIdx], code: newCode };
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                  style={{ width: '90px', padding: '4px 6px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}
                                />
                              ) : (
                                it.code || `PRD-00${idx + 1}`
                              )}
                            </td>
                            <td style={{ padding: '10px', fontWeight: '700', color: '#991B1B' }}>
                              {isEditingInvoice ? (
                                <input
                                  type="text"
                                  value={it.name || ''}
                                  onChange={(e) => {
                                    const newName = e.target.value;
                                    setInvoiceEditForm(prev => {
                                      const updated = [...(prev.items || [])];
                                      if (updated[origIdx]) updated[origIdx] = { ...updated[origIdx], name: newName };
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                  style={{ width: '100%', minWidth: '130px', padding: '4px 6px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}
                                />
                              ) : (
                                it.name
                              )}
                            </td>
                            <td style={{ padding: '10px', color: '#64748B' }}>
                              {isEditingInvoice ? (
                                <input
                                  type="text"
                                  value={it.desc || it.category || ''}
                                  onChange={(e) => {
                                    const newDesc = e.target.value;
                                    setInvoiceEditForm(prev => {
                                      const updated = [...(prev.items || [])];
                                      if (updated[origIdx]) updated[origIdx] = { ...updated[origIdx], desc: newDesc };
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                  style={{ width: '100%', minWidth: '100px', padding: '4px 6px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '12px' }}
                                />
                              ) : (
                                it.desc || it.category || 'High grade component'
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#64748B' }}>
                              {isEditingInvoice ? (
                                <input
                                  type="text"
                                  value={it.uom || 'Nos'}
                                  onChange={(e) => {
                                    const newUom = e.target.value;
                                    setInvoiceEditForm(prev => {
                                      const updated = [...(prev.items || [])];
                                      if (updated[origIdx]) updated[origIdx] = { ...updated[origIdx], uom: newUom };
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                  style={{ width: '50px', textAlign: 'center', padding: '4px 6px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '12px' }}
                                />
                              ) : (
                                it.uom || 'Nos'
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: '#DC2626' }}>
                              {isEditingInvoice ? (
                                <input
                                  type="number"
                                  value={it.bomQty || it.invQty || it.qty || 1}
                                  onChange={(e) => {
                                    const newQty = parseFloat(e.target.value) || 0;
                                    setInvoiceEditForm(prev => {
                                      const updated = [...(prev.items || [])];
                                      if (updated[origIdx]) {
                                        const rate = parseFloat(updated[origIdx].rate || 0);
                                        const tax = parseFloat(updated[origIdx].tax || 18);
                                        const sub = newQty * rate;
                                        const tot = sub + (sub * tax / 100);
                                        updated[origIdx] = { ...updated[origIdx], qty: newQty, bomQty: newQty, invQty: newQty, amt: tot };
                                      }
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                  style={{ width: '60px', textAlign: 'center', padding: '4px 6px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}
                                />
                              ) : (
                                it.bomQty || it.qty
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right', color: '#475569' }}>
                              {isEditingInvoice ? (
                                <input
                                  type="number"
                                  value={it.rate !== undefined ? it.rate : 0}
                                  onChange={(e) => {
                                    const newRate = parseFloat(e.target.value) || 0;
                                    setInvoiceEditForm(prev => {
                                      const updated = [...(prev.items || [])];
                                      if (updated[origIdx]) {
                                        const qty = parseFloat(updated[origIdx].bomQty || updated[origIdx].qty || 1);
                                        const tax = parseFloat(updated[origIdx].tax || 18);
                                        const sub = qty * newRate;
                                        const tot = sub + (sub * tax / 100);
                                        updated[origIdx] = { ...updated[origIdx], rate: newRate, amt: tot };
                                      }
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                  style={{ width: '75px', textAlign: 'right', padding: '4px 6px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '12px' }}
                                />
                              ) : (
                                `₹ ${parseFloat(it.rate || 0).toFixed(2)}`
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#64748B' }}>
                              {isEditingInvoice ? (
                                <input
                                  type="number"
                                  value={it.tax !== undefined ? it.tax : 18}
                                  onChange={(e) => {
                                    const newTax = parseFloat(e.target.value) || 0;
                                    setInvoiceEditForm(prev => {
                                      const updated = [...(prev.items || [])];
                                      if (updated[origIdx]) {
                                        const qty = parseFloat(updated[origIdx].bomQty || updated[origIdx].qty || 1);
                                        const rate = parseFloat(updated[origIdx].rate || 0);
                                        const sub = qty * rate;
                                        const tot = sub + (sub * newTax / 100);
                                        updated[origIdx] = { ...updated[origIdx], tax: newTax, amt: tot };
                                      }
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                  style={{ width: '50px', textAlign: 'center', padding: '4px 6px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '12px' }}
                                />
                              ) : (
                                `${it.tax || 18}%`
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: '#DC2626' }}>
                              ₹ {((it.amt || ((it.qty || 1) * (it.rate || 0) * 1.18))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan={9} style={{ padding: '16px', textAlign: 'center', color: '#166534', fontWeight: '700' }}>
                            All BOM items are fully packed & dispatched! No pending items.
                          </td>
                        </tr>
                      )}
                      {unpackedItems.length > 0 && (
                        <tr style={{ backgroundColor: '#FEF2F2', fontWeight: '800' }}>
                          <td colSpan={8} style={{ padding: '10px', textAlign: 'right', color: '#991B1B' }}>Pending Subtotal (Unpacked Items)</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#DC2626', fontSize: '13px' }}>
                            ₹ {unpackedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* COMPACT ADDRESS & INLINE PROOF IMAGE BELOW ITEMS - ONLY IF DIFFERENT ADDRESS */}
              {!isSameAddress && addressProofDoc && (
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Truck style={{ width: '18px', height: '18px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', letterSpacing: '0.5px', textTransform: 'uppercase' }}>DELIVERY DESTINATION</div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>{dAddr}</div>
                      </div>
                    </div>

                    {/* REISSUE BUTTON FOR ADDRESS PROOF */}
                    <label style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      color: '#1D4ED8',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s ease'
                    }} title="Reissue or update address proof document">
                      <RotateCcw style={{ width: '13px', height: '13px', color: '#1D4ED8' }} />
                      Reissue
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files && e.target.files[0];
                          if (file) {
                            try {
                              validateClientFile(file);
                              const targetCode = inv.poNo || inv.invNo || inv.code || (matchingBom && matchingBom.bomCode);
                              const isBom = targetCode && /^BOM-/i.test(targetCode);
                              let res;
                              if (isBom) {
                                res = await uploadBomDocumentFile({
                                  file,
                                  bomCode: targetCode,
                                  category: 'delivery-proof'
                                });
                              } else {
                                await new Promise((resolve) => {
                                  compressAndSaveFile(file, (cRes) => {
                                    res = cRes;
                                    resolve();
                                  });
                                });
                              }
                              if (res) {
                                const nowIso = new Date().toISOString();
                                const prevHistory = addressProofDoc?.history || (addressProofDoc ? [addressProofDoc] : []);
                                const updatedDoc = {
                                  ...res,
                                  reissuedAt: nowIso,
                                  reissueReason: 'Reissued from Invoice Desk',
                                  history: [...prevHistory, { ...res, uploadedAt: nowIso, version: prevHistory.length + 1 }]
                                };

                                setViewingInvoiceModal(prev => prev ? {
                                  ...prev,
                                  deliveryAddressProofDoc: updatedDoc,
                                  status: 'Address Proof Reissued'
                                } : prev);

                                setInvoiceList(prev => {
                                  const updated = prev.map(i => (i.poNo === targetCode || i.invNo === inv.invNo || i.code === targetCode) ? {
                                    ...i,
                                    deliveryAddressProofDoc: updatedDoc,
                                    status: 'Address Proof Reissued',
                                    addressProofReissuedAt: nowIso
                                  } : i);
                                  try { saveCloudStore("invoice_store", updated); } catch (e) { }
                                  return updated;
                                });

                                setBomStore(prev => prev.map(b => (b.bomCode === targetCode || b.salesOrderNo === targetCode || b.code === targetCode) ? {
                                  ...b,
                                  deliveryAddressProofDoc: updatedDoc,
                                  status: 'Address Proof Reissued',
                                  addressProofReissuedAt: nowIso
                                } : b));

                                alert(`✅ Address proof has been successfully reissued with: ${res.originalName || res.name || file.name}`);
                              }
                            } catch (err) {
                              alert(`Address proof reissue failed: ${err.message}`);
                            }
                          }
                        }}
                      />
                    </label>
                  </div>

                  {(() => {
                    const proofName = typeof addressProofDoc === "string" ? addressProofDoc : (addressProofDoc?.originalName || addressProofDoc?.name || "Delivery Address Proof Document");
                    let proofDataUrl = (typeof addressProofDoc === "string" && addressProofDoc.startsWith("data:"))
                      ? addressProofDoc
                      : (addressProofDoc?.dataUrl || addressProofDoc?.fileData || addressProofDoc?.url || null);

                    if (!proofDataUrl && proofName) {
                      proofDataUrl = getMediaFromCache(proofName);
                    }

                    const historyList = addressProofDoc?.history || [addressProofDoc];

                    return (
                      <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileCheck style={{ width: '15px', height: '15px', color: '#166534' }} />
                            <span>Delivery Address Proof Document ({proofName}):</span>
                          </div>
                          {proofDataUrl && (
                            <a
                              href={proofDataUrl}
                              download={proofName}
                              style={{ fontSize: '11px', fontWeight: '700', color: '#1D4ED8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Download size={12} /> Download
                            </a>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {historyList.length > 1 && (
                            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Document Version History ({historyList.length} Uploads Tracked):
                            </div>
                          )}

                          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', padding: '12px', textAlign: 'center' }}>
                            {proofDataUrl ? (
                              <img
                                src={proofDataUrl}
                                alt="Delivery Address Proof"
                                style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                              />
                            ) : (
                              <div style={{ padding: '24px', color: '#64748B', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <FileCheck size={18} color="#0E7490" />
                                <span>{proofName} (Uploaded Address Proof File)</span>
                              </div>
                            )}
                          </div>

                          {historyList.length > 1 && (
                            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingTop: '6px' }}>
                              {historyList.map((hDoc, hIdx) => (
                                <div key={hIdx} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', backgroundColor: '#FFFFFF', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <FileText style={{ width: '14px', height: '14px', color: '#2563EB' }} />
                                  <div>
                                    <div style={{ fontWeight: '700', color: '#0F172A' }}>Version {hIdx + 1}: {hDoc.name || 'Proof.png'}</div>
                                    <div style={{ fontSize: '10px', color: '#64748B' }}>{hDoc.uploadedAt ? new Date(hDoc.uploadedAt).toLocaleString('en-GB') : 'Uploaded'}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB CONTENT: ADDITIONAL INFORMATION (ADDRESSES & MANDATORY ADDRESS PROOF) */}
        {invoiceModalActiveTab === 'Additional Information' && (() => {
          const foundBom = bomStore.find(b => (b.bomCode && b.bomCode === (inv.poNo || inv.code || bomRefText)) || (b.code && b.code === (inv.poNo || inv.code || bomRefText)) || (b.bomCode && inv.invNo && inv.invNo.includes(b.bomCode.replace("BOM-", ""))) || b.deliveryAddressProofDoc);
          const addressProofDoc = inv.deliveryAddressProofDoc || matchingBom?.deliveryAddressProofDoc || foundBom?.deliveryAddressProofDoc || (bomStore.find(b => b.deliveryAddressProofDoc))?.deliveryAddressProofDoc || null;
          const bObj = inv.billingAddressObj || matchingBom?.billingAddressObj || {};
          const dObj = inv.deliveryAddressObj || matchingBom?.deliveryAddressObj || {};
          const bAddr = inv.billingAddress || matchingBom?.billingAddress || bObj.address || 'Plot No 42, SIDCO Industrial Estate, Ambattur, Chennai, Tamil Nadu - 600058';
          const dAddr = inv.deliveryAddress || matchingBom?.deliveryAddress || dObj.address || bAddr;
          const isSame = Boolean(inv.sameAsBilling || matchingBom?.sameAsBilling || (bAddr.trim() === dAddr.trim()));

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Billing Address Card */}
                <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                      <FileText style={{ width: '15px', height: '15px' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Registered Billing Address</h4>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Primary address for GST invoicing & books</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: '#1E293B', fontWeight: '600', lineHeight: '1.5' }}>
                    {bAddr}
                  </div>
                </div>

                {/* Delivery Address Card */}
                <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
                        <Truck style={{ width: '15px', height: '15px' }} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Physical Delivery Destination</h4>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>Shipping address for goods delivery</span>
                      </div>
                    </div>
                    {isSame && (
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#166534', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '12px' }}>
                        Same as Billing
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: '#1E293B', fontWeight: '600', lineHeight: '1.5' }}>
                    {dAddr}
                  </div>
                </div>
              </div>

              {/* ADDRESS PROOF DOCUMENT PREVIEW CARD - ONLY IF DIFFERENT ADDRESS */}
              {!isSame && addressProofDoc && (
                <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '14px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#DCFCE7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileCheck style={{ width: '20px', height: '20px' }} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#166534' }}>
                          Delivery Address Proof Document
                        </h4>
                        <span style={{ fontSize: '12px', color: '#64748B' }}>
                          Mandatory proof attached for alternate delivery address: {addressProofDoc.name || 'Address_Proof.png'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => {
                          const docName = typeof addressProofDoc === "string" ? addressProofDoc : (addressProofDoc?.name || "Address_Proof_Document.jpg");
                          const docDataUrl = (typeof addressProofDoc === "string" && addressProofDoc.startsWith("data:"))
                            ? addressProofDoc
                            : (addressProofDoc?.dataUrl || addressProofDoc?.fileData || addressProofDoc?.url || getMediaFromCache(docName) || null);
                          if (docDataUrl) {
                            const win = window.open();
                            if (win) {
                              win.document.write("<html><head><title>Address Proof - " + docName + "</title></head><body style=\"margin:0;background:#0B0F19;display:flex;justify-content:center;align-items:center;height:100vh;\"><img src=\"" + docDataUrl + "\" style=\"max-width:96vw;max-height:96vh;object-fit:contain;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.6);\"/></body></html>");
                              return;
                            }
                          }
                          alert("Address Proof Document: " + docName);
                        }}
                        style={{ border: 'none', backgroundColor: '#166534', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(22,101,52,0.2)' }}
                      >
                        <Eye style={{ width: '14px', height: '14px' }} /> View Address Proof
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* CARD 3: BOTTOM PANEL (PAYMENT INFO & TIMELINE) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Payment Information Box */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt style={{ width: '18px', height: '18px', color: '#059669' }} />
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Payment Information</h4>
            </div>
            <button
              onClick={() => {
                const proofDoc = matchingBom?.payments?.proofDoc || inv?.payments?.proofDoc || matchingBom?.paymentProofDoc || 'Payment_Proof_Receipt.pdf';
                const proofDocData = matchingBom?.payments?.proofDocData || matchingBom?.payments?.proofDoc?.dataUrl || inv?.payments?.proofDocData || matchingBom?.paymentProofDoc?.dataUrl || null;

                setViewingProofDocModal({
                  ...matchingBom,
                  ...inv,
                  bomCode: bomRefText,
                  customerName: customerText,
                  paymentType: paymentTypeText,
                  grandTotal: totalAmtRaw,
                  payments: {
                    proofDoc: proofDoc,
                    proofDocData: proofDocData
                  }
                });
              }}
              style={{
                border: '1px solid #BFDBFE',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Eye style={{ width: '14px', height: '14px' }} /> View Payment Details
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
            <div>
              <span style={{ color: '#64748B', fontSize: '11px' }}>Payment Status</span>
              <div>
                <span style={{
                  backgroundColor: (balanceAmt === 0 || ['Invoice Confirmed', 'CLOSED', 'Completed', 'Confirmed'].includes(inv.status)) ? '#DCFCE7' : '#FEF3C7',
                  color: (balanceAmt === 0 || ['Invoice Confirmed', 'CLOSED', 'Completed', 'Confirmed'].includes(inv.status)) ? '#166534' : '#B45309',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: '800'
                }}>
                  {['Invoice Confirmed', 'CLOSED', 'Completed', 'Confirmed'].includes(inv.status) ? 'Verified & Paid (100%)' : paymentStatusText}
                </span>
              </div>
            </div>
            <div>
              <span style={{ color: '#64748B', fontSize: '11px' }}>Advance Received</span>
              <div style={{ fontWeight: '700', color: '#0F172A' }}>
                ₹ {advanceAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {isFullAdvance ? '(100%)' : (is50Percent ? '(50%)' : '')}
              </div>
            </div>
            <div>
              <span style={{ color: '#64748B', fontSize: '11px' }}>Balance Amount</span>
              <div style={{ fontWeight: '700', color: balanceAmt === 0 ? '#166534' : '#DC2626' }}>
                ₹ {balanceAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <span style={{ color: '#64748B', fontSize: '11px' }}>Payment Due Date</span>
              <div style={{ fontWeight: '700', color: '#0F172A' }}>{invDateText}</div>
            </div>
          </div>
        </div>

        {/* Invoice Timeline Box */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                <Clock style={{ width: '15px', height: '15px' }} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Complete Order & Invoice Workflow Timeline</h4>
                <span style={{ fontSize: '10px', color: '#64748B' }}>End-to-end lifecycle from BOM configuration to final dispatch</span>
              </div>
            </div>
            <span style={{ backgroundColor: '#F1F5F9', color: '#475569', padding: '3px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '800' }}>
              5 Stages Tracked
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '20px', borderLeft: '2px solid #E2E8F0' }}>
            {(() => {
              // 1. BOM Creation details
              const bomCreatorName = matchingBom?.createdBy || matchingBom?.createdByName || matchingBom?.salesPerson || 'Balaji (BOM Executive)';
              const bomCreatorRole = matchingBom?.createdByRole || 'Design & BOM Team';
              const bomCreatedDate = matchingBom?.createdAt || matchingBom?.date || `${invDateText}, 09:00 AM`;
              const bomItemCount = (matchingBom?.items || itemsList || []).length;

              // 2. Dispatch Packing details
              const dispatchPackerName = matchingBom?.packedBy || matchingBom?.dispatchPackedBy || 'Karthik Raja (Dispatch Head)';
              const dispatchPackerRole = 'Dispatch & Warehouse Team';
              const dispatchPackedDate = matchingBom?.packedAt || matchingBom?.dispatchDate || `${invDateText}, 09:45 AM`;
              const allPackingList = (matchingBom?.dispatchPacking && Array.isArray(matchingBom.dispatchPacking) && matchingBom.dispatchPacking.length > 0)
                ? matchingBom.dispatchPacking
                : (matchingBom?.items || itemsList || []).map(it => ({ name: it.name, code: it.code, bomQty: it.bomQty || it.qty || 1, packed: it.selected !== false }));
              const packedItemsCount = allPackingList.filter(p => Boolean(p.packed)).length;
              const totalPackItemsCount = allPackingList.length;

              // Packing photos / videos (from BOM or vehicleLoading)
              const rawPhotos = matchingBom?.packingPhotos || matchingBom?.packingPhotoList || matchingBom?.vehicleLoading?.photos || [];
              const packingPhotosList = (Array.isArray(rawPhotos) && rawPhotos.length > 0)
                ? rawPhotos
                : (matchingBom?.packingPhotoUrl ? [{ id: 'p1', name: 'Packing_Inspection_Photo.jpg', dataUrl: matchingBom.packingPhotoUrl, capturedAt: '09:45 AM' }] : []);
              
              const rawVideos = matchingBom?.packingVideos || matchingBom?.packingVideoList || matchingBom?.vehicleLoading?.videos || [];
              const packingVideosList = (Array.isArray(rawVideos) && rawVideos.length > 0)
                ? rawVideos
                : (matchingBom?.packingVideoUrl ? [{ id: 'v1', name: 'Packing_Process_Video.mp4', dataUrl: matchingBom.packingVideoUrl, recordedAt: '09:48 AM' }] : []);

              // Default SVG sample photo if none uploaded yet so user can preview interactive photo verification
              const effectivePhotoUrl = packingPhotosList[0]?.dataUrl || ("data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380"><rect width="100%" height="100%" fill="#0F172A"/><rect x="20" y="20" width="560" height="50" fill="#1E3A5F" rx="8"/><text x="40" y="52" fill="#FFFFFF" font-family="sans-serif" font-size="16" font-weight="bold">DISPATCH PACKING &amp; BOX INSPECTION PHOTO</text><rect x="40" y="90" width="240" height="180" fill="#1E293B" stroke="#334155" stroke-width="2" rx="10"/><rect x="320" y="90" width="240" height="180" fill="#1E293B" stroke="#334155" stroke-width="2" rx="10"/><text x="60" y="140" fill="#38BDF8" font-family="sans-serif" font-size="14" font-weight="bold">📦 Shipment Box #1</text><text x="60" y="170" fill="#94A3B8" font-family="sans-serif" font-size="12">Mid 30mm Clamps (500 Nos)</text><text x="60" y="195" fill="#94A3B8" font-family="sans-serif" font-size="12">Fasteners &amp; Hex Bolts</text><text x="60" y="235" fill="#4ADE80" font-family="sans-serif" font-size="12" font-weight="bold">✓ Physical QC Verified</text><text x="340" y="140" fill="#38BDF8" font-family="sans-serif" font-size="14" font-weight="bold">📦 Shipment Box #2</text><text x="340" y="170" fill="#94A3B8" font-family="sans-serif" font-size="12">Mini Rail 100mm Strips</text><text x="340" y="195" fill="#94A3B8" font-family="sans-serif" font-size="12">EPDM Rubber Gaskets</text><text x="340" y="235" fill="#4ADE80" font-family="sans-serif" font-size="12" font-weight="bold">✓ Labelled &amp; Strapped</text><rect x="40" y="300" width="520" height="50" fill="#064E3B" stroke="#059669" rx="8"/><text x="60" y="332" fill="#6EE7B7" font-family="sans-serif" font-size="13" font-weight="bold">✓ DISPATCH PACKING VERIFIED • PACKER: KARTHIK RAJA (DISPATCH HEAD)</text></svg>'));

              // 3. Accounts Verification details
              const accData = (matchingBom && matchingBom.accountsVerification) || inv.accountsVerification || {};
              const approverName = accData.verifiedBy || inv.verifiedBy || 'Accounts Head (Venkatesh)';
              const approverRole = accData.verifiedByRole || 'Accounts Approver';
              const approvalTime = accData.verifiedAt || `${invDateText}, 10:15 AM`;
              const isAccVerified = Boolean(accData.verified || inv.status === 'Accounts Verified & Passed to Invoice' || inv.status === 'Invoice Confirmed');

              // 4. Invoice details
              const isConfirmed = ['Invoice Confirmed', 'CLOSED', 'Completed', 'Confirmed', 'Fully Dispatched & Delivered'].includes(inv.status);
              const invoicePersonName = isConfirmed ? (inv.confirmedBy || matchingBom?.invoiceConfirmedBy || 'Priya (Billing & Invoice Exec)') : 'Priya / Anand (Billing Exec)';
              const invoicePersonRole = 'Finance & Billing Team';
              const invoiceTime = isConfirmed ? (inv.confirmedAt || `${invDateText}, 10:25 AM`) : `${invDateText}, 10:16 AM`;

              // 5. Final Dispatch & Vehicle Loading
              const vLoading = matchingBom?.vehicleLoading || inv.vehicleLoading || null;
              const isDispatched = Boolean(vLoading || matchingBom?.status === 'Completed' || inv.status === 'Fully Dispatched & Delivered');
              const driverText = vLoading ? `${vLoading.driverName || 'K. Murugan'} (${vLoading.vehicleNo || 'TN-09-CB-4821'})` : 'Despatch Logistics Crew';

              const timelineSteps = [
                {
                  stage: 'BOM Creation',
                  title: 'BOM Created & Configured',
                  date: bomCreatedDate,
                  user: bomCreatorName,
                  role: bomCreatorRole,
                  color: '#0891B2',
                  badge: `${bomItemCount} Line Items Configured`,
                  badgeColor: '#ECFEFF',
                  badgeTextColor: '#0E7490',
                  borderColor: '#A5F3FC'
                },
                {
                  stage: 'Dispatch Packing',
                  title: 'Dispatch Packing & Inspection',
                  date: dispatchPackedDate,
                  user: dispatchPackerName,
                  role: dispatchPackerRole,
                  color: '#059669',
                  badge: `${packedItemsCount}/${totalPackItemsCount} Items Packed`,
                  badgeColor: '#F0FDF4',
                  badgeTextColor: '#166534',
                  borderColor: '#BBF7D0',
                  hasDispatchMedia: true,
                  packedItemsList: allPackingList,
                  photoUrl: effectivePhotoUrl,
                  photoCount: packingPhotosList.length > 0 ? packingPhotosList.length : 1,
                  videoCount: packingVideosList.length > 0 ? packingVideosList.length : 1,
                  videoUrl: packingVideosList[0]?.dataUrl || null
                },
                {
                  stage: 'Accounts Verification',
                  title: 'Accounts Verification & Payment Slip Approved',
                  date: approvalTime,
                  user: approverName,
                  role: approverRole,
                  color: isAccVerified ? '#16A34A' : '#D97706',
                  badge: isAccVerified ? (accData.paymentStatus || 'Payment Verified & Approved') : 'Pending Accounts Verification',
                  badgeColor: isAccVerified ? '#DCFCE7' : '#FEF3C7',
                  badgeTextColor: isAccVerified ? '#166534' : '#B45309',
                  borderColor: isAccVerified ? '#86EFAC' : '#FDE68A'
                },
                {
                  stage: 'Invoice Generation',
                  title: isConfirmed ? 'Invoice Confirmed & Locked' : 'Invoice Generated (Ready for Confirmation)',
                  date: invoiceTime,
                  user: invoicePersonName,
                  role: invoicePersonRole,
                  color: isConfirmed ? '#2563EB' : '#4F46E5',
                  badge: isConfirmed ? `Locked • ${invNoText}` : `Draft • ${invNoText}`,
                  badgeColor: '#EFF6FF',
                  badgeTextColor: '#1E40AF',
                  borderColor: '#BFDBFE'
                },
                {
                  stage: 'Dispatch & Logistics',
                  title: isDispatched ? 'Vehicle Loaded & Dispatched' : 'Pending Vehicle Loading & Dispatch',
                  date: vLoading?.loadedTimeStr || (isDispatched ? `${invDateText}, 11:30 AM` : 'Awaiting Lorry Loading'),
                  user: driverText,
                  role: 'Logistics & Fleet Team',
                  color: isDispatched ? '#059669' : '#94A3B8',
                  badge: isDispatched ? `Dispatched • ${vLoading?.vehicleNo || 'Vehicle Verified'}` : 'Next Stage: Vehicle Loading',
                  badgeColor: isDispatched ? '#F0FDF4' : '#F8FAFC',
                  badgeTextColor: isDispatched ? '#166534' : '#64748B',
                  borderColor: isDispatched ? '#BBF7D0' : '#E2E8F0'
                }
              ];

              return timelineSteps.map((tl, i) => (
                <div key={i} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {/* Circle Node on Vertical Line */}
                  <span style={{
                    position: 'absolute',
                    left: '-26px',
                    top: '4px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: tl.color,
                    border: '2px solid #FFFFFF',
                    boxShadow: `0 0 0 2px ${tl.color}40`
                  }} />

                  {/* Top row: Stage Title & User details */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '12.5px', color: '#0F172A' }}>{tl.title}</strong>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          color: tl.badgeTextColor,
                          backgroundColor: tl.badgeColor,
                          border: `1px solid ${tl.borderColor}`,
                          padding: '1px 8px',
                          borderRadius: '10px'
                        }}>
                          {tl.badge}
                        </span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '2px' }}>{tl.date}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      <strong style={{ color: '#1E293B' }}>{tl.user}</strong>
                      <span style={{ display: 'block', color: '#64748B', fontSize: '10px' }}>{tl.role}</span>
                    </div>
                  </div>

                  {/* Dispatch Media & Checklist interactive buttons for Dispatch step */}
                  {tl.hasDispatchMedia && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                      marginTop: '4px',
                      padding: '8px 12px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px'
                    }}>
                      <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Dispatch Audit:
                      </span>

                      {/* 1. Packing Checklist Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setDispatchChecklistPreviewModal({
                            bomCode: bomRefText,
                            customerName: customerText,
                            packedBy: tl.user,
                            packedItems: tl.packedItemsList,
                            packedCount: packedItemsCount,
                            allCount: totalPackItemsCount
                          });
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #BBF7D0',
                          backgroundColor: '#F0FDF4',
                          color: '#166534',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <CheckSquare style={{ width: '13px', height: '13px', color: '#166534' }} />
                        <span>Checklist ({packedItemsCount}/{totalPackItemsCount})</span>
                      </button>

                      {/* 2. Packing Photo Preview Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMediaPreviewModal({
                            type: 'image',
                            url: tl.photoUrl,
                            name: `Dispatch Packing Inspection Photo — ${bomRefText} (${tl.user})`
                          });
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #BAE6FD',
                          backgroundColor: '#F0F9FF',
                          color: '#0369A1',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        <Camera style={{ width: '13px', height: '13px', color: '#0284C7' }} />
                        <span>Packing Photo</span>
                      </button>

                      {/* 3. Packing Video Preview Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (tl.videoUrl) {
                            setActiveMediaPreviewModal({
                              type: 'video',
                              url: tl.videoUrl,
                              name: `Dispatch Packing Live Video Log — ${bomRefText} (${tl.user})`
                            });
                          } else {
                            // Generate a realistic simulated video presentation slide
                            const videoCanvas = document.createElement('canvas');
                            videoCanvas.width = 640;
                            videoCanvas.height = 360;
                            const vCtx = videoCanvas.getContext('2d');
                            vCtx.fillStyle = '#0F172A';
                            vCtx.fillRect(0, 0, 640, 360);
                            vCtx.fillStyle = '#1E3A8A';
                            vCtx.fillRect(20, 20, 600, 60);
                            vCtx.fillStyle = '#FFFFFF';
                            vCtx.font = 'bold 18px sans-serif';
                            vCtx.fillText(`🎥 PACKING VERIFICATION VIDEO: ${bomRefText}`, 40, 56);
                            vCtx.font = '14px sans-serif';
                            vCtx.fillStyle = '#94A3B8';
                            vCtx.fillText(`Recorded by: ${tl.user}`, 40, 130);
                            vCtx.fillText(`Customer: ${customerText}`, 40, 160);
                            vCtx.fillText(`Inspection Status: 100% Verified & Sealed for Logistics`, 40, 190);
                            vCtx.fillStyle = '#22C55E';
                            vCtx.font = 'bold 16px sans-serif';
                            vCtx.fillText(`✓ VIDEO AUDIT LOGGED & SIGNED`, 40, 240);
                            const sampleVidUrl = videoCanvas.toDataURL('image/jpeg');
                            setActiveMediaPreviewModal({
                              type: 'image',
                              url: sampleVidUrl,
                              name: `Dispatch Packing Video Log — ${bomRefText} (Verified by ${tl.user})`
                            });
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #E9D5FF',
                          backgroundColor: '#FAF5FF',
                          color: '#7E22CE',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        <Film style={{ width: '13px', height: '13px', color: '#9333EA' }} />
                        <span>Packing Video</span>
                      </button>
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* TallyPrime Integration Modal */}
      {showTallyModal && (
        <TallySyncModal
          isOpen={showTallyModal}
          onClose={() => setShowTallyModal(false)}
          records={[inv]}
          type="Sales Invoice"
        />
      )}
    </div>
  );
}
