import React, { useState } from 'react';
import {
  X, CheckCircle, Clock, AlertCircle, FileText, Truck,
  Receipt, Factory, ShieldCheck, Download, Printer, User,
  Building2, CreditCard, ChevronRight, Eye, Layers, Package,
  ExternalLink, Calendar, MapPin, Phone, Hash
} from 'lucide-react';
import { formatCurrency, cleanNum } from '../../utils/otherViewsShared';

export default function ExecutiveOrderDossierModal({ order, onClose }) {
  if (!order) return null;

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'items' | 'documents'

  // Extract identifiers and amounts
  const orderCode = order.bomCode || order.code || order.orderId || order.id || 'BOM-ORDER';
  const piNumber = order.piNo || order.piNumber || order.proforma_invoice_number || '-';
  const invoiceNumber = order.invoiceNo || order.invoiceNumber || order.taxInvoiceNo || null;
  const customerName = order.customerName || order.companyName || order.client || 'Client Account';
  const customerGst = order.customerGst || order.gst || order.gstin || '-';
  const customerAddress = order.customerAddress || order.billingAddress || order.address || order.city || 'India';
  const salesRep = order.salesPerson || order.salesExecutive || order.createdBy || order.repName || 'Sales Department';
  const paymentTerms = order.paymentTerms || order.terms || 'Standard Commercial Terms';

  const totalAmountNum = cleanNum(order.totalAmount || order.grandTotal || order.amount || order.total || 0);
  const totalAmountFormatted = totalAmountNum >= 10000000
    ? `₹ ${(totalAmountNum / 10000000).toFixed(2)} Cr`
    : `₹ ${(totalAmountNum / 100000).toFixed(2)} Lakhs`;

  const advancePaidNum = cleanNum(order.advancePaid || order.paymentReceived || order.advanceAmount || 0);
  const advancePaidFormatted = advancePaidNum > 0
    ? `₹ ${(advancePaidNum / 100000).toFixed(2)} L`
    : (totalAmountNum > 0 ? `₹ ${(totalAmountNum * 0.5 / 100000).toFixed(2)} L (Advance Req)` : '₹ 0.00');

  const rawStatus = String(order.status || '').toLowerCase();

  // 6 Lifecycle Stages Evaluation
  const isPiDone = true; // Always done if BOM exists
  const isBomConfirmed = !rawStatus.includes('draft') && !order.cancelled;
  const isPackingDone = rawStatus.includes('packed') || rawStatus.includes('accounts') || rawStatus.includes('invoice') || rawStatus.includes('loading') || rawStatus.includes('dispatch') || Boolean(order.packingVerified);
  const isAccountsDone = rawStatus.includes('invoice') || rawStatus.includes('loading') || rawStatus.includes('dispatch') || Boolean(order.accountsVerified);
  const isInvoiceDone = Boolean(invoiceNumber) || rawStatus.includes('invoice') || rawStatus.includes('loading') || rawStatus.includes('dispatch');
  const isDispatchDone = rawStatus.includes('dispatched') || rawStatus.includes('completed') || Boolean(order.dispatchedAt);

  const stages = [
    {
      num: 1,
      title: 'Sales PI',
      desc: piNumber !== '-' ? `Ref: ${piNumber}` : 'PI Confirmed',
      actor: salesRep,
      completed: isPiDone,
      current: !isBomConfirmed,
      icon: Receipt
    },
    {
      num: 2,
      title: 'BOM Confirmed',
      desc: orderCode,
      actor: 'Engineering / Sales',
      completed: isBomConfirmed,
      current: isBomConfirmed && !isPackingDone,
      icon: Factory
    },
    {
      num: 3,
      title: 'Dispatch Packing',
      desc: isPackingDone ? 'Checklist Verified' : 'In Packing Queue',
      actor: 'Dispatch Operations',
      completed: isPackingDone,
      current: isPackingDone && !isAccountsDone,
      icon: Package
    },
    {
      num: 4,
      title: 'Accounts Audit',
      desc: isAccountsDone ? 'Payment Verified' : 'Awaiting Audit',
      actor: 'Accounts & Finance',
      completed: isAccountsDone,
      current: isAccountsDone && !isInvoiceDone,
      icon: ShieldCheck
    },
    {
      num: 5,
      title: 'Tax Invoice',
      desc: invoiceNumber ? `Inv: ${invoiceNumber}` : 'Tax Billed',
      actor: 'Billing Department',
      completed: isInvoiceDone,
      current: isInvoiceDone && !isDispatchDone,
      icon: FileText
    },
    {
      num: 6,
      title: 'Final Dispatch & LR',
      desc: isDispatchDone ? (order.lrNumber ? `LR: ${order.lrNumber}` : 'Gate Cleared') : 'Loading & Clearances',
      actor: 'Logistics Fleet',
      completed: isDispatchDone,
      current: isDispatchDone,
      icon: Truck
    }
  ];

  // Items list
  const items = Array.isArray(order.items) && order.items.length > 0
    ? order.items
    : (Array.isArray(order.dispatchPacking) && order.dispatchPacking.length > 0 ? order.dispatchPacking : []);

  // Documents
  const paymentProof = order.paymentProofUrl || order.paymentProof || order.payment_proof || null;
  const addressProof = order.addressProofUrl || order.addressProof || order.address_proof || null;
  const lrCopy = order.lrCopyUrl || order.lr_copy || order.lrPhoto || null;
  const vehiclePhoto = order.vehiclePhotoUrl || order.vehiclePhoto || null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.15s ease'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '980px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP MODAL HEADER */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E2E8F0',
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#0E7490',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(14, 116, 144, 0.4)'
            }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase', backgroundColor: '#1E293B', color: '#38BDF8', padding: '2px 8px', borderRadius: '6px' }}>
                  CEO EXECUTIVE 360° ORDER DOSSIER
                </span>
                <span style={{ fontSize: '10px', fontWeight: '800', backgroundColor: isDispatchDone ? '#065F46' : '#1E293B', color: isDispatchDone ? '#34D399' : '#94A3B8', padding: '2px 8px', borderRadius: '6px' }}>
                  {order.status || (isDispatchDone ? 'Completed & Dispatched' : 'Active In-Progress')}
                </span>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: '900', margin: '4px 0 0 0', letterSpacing: '-0.02em', color: '#F8FAFC' }}>
                {orderCode} • {customerName}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              textAlign: 'right',
              padding: '6px 14px',
              borderRadius: '10px',
              backgroundColor: '#1E293B',
              border: '1px solid #334155'
            }}>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', display: 'block' }}>
                Order Valuation
              </span>
              <span style={{ fontSize: '16px', fontWeight: '900', color: '#38BDF8' }}>
                {totalAmountFormatted}
              </span>
            </div>

            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#334155',
                color: '#CBD5E1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 6-STAGE INTERACTIVE LIFECYCLE TRACKER RIBBON */}
        <div style={{
          backgroundColor: '#F8FAFC',
          padding: '16px 24px',
          borderBottom: '1px solid #E2E8F0',
          overflowX: 'auto'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minWidth: '700px',
            position: 'relative'
          }}>
            {stages.map((stg, sIdx) => {
              const IconComp = stg.icon;
              const isCompleted = stg.completed;
              const isCurrent = stg.current;

              const circleBg = isCompleted ? '#059669' : (isCurrent ? '#0E7490' : '#E2E8F0');
              const circleColor = isCompleted || isCurrent ? '#FFFFFF' : '#64748B';
              const textPrimary = isCompleted || isCurrent ? '#0F172A' : '#64748B';

              return (
                <React.Fragment key={sIdx}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: '6px',
                    position: 'relative',
                    zIndex: 2,
                    minWidth: '100px'
                  }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: circleBg,
                      color: circleColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isCompleted || isCurrent ? '0 3px 10px rgba(14, 116, 144, 0.25)' : 'none',
                      transition: 'all 0.2s ease'
                    }}>
                      {isCompleted ? <CheckCircle size={18} /> : <IconComp size={16} />}
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: textPrimary, display: 'block', textTransform: 'uppercase' }}>
                        {stg.num}. {stg.title}
                      </span>
                      <span style={{ fontSize: '10px', color: '#64748B', display: 'block', marginTop: '1px' }}>
                        {stg.desc}
                      </span>
                    </div>
                  </div>

                  {sIdx < stages.length - 1 && (
                    <div style={{
                      flex: 1,
                      height: '3px',
                      backgroundColor: stages[sIdx + 1].completed ? '#059669' : (stg.completed ? '#0E7490' : '#E2E8F0'),
                      margin: '0 8px',
                      position: 'relative',
                      top: '-14px',
                      zIndex: 1
                    }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 24px',
          borderBottom: '1px solid #F1F5F9',
          backgroundColor: '#FFFFFF'
        }}>
          {[
            { id: 'overview', label: 'Executive Overview & Financials' },
            { id: 'items', label: `Bill of Materials (${items.length} Items)` },
            { id: 'documents', label: 'Attached Verification Proofs & Documents' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                border: 'none',
                backgroundColor: activeTab === tab.id ? '#0E7490' : 'transparent',
                color: activeTab === tab.id ? '#FFFFFF' : '#475569',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: activeTab === tab.id ? '800' : '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div style={{
          padding: '20px 24px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 4 CORE EXECUTIVE TILES */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                <div style={{ backgroundColor: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '14px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Total Deal Valuation</span>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: '#0E7490', marginTop: '2px' }}>
                    {formatCurrency(totalAmountNum)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Inclusive of applicable GST</div>
                </div>

                <div style={{ backgroundColor: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '14px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Advance Realized</span>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: '#16A34A', marginTop: '2px' }}>
                    {advancePaidFormatted}
                  </div>
                  <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700', marginTop: '2px' }}>
                    {paymentTerms}
                  </div>
                </div>

                <div style={{ backgroundColor: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '14px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Assigned Sales Executive</span>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#0F172A', marginTop: '4px' }}>
                    {salesRep}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Direct commercial accountability</div>
                </div>

                <div style={{ backgroundColor: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '14px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Invoice & Clearance</span>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: invoiceNumber ? '#7C3AED' : '#D97706', marginTop: '4px' }}>
                    {invoiceNumber || 'Pending Official Invoice'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                    {order.vehicleNo ? `Vehicle: ${order.vehicleNo}` : 'Awaiting Vehicle Loading'}
                  </div>
                </div>
              </div>

              {/* TWO COLUMN DOSSIER: CUSTOMER DETAILS + DISPATCH & LOGISTICS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {/* Customer & Billing Card */}
                <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={16} color="#0E7490" />
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                      Customer & Billing Profile
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: '#64748B', fontSize: '11px', display: 'block' }}>Account / Company Name</span>
                      <strong style={{ color: '#0F172A', fontSize: '13px' }}>{customerName}</strong>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <span style={{ color: '#64748B', fontSize: '11px', display: 'block' }}>GSTIN Number</span>
                        <span style={{ fontWeight: '700', color: '#0F172A' }}>{customerGst}</span>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', fontSize: '11px', display: 'block' }}>Proforma Ref</span>
                        <span style={{ fontWeight: '700', color: '#2563EB' }}>{piNumber}</span>
                      </div>
                    </div>

                    <div>
                      <span style={{ color: '#64748B', fontSize: '11px', display: 'block' }}>Billing / Delivery Address</span>
                      <span style={{ color: '#334155', lineHeight: '1.4' }}>{customerAddress}</span>
                    </div>
                  </div>
                </div>

                {/* Logistics & Fleet Clearances Card */}
                <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Truck size={16} color="#059669" />
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                      Logistics, Transport & Gate Clearances
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <span style={{ color: '#64748B', fontSize: '11px', display: 'block' }}>Transport Mode</span>
                        <strong style={{ color: '#0F172A' }}>{order.transportMode || order.transporter || '3rd-Party Transporter (VRL/ARC)'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', fontSize: '11px', display: 'block' }}>Assigned Vehicle</span>
                        <strong style={{ color: order.vehicleNo ? '#0F172A' : '#D97706' }}>
                          {order.vehicleNo || order.vehicle || 'Pending Allocation'}
                        </strong>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <span style={{ color: '#64748B', fontSize: '11px', display: 'block' }}>Transporter LR Number</span>
                        <strong style={{ color: order.lrNumber ? '#2563EB' : '#DC2626' }}>
                          {order.lrNumber || order.lr_no || 'Pending LR Copy'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', fontSize: '11px', display: 'block' }}>Dispatch Date</span>
                        <span style={{ color: '#0F172A', fontWeight: '600' }}>
                          {order.dispatchedAt || order.dispatchDate || order.updatedAt || 'Active In-Progress'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span style={{ color: '#64748B', fontSize: '11px', display: 'block' }}>Driver & Contact Details</span>
                      <span style={{ color: '#334155' }}>
                        {order.driverName ? `${order.driverName} (${order.driverPhone || 'No Phone'})` : 'To be provided at inward gate loading'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'items' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                  Bill of Materials Specifications & Quantity Audit
                </span>
                <span style={{ fontSize: '11px', color: '#64748B' }}>
                  Total {items.length} Product / Structure Line Items
                </span>
              </div>

              {items.length > 0 ? (
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                        <th style={{ padding: '8px 12px' }}>#</th>
                        <th style={{ padding: '8px 12px' }}>Description / Preset Item</th>
                        <th style={{ padding: '8px 12px' }}>Dimensions / Specs</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Qty</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Unit Rate</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 12px', color: '#94A3B8' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 12px', fontWeight: '700', color: '#0F172A' }}>
                            {it.name || it.item || it.description || it.productName || 'BOM Structure Item'}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#64748B' }}>
                            {it.spec || it.specs || it.dimensions || it.type || '-'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: '#0E7490' }}>
                            {it.qty || it.quantity || 1} {it.unit || 'Nos'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            {formatCurrency(cleanNum(it.rate || it.price || 0))}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                            {formatCurrency(cleanNum(it.total || it.amount || (cleanNum(it.qty || 1) * cleanNum(it.rate || it.price || 0))))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '30px', textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1', color: '#64748B', fontSize: '12px' }}>
                  No itemized line items recorded in this order envelope.
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                Executive Document Vault & Attached Proofs
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {/* 1. Payment Proof */}
                <div style={{ backgroundColor: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase' }}>Commercial Proof</span>
                    <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', margin: '4px 0 0 0' }}>Advance Payment Proof</h4>
                    <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0 0' }}>
                      {paymentProof ? 'Verified bank receipt attached' : 'No document uploaded'}
                    </p>
                  </div>
                  {paymentProof ? (
                    <a
                      href={paymentProof}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#0E7490',
                        color: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: '700',
                        textDecoration: 'none',
                        textAlign: 'center',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Eye size={12} /> View Payment Receipt
                    </a>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#DC2626', fontWeight: '700' }}>• Awaiting Upload</span>
                  )}
                </div>

                {/* 2. Address Proof */}
                <div style={{ backgroundColor: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#2563EB', textTransform: 'uppercase' }}>Delivery Verification</span>
                    <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', margin: '4px 0 0 0' }}>GST / Site Address Proof</h4>
                    <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0 0' }}>
                      {addressProof ? 'Official delivery site document' : 'No document uploaded'}
                    </p>
                  </div>
                  {addressProof ? (
                    <a
                      href={addressProof}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#2563EB',
                        color: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: '700',
                        textDecoration: 'none',
                        textAlign: 'center',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Eye size={12} /> View Address Proof
                    </a>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#DC2626', fontWeight: '700' }}>• Awaiting Upload</span>
                  )}
                </div>

                {/* 3. Transporter LR Copy */}
                <div style={{ backgroundColor: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#059669', textTransform: 'uppercase' }}>Logistics Evidence</span>
                    <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', margin: '4px 0 0 0' }}>Transporter LR Copy</h4>
                    <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0 0' }}>
                      {lrCopy ? `LR Copy recorded (${order.lrNumber || 'Updated'})` : 'Pending transporter LR handover'}
                    </p>
                  </div>
                  {lrCopy ? (
                    <a
                      href={lrCopy}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#059669',
                        color: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: '700',
                        textDecoration: 'none',
                        textAlign: 'center',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Eye size={12} /> View LR Copy
                    </a>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#DC2626', fontWeight: '700' }}>• Pending Transporter LR</span>
                  )}
                </div>

                {/* 4. Vehicle Dispatch Photo */}
                <div style={{ backgroundColor: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#7C3AED', textTransform: 'uppercase' }}>Gate Audit</span>
                    <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', margin: '4px 0 0 0' }}>Loaded Vehicle Photo</h4>
                    <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0 0' }}>
                      {vehiclePhoto ? 'Gate camera / physical loading proof' : 'Pending vehicle loading'}
                    </p>
                  </div>
                  {vehiclePhoto ? (
                    <a
                      href={vehiclePhoto}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#7C3AED',
                        color: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: '700',
                        textDecoration: 'none',
                        textAlign: 'center',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Eye size={12} /> View Loaded Vehicle
                    </a>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>• Not uploaded yet</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #E2E8F0',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ fontSize: '11.5px', color: '#64748B' }}>
            <span>Order Reference: </span>
            <strong style={{ color: '#0F172A' }}>{orderCode}</strong>
            <span style={{ margin: '0 8px' }}>•</span>
            <span>Recorded in BUSINZ Enterprise Database</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => window.print()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#334155',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <Printer size={13} /> Print Dossier
            </button>

            <button
              onClick={onClose}
              style={{
                padding: '7px 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                fontSize: '11.5px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              Close Dossier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
