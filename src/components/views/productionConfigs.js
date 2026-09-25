import { prodModuleEngine } from '../../utils/productionModuleEngine';
import { formatCurrency } from '../../utils/otherViewsShared';

export function buildProductionConfigs({ bomStore = [], visibleBomStore: passedVisibleBom = null, invoiceList = [], customerList = [] }) {
  const visibleBomStore = passedVisibleBom || bomStore || [];
          // Dynamically compute unified invoices list ensuring packed and Accounts-Verified BOMs show up in Invoice Management seamlessly
          const isInvoiceEligibleBom = (b) => {
            if (!b) return false;
            if (b.cancelled || b.status === 'Cancelled' || b.status === 'Cancelled & Stock Restored' || (typeof b.status === 'string' && b.status.toLowerCase().includes('cancel'))) return false;
            // Ignore mock/dummy test records with customer_name === 'Customer' and no real source PI
            if ((b.customerName === 'Customer' || b.vendor === 'Customer') && !b.sourcePiNo) return false;
            const s = String(b.status || '').toLowerCase().trim();
            const acc = b.accountsVerification || {};
            const isAccVerified = Boolean(
              acc.verified === true ||
              b.isAccountsDone === true ||
              s.includes('accounts verified') ||
              s.includes('passed to invoice') ||
              s.includes('ready for payment') ||
              b.invoiceConfirmed === true ||
              s.includes('invoice confirmed') ||
              Boolean(b.invoiceNo)
            );
            return isAccVerified;
          };

          const verifiedBomInvoices = (bomStore || [])
            .filter(isInvoiceEligibleBom)
            .map(b => {
              const bCode = b.bomCode || b.code || 'BOM-2026';
              const cleanNum = bCode.replace(/[^0-9]/g, '') || '101';
              const isConf = b.status === 'Invoice Confirmed' || b.status === 'Completed' || b.invoiceConfirmed;
              const invNo = b.invoiceNo || (isConf ? `INV-2026-${cleanNum}` : 'Pending Confirmation');
              const s = String(b.status || '').toLowerCase();
              const isAccDone = Boolean(b.accountsVerification?.verified || s.includes('accounts verified') || b.isAccountsDone);

              let statusVal = 'Ready for Invoicing';
              let payVal = 'Ready for Payment';
              if (isConf) {
                statusVal = 'Invoice Confirmed';
                payVal = 'Completed & Locked';
              } else if (isAccDone || s.includes('passed to invoice')) {
                statusVal = 'Accounts Verified & Passed to Invoice';
                payVal = 'Ready for Payment';
              } else if (s.includes('packed') || s.includes('ready for dispatch')) {
                statusVal = 'Packing Verified - Ready for Billing';
                payVal = 'Ready for Payment';
              }

              const packedItems = (b.dispatchPacking && Array.isArray(b.dispatchPacking) && b.dispatchPacking.length > 0)
                ? b.dispatchPacking.map((p, pIdx) => ({
                  code: p.code || `PRD-00${pIdx + 1}`,
                  name: p.name || `Item ${pIdx + 1}`,
                  qty: p.bomQty || p.qty || 1,
                  bomQty: p.bomQty || p.qty || 1,
                  invQty: p.bomQty || p.qty || 1,
                  rate: p.rate || 1000,
                  selected: Boolean(p.packed),
                  packed: Boolean(p.packed)
                }))
                : (b.items || []).map(it => ({ ...it, selected: true, packed: true }));

              const oVal = Number(b.grandTotal || b.subTotal || b.totalAmount || b.accountsVerification?.totalAmount || 0);

              return {
                invNo: invNo,
                code: invNo,
                date: b.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                vendor: b.customerName || b.companyName || b.customer || 'Customer',
                customerName: b.customerName || b.companyName || b.customer || 'Customer',
                poNo: bCode,
                bomCode: bCode,
                grnNo: 'GRN-VERIFIED',
                invAmt: `₹ ${oVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                poVal: `₹ ${oVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                grnVal: `₹ ${oVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                diff: '0.00', match: 'Matched',
                pay: payVal,
                status: statusVal,
                items: packedItems,
                dispatchPacking: b.dispatchPacking,
                billingAddress: b.billingAddress,
                billingAddressObj: b.billingAddressObj,
                deliveryAddress: b.deliveryAddress,
                deliveryAddressObj: b.deliveryAddressObj,
                deliveryAddressProofDoc: b.deliveryAddressProofDoc || null,
                sameAsBilling: b.sameAsBilling,
                accountsVerification: b.accountsVerification,
                proofDoc: b.proofDoc || b.payments?.proofDoc || b.paymentProofDoc?.name || 'Payment_Proof_Receipt.pdf',
                proofDocData: b.proofDocData || b.payments?.proofDocData || b.paymentProofDoc?.dataUrl || null,
                paymentProofDoc: b.paymentProofDoc || null
              };
            });

          const mergedInvoices = (invoiceList || []).filter(inv => {
            const matchingBom = (bomStore || []).find(b =>
              b.bomCode === inv.poNo ||
              b.code === inv.poNo ||
              b.bomCode === inv.code ||
              b.bomCode === inv.invNo ||
              (b.salesOrderNo && (b.salesOrderNo === inv.poNo || b.salesOrderNo === inv.c3))
            );
            if (matchingBom) {
              if (matchingBom.cancelled || matchingBom.status === 'Cancelled' || matchingBom.status === 'Cancelled & Stock Restored') return false;
              return isInvoiceEligibleBom(matchingBom);
            }
            // Standalone or pre-existing invoices stay visible
            if ((inv.customerName === 'Customer' || inv.vendor === 'Customer') && !inv.sourcePiNo) return false;
            return true;
          }).map(inv => {
            const matchingBom = (bomStore || []).find(b =>
              b.bomCode === inv.poNo ||
              b.code === inv.poNo ||
              b.bomCode === inv.code ||
              b.bomCode === inv.invNo ||
              (b.salesOrderNo && (b.salesOrderNo === inv.poNo || b.salesOrderNo === inv.c3))
            );
            if (matchingBom) {
              const isConf = matchingBom.status === 'Invoice Confirmed' || matchingBom.status === 'Completed' || matchingBom.invoiceConfirmed || inv.status === 'Invoice Confirmed';
              return {
                ...inv,
                vendor: inv.vendor || matchingBom.customerName || 'Customer',
                customerName: matchingBom.customerName || inv.vendor || 'Customer',
                billingAddress: inv.billingAddress || matchingBom.billingAddress,
                deliveryAddress: inv.deliveryAddress || matchingBom.deliveryAddress,
                deliveryAddressProofDoc: inv.deliveryAddressProofDoc || matchingBom.deliveryAddressProofDoc,
                accountsVerification: matchingBom.accountsVerification || inv.accountsVerification,
                status: isConf ? 'Invoice Confirmed' : (inv.status || 'Ready for Payment'),
                pay: isConf ? 'Completed & Locked' : (inv.pay || 'Ready for Payment'),
                items: (inv.items && inv.items.length > 0) ? inv.items : (matchingBom.dispatchPacking || matchingBom.items || [])
              };
            }
            return inv;
          });

          const missingVerified = verifiedBomInvoices.filter(v => {
            const vPo = (v.poNo || '').toLowerCase();
            const vInv = (v.invNo || '').toLowerCase();
            return !mergedInvoices.some(m =>
              (m.poNo && m.poNo.toLowerCase() === vPo) ||
              (m.bomCode && m.bomCode.toLowerCase() === vPo) ||
              (m.invNo && m.invNo.toLowerCase() === vInv) ||
              (m.code && m.code.toLowerCase() === vInv)
            );
          });

          const allInvoicesUnified = [...missingVerified, ...mergedInvoices].sort((a, b) => {
            const numA = parseInt((a.poNo || a.bomCode || a.invNo || '').replace(/[^0-9]/g, ''), 10) || 0;
            const numB = parseInt((b.poNo || b.bomCode || b.invNo || '').replace(/[^0-9]/g, ''), 10) || 0;
            return numB - numA;
          });

          // Domain-specific Page Configs for all Production Admin views using the Purchase Orders 5-part layout template
          const configs = {
            'Invoice Management': {
              title: 'Invoice Ledger & 3-Way Matching',
              subtitle: 'Verified Invoices, 3-Way Matching against BOM/PO/GRN, and payment ledger tracking',
              actionText: '',
              searchPlaceholder: 'Search Invoices (Invoice No, Customer / Vendor, BOM Ref)...',
              tabs: [
                { id: 'All', label: 'All Invoices', count: allInvoicesUnified.length, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Ready for Payment', label: 'Ready for Payment', count: allInvoicesUnified.filter(i => i.status !== 'Invoice Confirmed' && i.status !== 'On Hold' && i.pay !== 'Hold').length, bg: '#dcfce7', fg: '#166534' },
                { id: 'Invoice Confirmed', label: 'Confirmed', count: allInvoicesUnified.filter(i => i.status === 'Invoice Confirmed' || i.pay === 'Completed & Locked').length, bg: '#dcfce7', fg: '#166534' },
                { id: 'On Hold', label: 'On Hold', count: allInvoicesUnified.filter(i => i.status === 'On Hold' || i.pay === 'Hold').length, bg: '#fee2e2', fg: '#991b1b' }
              ],
              headers: ['Invoice No.', 'Customer / Vendor', 'BOM Ref', 'Invoice Date', 'Invoice Amount (₹)', 'Payment Status', 'Status'],
              rows: allInvoicesUnified.map(i => {
                const isConfirmed = i.status === 'Invoice Confirmed' || i.status === 'Completed' || i.status === 'Confirmed' || i.pay === 'Completed & Locked';
                const isReady = i.status === 'Ready for Payment' || i.status === 'Accounts Verified & Passed to Invoice' || i.status === 'Packing Verified - Ready for Billing' || i.status === 'Ready for Invoicing' || i.pay === 'Ready' || i.pay === 'Ready for Payment';

                return {
                  ...i,
                  code: i.invNo,
                  c2: i.vendor || i.customerName || 'Customer',
                  c3: i.poNo || i.bomCode || 'BOM-001',
                  c4: i.date,
                  c5: typeof i.invAmt === 'number' ? `₹ ${i.invAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : i.invAmt,
                  c6: i.pay || 'Ready for Payment',
                  status: i.status || 'Ready for Payment',
                  stBg: isConfirmed ? '#DCFCE7' : (isReady ? '#EFF6FF' : '#FEF3C7'),
                  stFg: isConfirmed ? '#166534' : (isReady ? '#2563EB' : '#B45309'),
                  stBorder: isConfirmed ? '1px solid #86EFAC' : (isReady ? '1px solid #BFDBFE' : '1px solid #FDE68A'),
                  tabGroup: isConfirmed ? 'Invoice Confirmed' : (isReady ? 'Ready for Payment' : 'On Hold')
                };
              })
            },
            'Accounts Verification': (() => {
              const isAccountsEligible = (b) => {
                if (!b) return false;
                if (b.cancelled || b.status === 'Cancelled' || b.status === 'Cancelled & Stock Restored' || (typeof b.status === 'string' && b.status.toLowerCase().includes('cancel'))) return false;
                const s = String(b.status || '').toLowerCase().trim();
                const isPacked = s.includes('packed') || s.includes('ready for dispatch') || s.includes('sent to accounts') || s.includes('awaiting dispatch') || s.includes('packing verified') || s.includes('awaiting accounts');
                const isAccDone = Boolean(b.accountsVerification?.verified || s.includes('accounts verified') || b.isAccountsDone);
                const isReadyForAccounts = Boolean(b.accountsVerification?.readyForAccounts);
                const isAllItemsPacked = Array.isArray(b.dispatchPacking) && b.dispatchPacking.length > 0 && b.dispatchPacking.every(p => Boolean(p.packed));
                const isPartiallyPacked = Array.isArray(b.dispatchPacking) && b.dispatchPacking.some(p => Boolean(p.packed));
                const isInvoiceOrLater = s.includes('invoice') || s.includes('loading') || s.includes('dispatched') || s.includes('delivered') || s.includes('completed') || s.includes('closed');
                return isPacked || isAccDone || isReadyForAccounts || isAllItemsPacked || isPartiallyPacked || isInvoiceOrLater || Boolean(b.pendingSalesDispatchPayment);
              };

              const isAccVerifiedOrder = (b) => {
                const acc = b?.accountsVerification || {};
                const s = String(b?.status || '').toLowerCase();
                return Boolean(
                  acc.verified ||
                  s.includes('accounts verified') ||
                  b?.isAccountsDone ||
                  (acc.paymentDate && acc.totalAmount && (acc.paymentStatus || b?.paymentType === 'Net 30 Days' || b?.paymentType === 'Credit Payment'))
                );
              };

              const allAccountsBoms = (bomStore || []).filter(isAccountsEligible).sort((a, b) => {
                const parseBomSeq = (code) => {
                  const m = String(code || '').match(/BOM-(\d+)/i);
                  return m ? parseInt(m[1], 10) : 0;
                };
                const seqA = parseBomSeq(a?.bomCode || a?.code || a?.id);
                const seqB = parseBomSeq(b?.bomCode || b?.code || b?.id);
                if (seqA !== seqB) return seqB - seqA;
                const dateA = new Date(a?.salesConfirmedAt || a?.date || a?.createdAt || 0).getTime() || 0;
                const dateB = new Date(b?.salesConfirmedAt || b?.date || b?.createdAt || 0).getTime() || 0;
                return dateB - dateA;
              });

              return {
                title: 'Accounts Verification & Document Control',
                subtitle: 'Verify customer payment details (Payment Date, Total Amount, Payment Status) and Hard Copy BOM receipt',
                actionText: '',
                searchPlaceholder: 'Search Accounts Verification (BOM Code, Customer Name)...',
                tabs: [
                  { id: 'All', label: 'All Accounts Orders', count: allAccountsBoms.length, bg: '#e2e8f0', fg: '#475569' },
                  { id: 'Pending', label: 'Pending Verification', count: allAccountsBoms.filter(b => !isAccVerifiedOrder(b)).length, bg: '#FEF3C7', fg: '#B45309' },
                  { id: 'Verified', label: 'Verified', count: allAccountsBoms.filter(b => isAccVerifiedOrder(b)).length, bg: '#DCFCE7', fg: '#166534' }
                ],
                headers: ['BOM Code', 'Customer Name', 'Payment Type', 'Payment Date', 'Total Amount', 'Payment Status', 'Status'],
                rows: allAccountsBoms.map(b => {
                  const acc = b.accountsVerification || {};
                  const isVerified = isAccVerifiedOrder(b);
                  const payStatus = acc.paymentStatus || (b.paymentType === 'Net 30 Days' || b.paymentType === 'Credit Payment' ? 'Credit Payment' : isVerified ? '100% Received' : 'Pending Confirmation');
                  
                  // Format Payment Date (should NOT be prefilled from createdAt/today if accounts haven't entered it)
                  const rawDate = acc.paymentDate || (isVerified ? (b.paymentDate || b.payments?.paymentDate || b.payments?.date) : null);
                  let paymentDateFormatted = '—';
                  if (rawDate) {
                    try {
                      const d = new Date(rawDate);
                      if (!isNaN(d.getTime())) {
                        paymentDateFormatted = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                      } else {
                        paymentDateFormatted = rawDate;
                      }
                    } catch (e) {
                      paymentDateFormatted = rawDate;
                    }
                  }

                  // Format Total Amount (should NOT be prefilled if accounts haven't verified/entered it)
                  let totalAmtFormatted = '—';
                  if (acc.totalAmount !== undefined && acc.totalAmount !== null && acc.totalAmount !== '') {
                    const val = parseFloat(acc.totalAmount) || 0;
                    totalAmtFormatted = `₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                  } else if (isVerified && b.grandTotal) {
                    const val = parseFloat(b.grandTotal) || 0;
                    totalAmtFormatted = `₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                  }

                  const statusText = isVerified ? 'ACCOUNTS VERIFIED' : 'PENDING VERIFICATION';
                  const stBg = isVerified ? '#DCFCE7' : '#FEF3C7';
                  const stFg = isVerified ? '#166534' : '#B45309';
                  const stBorder = isVerified ? '1px solid #BBF7D0' : '1px solid #FDE68A';
                  const tabGroup = isVerified ? 'Verified' : 'Pending';

                  return {
                    ...b,
                    code: b.bomCode,
                    c2: b.customerName,
                    c3: b.paymentType,
                    c4: paymentDateFormatted,
                    c5: totalAmtFormatted,
                    c6: payStatus,
                    packingProgressText: null,
                    status: statusText,
                    stBg: stBg,
                    stFg: stFg,
                    stBorder: stBorder,
                    isAccountsDone: isVerified,
                    tabGroup: tabGroup
                  };
                })
              };
            })(),
            'Dispatch Orders': {
              title: 'Dispatch & Packing Fulfillment Center',
              subtitle: 'Verify goods packing, track dispatch progress, and release shipments for approved Sales BOM orders',
              actionText: '',
              searchPlaceholder: 'Filter Dispatch Orders (BOM Code, Customer Name, Logistics)...',
              tabs: [
                { id: 'All', label: 'All Orders', count: (bomStore || []).filter(b => b && (b.status ? b.status !== 'Draft' : true)).length, bg: '#F1F5F9', fg: '#334155' },
                { id: 'PendingPacking', label: 'Pending Packing', count: (bomStore || []).filter(b => b && (b.status ? b.status !== 'Draft' : true) && !['Closed', 'CLOSED', 'Packed & Ready for Dispatch', 'Partially Packed', 'Awaiting Vehicle Loading & Dispatch', 'Completed', 'Fully Dispatched & Delivered', 'Dispatched - Awaiting LR Copy', 'Cancelled', 'Cancelled & Stock Restored'].includes(b.status) && !b.cancelled && !b.invoiceConfirmed).length, bg: '#FFEDD5', fg: '#C2410C' },
                { id: 'PartiallyPacked', label: 'Partially Packed', count: (bomStore || []).filter(b => (b.status === 'Partially Packed' || (b.dispatchPacking && b.dispatchPacking.some(p => p.packed) && !b.dispatchPacking.every(p => p.packed))) && !['Closed', 'CLOSED', 'Dispatched - Awaiting LR Copy', 'Cancelled', 'Cancelled & Stock Restored'].includes(b.status) && !b.cancelled).length, bg: '#FEF3C7', fg: '#B45309' },
                { id: 'Packed', label: 'Packing Verified', count: (bomStore || []).filter(b => (b.status === 'Packed & Ready for Dispatch' || b.status === 'Dispatch Packing Verified - Sent to Accounts' || (b.dispatchPacking && b.dispatchPacking.length > 0 && b.dispatchPacking.every(p => p.packed))) && !['Closed', 'CLOSED', 'Awaiting Vehicle Loading & Dispatch', 'Invoice Confirmed', 'Dispatched - Awaiting LR Copy', 'Cancelled', 'Cancelled & Stock Restored'].includes(b.status) && !b.cancelled && !b.invoiceConfirmed).length, bg: '#DCFCE7', fg: '#166534' },
                { id: 'AwaitingLoading', label: 'Awaiting Vehicle Loading', count: (bomStore || []).filter(b => (b.status === 'Awaiting Vehicle Loading & Dispatch' || b.status === 'Invoice Confirmed' || b.invoiceConfirmed || (b.invoiceNo && b.status !== 'Closed')) && !['Closed', 'CLOSED', 'Completed', 'Fully Dispatched & Delivered', 'Dispatched - Awaiting LR Copy', 'Cancelled', 'Cancelled & Stock Restored'].includes(b.status) && !b.cancelled).length, bg: '#DBEAFE', fg: '#1E40AF' },
                { id: 'AwaitingLrCopy', label: 'Awaiting LR Copy', count: (bomStore || []).filter(b => b && b.status === 'Dispatched - Awaiting LR Copy' && !b.cancelled).length, bg: '#FEF3C7', fg: '#B45309' },
                { id: 'Closed', label: 'Closed / Dispatched', count: (bomStore || []).filter(b => (b.status === 'Closed' || b.status === 'CLOSED' || b.status === 'Completed' || (b.fullyCompleted && b.status !== 'Dispatched - Awaiting LR Copy') || b.status === 'Fully Dispatched & Delivered') && !b.cancelled).length, bg: '#F1F5F9', fg: '#475569' },
                { id: 'Cancelled', label: 'Cancelled', count: (bomStore || []).filter(b => b && (b.status === 'Cancelled' || b.status === 'Cancelled & Stock Restored' || b.cancelled)).length, bg: '#FEE2E2', fg: '#DC2626' }
              ],
              headers: ['BOM Code', 'Customer Name', 'Sales Person', 'Payment Type', 'Total Amount', 'Dispatch Packing Status'],
              rows: (bomStore || []).filter(b => b && (b.status ? b.status !== 'Draft' : true)).sort((a, b) => {
                const parseBomSeq = (code) => {
                  const m = String(code || '').match(/BOM-(\d+)/i);
                  return m ? parseInt(m[1], 10) : 0;
                };
                const seqA = parseBomSeq(a?.bomCode || a?.code || a?.id);
                const seqB = parseBomSeq(b?.bomCode || b?.code || b?.id);
                if (seqA !== seqB) return seqB - seqA;
                const dateA = new Date(a?.salesConfirmedAt || a?.date || a?.createdAt || 0).getTime() || 0;
                const dateB = new Date(b?.salesConfirmedAt || b?.date || b?.createdAt || 0).getTime() || 0;
                return dateB - dateA;
              }).map(b => {
                const packedCount = (b.dispatchPacking || []).filter(p => p.packed).length;
                const totalItemsCount = (b.dispatchPacking || b.items || []).length;
                const isFullyPacked = totalItemsCount > 0 && packedCount === totalItemsCount;
                const isPartiallyPacked = packedCount > 0 && packedCount < totalItemsCount;
                const isAwaitingLr = b.status === 'Dispatched - Awaiting LR Copy';
                const isClosed = (b.status === 'Closed' || b.status === 'CLOSED' || b.status === 'Completed' || (b.fullyCompleted && !isAwaitingLr) || b.status === 'Fully Dispatched & Delivered') && !isAwaitingLr;
                const isCancelled = Boolean(b.cancelled || b.status === 'Cancelled' || b.status === 'Cancelled & Stock Restored');

                let statusLabel = 'PENDING DISPATCH PACKING';
                let stBg = '#FFF7ED';
                let stFg = '#C2410C';
                let stBorder = '1px solid #FED7AA';
                let tabGroup = 'PendingPacking';

                if (isCancelled) {
                  statusLabel = 'CANCELLED';
                  stBg = '#FEF2F2';
                  stFg = '#DC2626';
                  stBorder = '1px solid #FECACA';
                  tabGroup = 'Cancelled';
                } else if (isAwaitingLr) {
                  statusLabel = 'AWAITING LR COPY';
                  stBg = '#FFFBEB';
                  stFg = '#B45309';
                  stBorder = '1px solid #FCD34D';
                  tabGroup = 'AwaitingLrCopy';
                } else if (isClosed) {
                  statusLabel = 'COMPLETED & DISPATCHED';
                  stBg = '#DCFCE7';
                  stFg = '#166534';
                  stBorder = '1px solid #86EFAC';
                  tabGroup = 'Closed';
                } else if (b.status === 'Awaiting Vehicle Loading & Dispatch' || b.status === 'Invoice Confirmed' || b.invoiceConfirmed || (b.invoiceNo && !isClosed && !isAwaitingLr)) {
                  statusLabel = 'AWAITING VEHICLE LOADING';
                  stBg = '#DBEAFE';
                  stFg = '#1E40AF';
                  stBorder = '1px solid #93C5FD';
                  tabGroup = 'AwaitingLoading';
                } else if (isFullyPacked || b.status === 'Packed & Ready for Dispatch') {
                  statusLabel = 'PACKED & READY FOR DISPATCH';
                  stBg = '#DCFCE7';
                  stFg = '#166534';
                  stBorder = '1px solid #86EFAC';
                  tabGroup = 'Packed';
                } else if (isPartiallyPacked || b.status === 'Partially Packed') {
                  statusLabel = 'PARTIALLY PACKED';
                  stBg = '#FEF3C7';
                  stFg = '#B45309';
                  stBorder = '1px solid #FDE68A';
                  tabGroup = 'PartiallyPacked';
                } else if (b.status === 'Pending Sales Confirmation' || b.status === 'Pending Confirmation') {
                  statusLabel = 'PENDING SALES CONFIRMATION';
                  stBg = '#FEF3C7';
                  stFg = '#B45309';
                  stBorder = '1px solid #FDE68A';
                  tabGroup = 'PendingPacking';
                }

                const salesPersonName = (b.salesPerson || localStorage.getItem('controlroom_logged_user_name') || 'Mohith JV').replace(/\s*\([^)]*\)/g, '').trim();
                const totalAmt = b.grandTotal || b.subTotal || b.totalAmount || 0;
                const formattedAmt = `₹ ${Number(totalAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

                const rowObj = {
                  ...b,
                  code: b.bomCode,
                  c2: b.customerName,
                  salesPerson: salesPersonName,
                  c3: salesPersonName,
                  c4: b.paymentType || b.paymentTerms || '50% Advance + 50% Dispatch',
                  c5: formattedAmt,
                  packingProgressText: isCancelled ? `Cancelled (${b.cancellationReason || 'Stock Restored'})` : (isClosed ? `All ${totalItemsCount} Items Dispatched & Closed` : `${packedCount} of ${totalItemsCount} Items Packed`),
                  status: statusLabel,
                  stBg: stBg,
                  stFg: stFg,
                  stBorder: stBorder,
                  tabGroup: tabGroup
                };
                delete rowObj.c6;
                return rowObj;
              })
            },
            'Delivery Challans': (() => {
              let storedDcs = [];
              try {
                const rawDc = localStorage.getItem('controlroom_dc_store');
                if (rawDc) storedDcs = JSON.parse(rawDc);
              } catch (_) {}
              if (!Array.isArray(storedDcs)) storedDcs = [];

              if (storedDcs.length === 0) {
                storedDcs = [
                  {
                    dcNo: 'DC-2026-0001',
                    code: 'DC-2026-0001',
                    bomCode: 'BOM-977',
                    invNo: 'INV-000012',
                    customerName: 'Tata Power Solar Systems Ltd',
                    date: '24 Sept 2026',
                    vehicleNo: 'TN-09-CB-4890',
                    transporter: 'VRL Logistics Ltd.',
                    lrNo: 'LR-2026-9812',
                    mode: 'Road Transport',
                    status: 'IN TRANSIT',
                    totalValue: 35400.00,
                    itemCount: 1,
                    items: [
                      { code: 'MR100N', name: 'Mini Rail 100 mm (HDG)', uom: 'Nos', qty: 12, rate: 250, hsn: '76109090' }
                    ]
                  },
                  {
                    dcNo: 'DC-2026-0002',
                    code: 'DC-2026-0002',
                    bomCode: 'BOM-976',
                    invNo: 'INV-000011',
                    customerName: 'Adani Solar Energy',
                    date: '22 Sept 2026',
                    vehicleNo: 'KA-04-E-8821',
                    transporter: 'Gati KWE Express',
                    lrNo: 'LR-2026-9740',
                    mode: 'Road Transport',
                    status: 'DELIVERED',
                    totalValue: 18600.00,
                    itemCount: 2,
                    items: [
                      { code: 'MC30', name: 'Mid Clamp 30 mm (Anodized)', uom: 'Nos', qty: 40, rate: 65, hsn: '76109090' }
                    ]
                  }
                ];
                try {
                  localStorage.setItem('controlroom_dc_store', JSON.stringify(storedDcs));
                } catch (_) {}
              }

              const allDcs = storedDcs;
              return {
                title: 'Delivery Challan Ledger (Rule 55 CGST)',
                subtitle: 'Statutory Delivery Challans issued for partial dispatches, job work, and goods transit under Rule 55 of CGST Rules, 2017',
                actionText: '+ Create Delivery Challan',
                searchPlaceholder: 'Search Delivery Challans (DC No, Customer Name, Vehicle No, BOM)...',
                tabs: [
                  { id: 'All', label: 'All Delivery Challans', count: allDcs.length, bg: '#F1F5F9', fg: '#334155' },
                  { id: 'InTransit', label: 'In Transit', count: allDcs.filter(d => (d.status || '').toUpperCase().includes('TRANSIT') || d.status === 'Open').length, bg: '#FEF3C7', fg: '#B45309' },
                  { id: 'Delivered', label: 'Delivered & Closed', count: allDcs.filter(d => (d.status || '').toUpperCase().includes('DELIVER') || (d.status || '').toUpperCase().includes('CLOSED')).length, bg: '#DCFCE7', fg: '#166534' }
                ],
                headers: ['DC Number', 'BOM / Invoice Ref', 'Customer Name', 'Challan Date', 'Vehicle No.', 'Transporter', 'Challan Value', 'Status'],
                rows: allDcs.map(d => {
                  const isInTransit = (d.status || '').toUpperCase().includes('TRANSIT') || d.status === 'Open';
                  const isDelivered = (d.status || '').toUpperCase().includes('DELIVER') || (d.status || '').toUpperCase().includes('CLOSED');
                  const val = typeof d.totalValue === 'number' ? d.totalValue : (parseFloat(String(d.totalValue || '0').replace(/[^0-9.]/g, '')) || 0);

                  return {
                    ...d,
                    code: d.dcNo || d.code,
                    c2: `${d.bomCode || 'BOM'} (${d.invNo || 'INV'})`,
                    c3: d.customerName || d.vendor || 'Customer',
                    c4: d.date || new Date().toLocaleDateString('en-GB'),
                    c5: d.vehicleNo || '—',
                    c6: d.transporter || 'Direct Transport',
                    c7: `₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                    status: d.status || (isInTransit ? 'IN TRANSIT' : 'DELIVERED'),
                    stBg: isInTransit ? '#FEF3C7' : (isDelivered ? '#DCFCE7' : '#F1F5F9'),
                    stFg: isInTransit ? '#B45309' : (isDelivered ? '#166534' : '#475569'),
                    stBorder: isInTransit ? '1px solid #FDE68A' : (isDelivered ? '1px solid #86EFAC' : '1px solid #CBD5E1'),
                    tabGroup: isInTransit ? 'InTransit' : 'Delivered'
                  };
                })
              };
            })(),
            'Production Orders': {
              title: 'Production Orders (PO)',
              subtitle: 'Generate, tracking and dispatch management of corporate Production Orders',
              actionText: '+ Create PO',
              searchPlaceholder: 'Search Production Orders (PO No, Customer Name)...',
              tabs: [
                { id: 'All', label: 'All Orders', count: 49, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Draft', label: 'Draft / Pending Approval', count: 20, bg: '#fff7ed', fg: '#c2410c' },
                { id: 'Open', label: 'Approved (OPEN)', count: 27, bg: '#dcfce7', fg: '#166534' },
                { id: 'Partial', label: 'Open / Partially Received', count: 0, bg: '#fef3c7', fg: '#b45309' },
                { id: 'Closed', label: 'Closed / Fully Received', count: 2, bg: '#dcfce7', fg: '#15803d' },
                { id: 'Rejected', label: 'Rejected', count: 0, bg: '#fee2e2', fg: '#dc2626' }
              ],
              headers: ['PO No.', 'Customer / Vendor Name', 'PO Date', 'Expected Delivery', 'Total Quantity / Value', 'Status'],
              rows: [
                { code: 'PO-2026-081', c2: 'Vikram Solar Pvt Ltd', c3: '2026-08-11', c4: '2026-08-28', c5: '1,500 Nos (₹ 2,301.00)', status: 'OPEN', stBg: '#f0fdf4', stFg: '#15803d', stBorder: '1px solid #bbf7d0', tabGroup: 'Open' },
                { code: 'PO-2026-080', c2: 'Tata Power Renewable', c3: '2026-08-09', c4: '2026-08-24', c5: '600 Nos (₹ 69,62,000.00)', status: 'CLOSED / FULLY RECEIVED', stBg: '#f0fdf4', stFg: '#15803d', stBorder: '1px solid #bbf7d0', tabGroup: 'Closed' },
                { code: 'PO-2026-079', c2: 'Apex Infra Systems', c3: '2026-08-09', c4: '2026-08-17', c5: '1,300 Nos (₹ 5,56,960.00)', status: 'CLOSED / FULLY RECEIVED', stBg: '#f0fdf4', stFg: '#15803d', stBorder: '1px solid #bbf7d0', tabGroup: 'Closed' },
                { code: 'PO-2026-078', c2: 'Adani Solar Energy', c3: '2026-08-09', c4: '2026-08-18', c5: '400 Nos (₹ 5,56,960.00)', status: 'Draft', stBg: '#f1f5f9', stFg: '#475569', stBorder: '1px solid #cbd5e1', tabGroup: 'Draft' },
                { code: 'PO-2026-077', c2: 'Sterling & Wilson', c3: '2026-08-09', c4: '2026-08-19', c5: '280 Nos (₹ 5,56,960.00)', status: 'OPEN', stBg: '#f0fdf4', stFg: '#15803d', stBorder: '1px solid #bbf7d0', tabGroup: 'Open' },
                { code: 'PO-2026-076', c2: 'Waaree Energies Ltd', c3: '2026-08-10', c4: '2026-08-25', c5: '1,200 Nos (₹ 69,62,000.00)', status: 'OPEN', stBg: '#f0fdf4', stFg: '#15803d', stBorder: '1px solid #bbf7d0', tabGroup: 'Open' }
              ]
            },
            'Work Orders': {
              title: 'Work Orders & Shop Floor Execution',
              subtitle: 'Zoho Inventory synced manufacturing work orders and shop floor dispatch',
              actionText: '+ Create Work Order',
              searchPlaceholder: 'Search Work Orders (WO No, Product Name, Material)...',
              tabs: [
                { id: 'All', label: 'All Work Orders', count: (prodModuleEngine.getWorkOrders() || []).length, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Pending', label: 'Draft / Pending', count: (prodModuleEngine.getWorkOrders() || []).filter(w => w.status === 'Draft' || w.status === 'Pending').length, bg: '#fff7ed', fg: '#c2410c' },
                { id: 'InProgress', label: 'In Progress', count: (prodModuleEngine.getWorkOrders() || []).filter(w => w.status === 'In Progress' || w.status === 'RUNNING').length, bg: '#fef3c7', fg: '#b45309' },
                { id: 'Ready', label: 'Material Ready', count: (prodModuleEngine.getWorkOrders() || []).filter(w => w.status === 'Material Ready' || w.status === 'COMPLETED').length, bg: '#dcfce7', fg: '#166534' },
                { id: 'Overdue', label: 'Overdue Jobs', count: (prodModuleEngine.getWorkOrders() || []).filter(w => w.status === 'OVERDUE' || w.status === 'Overdue').length, bg: '#fee2e2', fg: '#dc2626' }
              ],
              headers: ['Work Order No.', 'Product Name', 'Raw Material Required', 'Planned Qty', 'Completed Qty', 'Warehouse Store', 'Status'],
              rows: (prodModuleEngine.getWorkOrders() || []).map(w => {
                const isOverdue = w.status === 'OVERDUE' || w.status === 'Overdue';
                const isInProgress = w.status === 'In Progress' || w.status === 'RUNNING';
                const isReady = w.status === 'Material Ready' || w.status === 'COMPLETED' || w.status === 'Closed';
                
                return {
                  ...w,
                  code: w.id || w.workOrderNo,
                  c2: w.finishedProductName || w.productName || 'Solar Mounting Rail',
                  c3: w.rawMaterialName || w.rawMaterial || 'Raw Alu Coil',
                  c4: `${(w.targetQty || w.plannedQty || 100).toLocaleString('en-IN')} Nos`,
                  c5: `${(w.completedQty || 0).toLocaleString('en-IN')} Nos`,
                  c6: w.productionLocation || w.warehouseStore || 'RM Store #1',
                  status: (w.status || 'IN PROGRESS').toUpperCase(),
                  stBg: isOverdue ? '#fee2e2' : (isInProgress ? '#ffedd5' : (isReady ? '#dcfce7' : '#f1f5f9')),
                  stFg: isOverdue ? '#dc2626' : (isInProgress ? '#ea580c' : (isReady ? '#166534' : '#475569')),
                  stBorder: isOverdue ? '1px solid #fca5a5' : (isInProgress ? '1px solid #fed7aa' : (isReady ? '1px solid #bbf7d0' : '1px solid #cbd5e1')),
                  tabGroup: isOverdue ? 'Overdue' : (isInProgress ? 'InProgress' : (isReady ? 'Ready' : 'Pending'))
                };
              })
            },
            'Planning & Scheduling': {
              title: 'Production Planning & Shift Scheduling',
              subtitle: 'Master production schedule, shift allocation, and capacity planning',
              actionText: '+ Add Schedule Shift',
              searchPlaceholder: 'Search Schedules (Schedule ID, Line Name, Shift Lead)...',
              tabs: [
                { id: 'All', label: 'All Schedules', count: 62, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Shift1', label: '1st Shift', count: 24, bg: '#dcfce7', fg: '#166534' },
                { id: 'Shift2', label: '2nd Shift', count: 22, bg: '#dbeafe', fg: '#1e40af' },
                { id: 'Shift3', label: '3rd Shift', count: 12, bg: '#f3e8ff', fg: '#6b21a8' },
                { id: 'Maint', label: 'Planned Maintenance', count: 4, bg: '#fee2e2', fg: '#dc2626' }
              ],
              headers: ['Shift / Schedule ID', 'Time Window', 'Assigned Line / Machine', 'Target Qty', 'Actual Produced', 'Shift Lead', 'Status'],
              rows: [
                { code: 'SCH-2026-01', c2: '06:00 AM - 02:00 PM', c3: 'CNC Cutting & Punching #1', c4: '2,640 Nos', c5: '2,438 Nos', c6: 'R. Karthik', status: 'COMPLETED', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'Shift1' },
                { code: 'SCH-2026-02', c2: '02:00 PM - 10:00 PM', c3: 'Roll Forming Line', c4: '2,640 Nos', c5: '2,424 Nos', c6: 'M. Arul', status: 'COMPLETED', stBg: '#dbeafe', stFg: '#1e40af', stBorder: '1px solid #bfdbfe', tabGroup: 'Shift2' },
                { code: 'SCH-2026-03', c2: '10:00 PM - 06:00 AM', c3: 'Maintenance & Tool Room', c4: '0 Nos (Setup)', c5: '0 Nos', c6: 'S. Praveen', status: 'MAINTENANCE', stBg: '#f3e8ff', stFg: '#6b21a8', stBorder: '1px solid #e9d5ff', tabGroup: 'Maint' }
              ]
            },
            'Production Monitoring': {
              title: 'Real-Time Production & Telemetry Monitoring',
              subtitle: 'Live shop floor machine telemetry, cycle speeds, and output tracking',
              actionText: 'Live Telemetry Active',
              searchPlaceholder: 'Search Machines (Line Code, Machine Name, Operator)...',
              tabs: [
                { id: 'All', label: 'All Lines', count: 8, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Running', label: 'Running Lines', count: 6, bg: '#dcfce7', fg: '#166534' },
                { id: 'Idle', label: 'Idle Lines', count: 1, bg: '#fef3c7', fg: '#b45309' },
                { id: 'Maint', label: 'Under Maintenance', count: 1, bg: '#fee2e2', fg: '#dc2626' }
              ],
              headers: ['Machine Line Code', 'Machine Name', 'Operating Speed', 'Today Output', 'Operator In-Charge', 'Power Rating', 'Status'],
              rows: [
                { code: 'LINE-A1', c2: 'CNC Cutting Machine', c3: '140 RPM', c4: '1,102 Nos', c5: 'R. Karthik', c6: '15 KW', status: 'RUNNING', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'Running' },
                { code: 'LINE-A2', c2: 'Punching Machine - 1', c3: '95 Strokes/min', c4: '912 Nos', c5: 'M. Arul', c6: '22 KW', status: 'RUNNING', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'Running' },
                { code: 'LINE-A3', c2: 'Punching Machine - 2', c3: '0 RPM', c4: '678 Nos', c5: 'S. Praveen', c6: '22 KW', status: 'MAINTENANCE', stBg: '#fee2e2', stFg: '#dc2626', stBorder: '1px solid #fca5a5', tabGroup: 'Maint' },
                { code: 'LINE-B1', c2: 'Drilling Machine', c3: '210 RPM', c4: '546 Nos', c5: 'K. Manoj', c6: '11 KW', status: 'RUNNING', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'Running' },
                { code: 'LINE-B2', c2: 'Tapping Machine', c3: '80 RPM', c4: '322 Nos', c5: 'P. Kumar', c6: '9 KW', status: 'IDLE', stBg: '#fef3c7', stFg: '#b45309', stBorder: '1px solid #fde68a', tabGroup: 'Idle' }
              ]
            },
            'Quality Control': {
              title: 'Quality Control & Inspection Audits',
              subtitle: 'Quality rejection certificates, inspection audits, and QC sign-offs',
              actionText: '+ Create QC Audit',
              searchPlaceholder: 'Search QC Audits (QC Cert No, Product Name, Inspector)...',
              tabs: [
                { id: 'All', label: 'All Audits', count: 124, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Approved', label: 'Approved Yield', count: 108, bg: '#dcfce7', fg: '#166534' },
                { id: 'Defects', label: 'Passed With Defect', count: 11, bg: '#fef3c7', fg: '#b45309' },
                { id: 'Pending', label: 'Pending Cert', count: 5, bg: '#fee2e2', fg: '#dc2626' }
              ],
              headers: ['QC Cert No.', 'Product Name', 'Inspected Qty', 'Passed Qty', 'Rejected Qty', 'Defect Category', 'Status'],
              rows: [
                { code: 'QC-2026-104', c2: 'Mini Rail 100 mm', c3: '1,456 Nos', c4: '1,402 Nos', c5: '54 Nos', c6: 'Dimensional Out', status: 'PASSED WITH DEFECTS', stBg: '#fef3c7', stFg: '#b45309', stBorder: '1px solid #fde68a', tabGroup: 'Defects' },
                { code: 'QC-2026-105', c2: 'Long Rail 3000 mm', c3: '566 Nos', c4: '538 Nos', c5: '28 Nos', c6: 'Surface Scratch', status: 'APPROVED', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'Approved' },
                { code: 'QC-2026-106', c2: 'Mid Clamp 35 mm', c3: '1,228 Nos', c4: '1,210 Nos', c5: '18 Nos', c6: 'Profile Bent', status: 'APPROVED', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'Approved' }
              ]
            },
            'Machine Maintenance': {
              title: 'Machine Maintenance & Overhauls',
              subtitle: 'Preventive maintenance schedule, breakdown logs, and tool room tasks',
              actionText: '+ Log Maintenance',
              searchPlaceholder: 'Search Maintenance (Job ID, Machine Name, Technician)...',
              tabs: [
                { id: 'All', label: 'All Jobs', count: 42, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Scheduled', label: 'Scheduled', count: 18, bg: '#dbeafe', fg: '#1e40af' },
                { id: 'InProgress', label: 'In Progress', count: 10, bg: '#ffedd5', fg: '#ea580c' },
                { id: 'Completed', label: 'Completed', count: 14, bg: '#dcfce7', fg: '#166534' }
              ],
              headers: ['Maint. Job ID', 'Machine Line', 'Task Description', 'Scheduled Date', 'Assigned Tech', 'Downtime (Hrs)', 'Status'],
              rows: [
                { code: 'MNT-2026-042', c2: 'Punching Machine - 2', c3: 'Hydraulic Hose Overhaul & Seal Replace', c4: '2026-08-26', c5: 'Mechanical Team', c6: '4.5 Hrs', status: 'IN PROGRESS', stBg: '#ffedd5', stFg: '#ea580c', stBorder: '1px solid #fed7aa', tabGroup: 'InProgress' },
                { code: 'MNT-2026-043', c2: 'CNC Cutting Machine', c3: 'Blade Alignment & Calibration', c4: '2026-08-30', c5: 'Tool Room Lead', c6: '1.2 Hrs', status: 'SCHEDULED', stBg: '#dbeafe', stFg: '#1e40af', stBorder: '1px solid #bfdbfe', tabGroup: 'Scheduled' },
                { code: 'MNT-2026-041', c2: 'Roll Forming Line', c3: 'Gearbox Lubrication & Belt Tensioning', c4: '2026-08-20', c5: 'Electrical Tech', c6: '2.0 Hrs', status: 'COMPLETED', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'Completed' }
              ]
            },
            'Inventory (Raw Material)': {
              title: 'Raw Material Inventory Stores & Stock Balances',
              subtitle: 'Raw aluminum coils, steel profiles, fasteners, and warehouse store balances',
              actionText: '+ Add Stock',
              searchPlaceholder: 'Search Inventory (Material Code, Description, Store)...',
              tabs: [
                { id: 'All', label: 'All Stock Items', count: 56, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Sufficient', label: 'Sufficient Stock', count: 42, bg: '#dcfce7', fg: '#166534' },
                { id: 'Warning', label: 'Reorder Warning', count: 10, bg: '#ffedd5', fg: '#ea580c' },
                { id: 'Critical', label: 'Critical Shortage', count: 4, bg: '#fee2e2', fg: '#dc2626' }
              ],
              headers: ['Material Code', 'Material Description', 'Current Stock', 'Safety Threshold', 'Unit Rate (₹)', 'Store Location', 'Status'],
              rows: [
                { code: 'RM-ALU-150', c2: 'Raw Aluminum Coil 1.5mm 6063-T6', c3: '4.2 Tons', c4: '5.0 Tons', c5: '₹ 2,45,000 / Ton', c6: 'RM Store #1', status: 'REORDER WARNING', stBg: '#ffedd5', stFg: '#ea580c', stBorder: '1px solid #fed7aa', tabGroup: 'Warning' },
                { code: 'RM-STL-300', c2: 'HDG Steel Profile Stock 3mm', c3: '12.8 Tons', c4: '6.0 Tons', c5: '₹ 78,000 / Ton', c6: 'RM Store #2', status: 'SUFFICIENT', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'Sufficient' },
                { code: 'RM-FST-035', c2: 'Alu Fastener Rod 35mm', c3: '8.5 Tons', c4: '4.0 Tons', c5: '₹ 1,85,000 / Ton', c6: 'RM Store #1', status: 'SUFFICIENT', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'Sufficient' }
              ]
            },
            'Sales BOM': {
              title: 'Sales Bill of Materials (BOM)',
              subtitle: 'Customer order BOMs, product specifications and sales quotations',
              actionText: '+ Create BOM',
              searchPlaceholder: 'Search Sales BOM (BOM Code, Customer Name, Product)...',
              tabs: [
                { id: 'All', label: 'All BOMs', count: (visibleBomStore || []).length, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Draft', label: 'Draft', count: (visibleBomStore || []).filter(b => b.status === 'Draft').length, bg: '#fff7ed', fg: '#c2410c' },
                { id: 'Pending', label: 'Pending Confirmation', count: (visibleBomStore || []).filter(b => !b.status || b.status.includes('Pending')).length, bg: '#fef3c7', fg: '#b45309' },
                { id: 'Sent', label: 'Sent to Production', count: (visibleBomStore || []).filter(b => b.status === 'Sent to Production' || b.status === 'Confirmed').length, bg: '#dcfce7', fg: '#166534' }
              ],
              headers: ['BOM Code', 'Date of Entry', 'Customer Name', 'Payment Type', 'Total (₹)', 'Status', 'Action'],
              rows: (visibleBomStore || []).map(b => ({
                ...b,
                code: b.bomCode || 'BOM-101',
                c2: b.date || new Date().toISOString().split('T')[0],
                c3: b.customerName || b.companyName || 'Customer Order',
                c4: b.paymentType || b.paymentTerms || '50% Advance + 50% Dispatch',
                c5: formatCurrency(b.grandTotal),
                status: b.status || 'Pending Confirmation',
                stBg: b.status === 'Draft' ? '#fff7ed' : (!b.status || b.status.includes('Pending')) ? '#fef3c7' : '#dcfce7',
                stFg: b.status === 'Draft' ? '#c2410c' : (!b.status || b.status.includes('Pending')) ? '#b45309' : '#166534',
                stBorder: b.status === 'Draft' ? '1px solid #fed7aa' : (!b.status || b.status.includes('Pending')) ? '1px solid #fde68a' : '1px solid #bbf7d0',
                tabGroup: b.status === 'Draft' ? 'Draft' : (!b.status || b.status.includes('Pending')) ? 'Pending' : 'Sent'
              }))
            },
            'BOM': {
              title: 'Bill of Materials (BOM)',
              subtitle: 'Standard raw material consumption lists and component requirements',
              actionText: '+ Create BOM',
              searchPlaceholder: 'Search BOM (BOM Code, Customer Name, Product)...',
              tabs: [
                { id: 'All', label: 'All BOMs', count: (visibleBomStore || []).length, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Draft', label: 'Draft', count: (visibleBomStore || []).filter(b => b.status === 'Draft').length, bg: '#fff7ed', fg: '#c2410c' },
                { id: 'Pending', label: 'Pending Confirmation', count: (visibleBomStore || []).filter(b => !b.status || b.status.includes('Pending')).length, bg: '#fef3c7', fg: '#b45309' },
                { id: 'Sent', label: 'Sent to Production', count: (visibleBomStore || []).filter(b => b.status === 'Sent to Production' || b.status === 'Confirmed').length, bg: '#dcfce7', fg: '#166534' }
              ],
              headers: ['BOM Code', 'Date of Entry', 'Customer Name', 'Payment Type', 'Total (₹)', 'Status', 'Action'],
              rows: (visibleBomStore || []).map(b => ({
                ...b,
                code: b.bomCode || 'BOM-101',
                c2: b.date || new Date().toISOString().split('T')[0],
                c3: b.customerName || b.companyName || 'Customer Order',
                c4: b.paymentType || b.paymentTerms || '50% Advance + 50% Dispatch',
                c5: formatCurrency(b.grandTotal),
                status: b.status || 'Pending Confirmation',
                stBg: b.status === 'Draft' ? '#fff7ed' : (!b.status || b.status.includes('Pending')) ? '#fef3c7' : '#dcfce7',
                stFg: b.status === 'Draft' ? '#c2410c' : (!b.status || b.status.includes('Pending')) ? '#b45309' : '#166534',
                stBorder: b.status === 'Draft' ? '1px solid #fed7aa' : (!b.status || b.status.includes('Pending')) ? '1px solid #fde68a' : '1px solid #bbf7d0',
                tabGroup: b.status === 'Draft' ? 'Draft' : (!b.status || b.status.includes('Pending')) ? 'Pending' : 'Sent'
              }))
            },
            'BOM Orders': {
              title: 'BOM Orders & Client Specifications',
              subtitle: 'Create and manage customer order BOMs, product specifications, and payment terms',
              actionText: '+ Create BOM',
              searchPlaceholder: 'Search BOM Orders (BOM Code, Customer Name, Product)...',
              tabs: [
                { id: 'All', label: 'All BOMs', count: (visibleBomStore || []).length, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Draft', label: 'Draft', count: (visibleBomStore || []).filter(b => b.status === 'Draft').length, bg: '#fff7ed', fg: '#c2410c' },
                { id: 'Pending', label: 'Pending Confirmation', count: (visibleBomStore || []).filter(b => !b.status || b.status.includes('Pending')).length, bg: '#fef3c7', fg: '#b45309' },
                { id: 'Sent', label: 'Sent to Production', count: (visibleBomStore || []).filter(b => b.status === 'Sent to Production' || b.status === 'Confirmed').length, bg: '#dcfce7', fg: '#166534' }
              ],
              headers: ['BOM Code', 'Date of Entry', 'Customer Name', 'Payment Type', 'Total (₹)', 'Status', 'Action'],
              rows: (visibleBomStore || []).map(b => ({
                ...b,
                code: b.bomCode || 'BOM-101',
                c2: b.date || new Date().toISOString().split('T')[0],
                c3: b.customerName || b.companyName || 'Customer Order',
                c4: b.paymentType || b.paymentTerms || '50% Advance + 50% Dispatch',
                c5: formatCurrency(b.grandTotal),
                status: b.status || 'Pending Confirmation',
                stBg: b.status === 'Draft' ? '#fff7ed' : (!b.status || b.status.includes('Pending')) ? '#fef3c7' : '#dcfce7',
                stFg: b.status === 'Draft' ? '#c2410c' : (!b.status || b.status.includes('Pending')) ? '#b45309' : '#166534',
                stBorder: b.status === 'Draft' ? '1px solid #fed7aa' : (!b.status || b.status.includes('Pending')) ? '1px solid #fde68a' : '1px solid #bbf7d0',
                tabGroup: b.status === 'Draft' ? 'Draft' : (!b.status || b.status.includes('Pending')) ? 'Pending' : 'Sent'
              }))
            },
            'Customer Management': {
              title: 'Customer Directory & Management',
              subtitle: 'Manage client directory, contact details, billing addresses, and order history',
              actionText: '+ Add New Customer',
              searchPlaceholder: 'Search Customers (Customer Name, Company, Email, Phone)...',
              tabs: [
                { id: 'All', label: 'All Customers', count: (customerList || []).length, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Active', label: 'Active Clients', count: (customerList || []).length, bg: '#dcfce7', fg: '#166534' },
                { id: 'Lead', label: 'New Leads', count: 0, bg: '#dbeafe', fg: '#1e40af' }
              ],
              headers: ['Customer Name', 'Company Name', 'GSTIN / Tax No.', 'Mobile / Phone', 'Email ID', 'Action'],
              rows: (customerList || []).map(c => ({
                ...c,
                code: c.code,
                c2: c.c2 || c.code,
                c3: c.gstNo || '33AABCU9603R1ZM',
                c4: c.c4 || c.mobile || '—',
                c5: c.c5 || c.email || '—'
              }))
            },
            'BOM / Routing': {
              title: 'Bill of Materials (BOM)',
              subtitle: 'Standard raw material consumption lists and component requirements',
              actionText: '+ Create BOM',
              searchPlaceholder: 'Search BOM (BOM Code, Customer Name, Product)...',
              tabs: [
                { id: 'All', label: 'All BOMs', count: (visibleBomStore || []).length, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Draft', label: 'Draft', count: (visibleBomStore || []).filter(b => b.status === 'Draft').length, bg: '#fff7ed', fg: '#c2410c' },
                { id: 'Pending', label: 'Pending Confirmation', count: (visibleBomStore || []).filter(b => !b.status || b.status.includes('Pending')).length, bg: '#fef3c7', fg: '#b45309' },
                { id: 'Sent', label: 'Sent to Production', count: (visibleBomStore || []).filter(b => b.status === 'Sent to Production' || b.status === 'Confirmed').length, bg: '#dcfce7', fg: '#166534' }
              ],
              headers: ['BOM Code', 'Date of Entry', 'Customer Name', 'Payment Type', 'Total (₹)', 'Status', 'Action'],
              rows: (visibleBomStore || []).map(b => ({
                ...b,
                code: b.bomCode || 'BOM-101',
                c2: b.date || new Date().toISOString().split('T')[0],
                c3: b.customerName || b.companyName || 'Customer Order',
                c4: b.paymentType || b.paymentTerms || '50% Advance + 50% Dispatch',
                c5: formatCurrency(b.grandTotal),
                status: b.status || 'Pending Confirmation',
                stBg: b.status === 'Draft' ? '#fff7ed' : (!b.status || b.status.includes('Pending')) ? '#fef3c7' : '#dcfce7',
                stFg: b.status === 'Draft' ? '#c2410c' : (!b.status || b.status.includes('Pending')) ? '#b45309' : '#166534',
                stBorder: b.status === 'Draft' ? '1px solid #fed7aa' : (!b.status || b.status.includes('Pending')) ? '1px solid #fde68a' : '1px solid #bbf7d0',
                tabGroup: b.status === 'Draft' ? 'Draft' : (!b.status || b.status.includes('Pending')) ? 'Pending' : 'Sent'
              }))
            },
            'Production Reports': {
              title: 'Production Reports & Shift Compilation',
              subtitle: 'Generate and export plant output, shift logs, and operational spreadsheets',
              actionText: 'Export Report',
              searchPlaceholder: 'Search Reports (Report ID, Shift Date, Supervisor)...',
              tabs: [
                { id: 'All', label: 'All Reports', count: 62, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Shift', label: 'Shift Output', count: 40, bg: '#dcfce7', fg: '#166534' },
                { id: 'QC', label: 'QC Audit Logs', count: 12, bg: '#dbeafe', fg: '#1e40af' },
                { id: 'Downtime', label: 'Downtime Logs', count: 10, bg: '#fee2e2', fg: '#dc2626' }
              ],
              headers: ['Report ID', 'Shift Date', 'Shift Name', 'Total Output', 'Rejections', 'Downtime', 'Status'],
              rows: [
                { code: 'RPT-2026-206', c2: '2026-08-11', c3: '1st Shift', c4: '744 Nos', c5: '5 Nos', c6: '0.5 Hrs', status: 'EXCEL (.XLSX)', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'Shift' },
                { code: 'RPT-2026-205', c2: '2026-08-10', c3: '2nd Shift', c4: '690 Nos', c5: '4 Nos', c6: '1.2 Hrs', status: 'EXCEL (.XLSX)', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'Shift' },
                { code: 'RPT-2026-204', c2: '2026-08-09', c3: '1st Shift', c4: '736 Nos', c5: '6 Nos', c6: '0.8 Hrs', status: 'PDF (.PDF)', stBg: '#dbeafe', stFg: '#1e40af', stBorder: '1px solid #bfdbfe', tabGroup: 'Shift' }
              ]
            },
            'Efficiency Reports': {
              title: 'Plant Efficiency & OEE Analytics Reports',
              subtitle: 'Overall Equipment Effectiveness (OEE), Availability, Performance, and Quality yield',
              actionText: 'Export OEE Report',
              searchPlaceholder: 'Search Machine Lines (Machine Name, Status Grade)...',
              tabs: [
                { id: 'All', label: 'All Lines', count: 8, bg: '#e2e8f0', fg: '#475569' },
                { id: 'GradeA', label: 'Grade A+ / A', count: 5, bg: '#dcfce7', fg: '#166534' },
                { id: 'GradeB', label: 'Grade B+ / B', count: 2, bg: '#fef3c7', fg: '#b45309' },
                { id: 'UnderTarget', label: 'Under Target', count: 1, bg: '#fee2e2', fg: '#dc2626' }
              ],
              headers: ['Machine Line', 'Availability %', 'Performance %', 'Quality %', 'OEE Score', 'Status Grade', 'Status'],
              rows: [
                { code: 'CNC Cutting Machine', c2: '94.1%', c3: '91.2%', c4: '98.2%', c5: '84.3%', c6: 'GRADE A', status: 'TARGET MET', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'GradeA' },
                { code: 'Punching Machine - 1', c2: '92.4%', c3: '88.5%', c4: '96.8%', c5: '79.2%', c6: 'GRADE A', status: 'TARGET MET', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'GradeA' },
                { code: 'Roll Forming Line', c2: '95.6%', c3: '94.0%', c4: '97.8%', c5: '87.9%', c6: 'GRADE A+', status: 'TARGET EXCEEDED', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'GradeA' }
              ]
            },
            'Downtime Analytics': {
              title: 'Downtime Analytics & Root Cause Breakdown',
              subtitle: 'Machine breakdown tracking, stoppage reason analysis, and downtime reduction',
              actionText: 'Log Downtime',
              searchPlaceholder: 'Search Downtime (Incident ID, Reason, Machine)...',
              tabs: [
                { id: 'All', label: 'All Incidents', count: 88, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Breakdown', label: 'Machine Breakdown', count: 35, bg: '#fee2e2', fg: '#dc2626' },
                { id: 'Material', label: 'Material Stoppage', count: 22, bg: '#ffedd5', fg: '#ea580c' },
                { id: 'Setup', label: 'Tool Setup', count: 18, bg: '#dbeafe', fg: '#1e40af' },
                { id: 'Resolved', label: 'Resolved Incidents', count: 75, bg: '#dcfce7', fg: '#166534' }
              ],
              headers: ['Incident ID', 'Stoppage Reason', 'Machine Line', 'Start Time', 'Duration (Hrs)', 'Root Cause', 'Status'],
              rows: [
                { code: 'DT-2026-88', c2: 'Machine Breakdown', c3: 'Punching Machine - 2', c4: '2026-08-10 10:30', c5: '4.5 Hrs', c6: 'Hydraulic Hose Failure', status: 'RESOLVED', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'Resolved' },
                { code: 'DT-2026-87', c2: 'Material Not Ready', c3: 'Mini Rail Line', c4: '2026-08-08 08:00', c5: '2.5 Hrs', c6: 'Raw Coil Crane Delay', status: 'RESOLVED', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'Resolved' },
                { code: 'DT-2026-86', c2: 'Tool Change / Setup', c3: 'CNC Cutting Machine', c4: '2026-08-07 14:00', c5: '1.5 Hrs', c6: 'Profile Die Swap', status: 'PLANNED', stBg: '#dbeafe', stFg: '#1e40af', stBorder: '1px solid #bfdbfe', tabGroup: 'Setup' }
              ]
            }
          };


  return configs;
}
