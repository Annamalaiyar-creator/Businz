import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Briefcase, Calendar, MessageSquare, FileText,
  Boxes, BarChart3, Search, Plus, Bell, RefreshCw, ChevronRight, Check
} from 'lucide-react';
import CrmDashboard from './CrmDashboard';
import CrmLeadsView from './CrmLeadsView';
import CrmCustomersView from './CrmCustomersView';
import CrmOpportunitiesView from './CrmOpportunitiesView';
import CrmFollowupsView from './CrmFollowupsView';
import CrmWhatsAppInbox from './CrmWhatsAppInbox';
import CrmQuotationsView from './CrmQuotationsView';
import CrmProductCatalog from './CrmProductCatalog';
import CrmReportsView from './CrmReportsView';
import { getNextSequence } from '../../utils/sequenceGenerator';

import {
  getCrmStore,
  saveCrmStore,
  INITIAL_CRM_CUSTOMERS,
  INITIAL_CRM_LEADS,
  INITIAL_CRM_OPPORTUNITIES,
  INITIAL_CRM_FOLLOWUPS,
  INITIAL_WHATSAPP_TEMPLATES,
  INITIAL_WHATSAPP_CONVERSATIONS,
  INITIAL_CRM_QUOTATIONS
} from '../../services/crmStore';
import { fetchCloudStore, saveCloudStore, saveCloudOpportunityRow, deleteCloudOpportunityRow } from '../../utils/supabaseDataSync';

// Fast shallow list equality check to prevent unnecessary re-renders and flickering
function areListsEqual(a, b, idKey = 'id') {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const itemA = a[i];
    const itemB = b[i];
    if (itemA === itemB) continue;
    if (!itemA || !itemB) return false;
    const idA = itemA[idKey] || itemA.code || itemA.customerCode || itemA.quoteNumber;
    const idB = itemB[idKey] || itemB.code || itemB.customerCode || itemB.quoteNumber;
    if (idA !== idB) return false;
    if ((itemA.updatedAt || itemA.stage || itemA.dealValue || itemA.status) !== (itemB.updatedAt || itemB.stage || itemB.dealValue || itemB.status)) return false;
  }
  return true;
}

export default function SalesCrmEngine({
  userRole = 'Sales Executive',
  activeTab: controlledTab,
  onNavigateTab
}) {
  const mapInitialTab = (tab) => {
    if (tab === 'Leads') return 'Leads';
    if (tab === 'Customers' || tab === 'Customer Management') return 'Customers';
    if (tab === 'Opportunities') return 'Opportunities';
    if (tab === 'Follow-ups') return 'Follow-ups';
    if (tab === 'WhatsApp Inbox' || tab === 'WhatsApp') return 'WhatsApp';
    if (tab === 'Quotations') return 'Quotations';
    if (tab === 'Product Catalog' || tab === 'Products') return 'Products';
    if (tab === 'Sales Reports') return 'Reports';
    return 'Dashboard';
  };

  const [activeTab, setActiveTab] = useState(() => mapInitialTab(controlledTab));

  useEffect(() => {
    if (controlledTab) {
      setActiveTab(mapInitialTab(controlledTab));
    }
  }, [controlledTab]);

  // Synchronized States
  const [customers, setCustomers] = useState(() => getCrmStore('customers', INITIAL_CRM_CUSTOMERS));
  const [leads, setLeads] = useState(() => getCrmStore('leads', INITIAL_CRM_LEADS));
  const [opportunities, setOpportunities] = useState(() => getCrmStore('opportunities', INITIAL_CRM_OPPORTUNITIES));
  const [followups, setFollowups] = useState(() => getCrmStore('followups', INITIAL_CRM_FOLLOWUPS));
  const [templates, setTemplates] = useState(() => getCrmStore('whatsapp_templates', INITIAL_WHATSAPP_TEMPLATES));
  const [conversations, setConversations] = useState(() => getCrmStore('whatsapp_conversations', INITIAL_WHATSAPP_CONVERSATIONS));
  const [quotations, setQuotations] = useState(() => getCrmStore('quotations', INITIAL_CRM_QUOTATIONS));
  const [proformaInvoices, setProformaInvoices] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('proforma_invoice_store');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });
  const [boms, setBoms] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_bom_store') || localStorage.getItem('bom_orders_store');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });
  const [invoices, setInvoices] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_invoice_store') || localStorage.getItem('invoices_store');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });
  const [isCloudSyncing, setIsCloudSyncing] = useState(true);

  // Live Central Customers sync on mount
  // Live Supabase Cloud + Central sync on mount
  useEffect(() => {
    let isMounted = true;
    let syncDebounceTimer = null;

    const syncCloudCrm = async () => {
      try {
        const [cloudCust, cloudLeads, cloudOpps, cloudQuotes, cloudPIs, cloudBoms, cloudInvs] = await Promise.all([
          fetchCloudStore('customer_store', []),
          fetchCloudStore('crm_leads', []),
          fetchCloudStore('crm_opportunities', []),
          fetchCloudStore('crm_quotations', []),
          fetchCloudStore('sales_pi_store', []).catch(() => []),
          fetchCloudStore('bom_store', []).catch(() => []),
          fetchCloudStore('invoice_store', []).catch(() => [])
        ]);

        if (isMounted) {
          if (Array.isArray(cloudLeads) && cloudLeads.length > 0) setLeads(prev => areListsEqual(prev, cloudLeads) ? prev : cloudLeads);
          if (Array.isArray(cloudOpps) && cloudOpps.length > 0) setOpportunities(prev => areListsEqual(prev, cloudOpps) ? prev : cloudOpps);
          if (Array.isArray(cloudQuotes) && cloudQuotes.length > 0) setQuotations(prev => areListsEqual(prev, cloudQuotes) ? prev : cloudQuotes);
          if (Array.isArray(cloudPIs) && cloudPIs.length > 0) setProformaInvoices(cloudPIs);
          if (Array.isArray(cloudBoms) && cloudBoms.length > 0) setBoms(cloudBoms);
          if (Array.isArray(cloudInvs) && cloudInvs.length > 0) setInvoices(cloudInvs);
        }

        // Fetch live Central Customers
        let liveList = [];
        try {
          const res = await fetch('/api/customers');
          if (res.ok) {
            const zData = await res.json();
            if (Array.isArray(zData)) liveList = zData;
          }
        } catch (_) {}

        if (isMounted) {
          // Unified Customer Directory: merge cloud, live Central, local stores, PIs, and BOMs
          const map = new Map();
          const registerCust = (c) => {
            if (!c || typeof c !== 'object') return;
            const name = (c.companyName || c.c2 || c.name || c.customerName || c.code || '').trim();
            if (!name || name === 'Customer Order' || name === 'Customer' || name === 'New Customer') return;
            const k = name.toLowerCase();
            const idKey = (c.customerCode || c.id || '').toLowerCase().trim();
            const existing = map.get(k) || (idKey ? map.get(idKey) : null) || {};
            const merged = {
              ...existing,
              ...c,
              id: c.customerCode || c.id || existing.id || `CUST-${name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}`,
              customerCode: c.customerCode || c.id || existing.customerCode || `CUST-${name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}`,
              companyName: name,
              customerName: c.customerName || existing.customerName || name,
              customerType: c.customerType || existing.customerType || 'EPC Contractor',
              industry: c.industry || existing.industry || 'Solar Energy / Infrastructure',
              status: c.status || existing.status || 'ACTIVE'
            };
            map.set(k, merged);
            if (idKey) map.set(idKey, merged);
          };

          // 1. Local browser storage caches
          try {
            const storages = [
              localStorage.getItem('controlroom_customer_store'),
              localStorage.getItem('businz_crm_customers'),
              localStorage.getItem('controlroom_crm_customers'),
              localStorage.getItem('controlroom_customer_list')
            ];
            storages.forEach(s => {
              if (s) {
                const parsed = JSON.parse(s);
                if (Array.isArray(parsed)) parsed.forEach(registerCust);
              }
            });
          } catch (_) {}

          // 2. Cloud and live backend customers
          (cloudCust || []).forEach(registerCust);
          (liveList || []).forEach(registerCust);

          // 3. Proforma Invoices (Cloud + Local)
          const allPIs = [...(cloudPIs || []), ...(proformaInvoices || [])];
          try {
            const rawPi = localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('proforma_invoice_store');
            if (rawPi) {
              const parsed = JSON.parse(rawPi);
              if (Array.isArray(parsed)) allPIs.push(...parsed);
            }
          } catch (_) {}

          allPIs.forEach(pi => {
            const comp = (pi.vendor || pi.customerName || pi.companyName || '').trim();
            if (comp) {
              registerCust({
                id: `CUST-${comp.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}`,
                customerCode: `CUST-${comp.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}`,
                companyName: comp,
                customerName: pi.contactPerson || comp,
                customerType: pi.customerType || 'EPC Contractor',
                industry: 'Solar Energy / Infrastructure',
                gstNumber: pi.gstNo || pi.gstNumber || '—',
                panNumber: pi.panNumber || '—',
                address: (typeof pi.billingAddress === 'string' ? pi.billingAddress : pi.billingAddress?.street) || '',
                city: (typeof pi.billingAddress === 'object' ? pi.billingAddress.city : '') || '',
                state: (typeof pi.billingAddress === 'object' ? pi.billingAddress.state : '') || '',
                pincode: (typeof pi.billingAddress === 'object' ? pi.billingAddress.pincode : '') || '',
                dispatchAddress: (typeof pi.deliveryAddress === 'string' ? pi.deliveryAddress : pi.deliveryAddress?.street) || '',
                dispatchCity: (typeof pi.deliveryAddress === 'object' ? pi.deliveryAddress.city : '') || '',
                dispatchState: (typeof pi.deliveryAddress === 'object' ? pi.deliveryAddress.state : '') || '',
                dispatchPincode: (typeof pi.deliveryAddress === 'object' ? pi.deliveryAddress.pincode : '') || '',
                sameAsBilling: pi.sameAsBilling !== undefined ? pi.sameAsBilling : true,
                creditLimit: 2500000,
                creditDays: Number(pi.creditDays || 30),
                paymentTerms: pi.paymentTerms || 'Due on Receipt',
                assignedSalesperson: pi.salesPerson || pi.salesperson || 'Sales Executive',
                primaryContact: {
                  name: pi.contactPerson || comp,
                  phone: pi.phone || '',
                  whatsapp: pi.phone || '',
                  email: pi.email || ''
                },
                phone: pi.phone || '—',
                email: pi.email || '—',
                status: 'ACTIVE',
                createdAt: pi.createdAt || new Date().toISOString()
              });
            }
          });

          // 4. BOM Orders (Cloud + Local)
          const allBoms = [...(cloudBoms || []), ...(boms || [])];
          try {
            const rawBom = localStorage.getItem('controlroom_bom_store');
            if (rawBom) {
              const parsed = JSON.parse(rawBom);
              if (Array.isArray(parsed)) allBoms.push(...parsed);
            }
          } catch (_) {}

          allBoms.forEach(b => {
            const comp = (b.customerName || b.companyName || '').trim();
            if (comp) {
              registerCust({
                id: `CUST-${comp.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}`,
                customerCode: `CUST-${comp.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}`,
                companyName: comp,
                customerName: b.contactPerson || comp,
                customerType: b.customerType || 'EPC Contractor',
                industry: 'Solar Energy / Infrastructure',
                gstNumber: b.gstNo || '—',
                address: b.billingAddress || '',
                dispatchAddress: b.deliveryAddress || '',
                paymentTerms: b.paymentType || 'Due on Receipt',
                assignedSalesperson: b.salesPerson || 'Sales Executive',
                primaryContact: {
                  name: b.contactPerson || comp,
                  phone: b.mobile || '',
                  whatsapp: b.mobile || '',
                  email: b.email || ''
                },
                phone: b.mobile || '—',
                email: b.email || '—',
                status: 'ACTIVE',
                createdAt: b.createdAt || new Date().toISOString()
              });
            }
          });

          // Final deduplication strictly by company name
          const finalMap = new Map();
          for (const val of map.values()) {
            const k = (val.companyName || val.name || '').toLowerCase().trim();
            if (k && !finalMap.has(k)) {
              finalMap.set(k, val);
            }
          }
          const unified = Array.from(finalMap.values());
          if (unified.length > 0) {
            setCustomers(prev => areListsEqual(prev, unified, 'customerCode') ? prev : unified);
            try {
              localStorage.setItem('controlroom_customer_store', JSON.stringify(unified));
              localStorage.setItem('businz_crm_customers', JSON.stringify(unified));
            } catch (_) {}
          }
        }
      } catch (err) {
        console.warn('Initial Supabase/Central CRM sync notice:', err);
      } finally {
        if (isMounted) setIsCloudSyncing(false);
      }
    };
    syncCloudCrm();

    // Instant Real-Time Push Listener for WhatsApp messages & CRM updates (debounced)
    const handleCrmPush = (e) => {
      clearTimeout(syncDebounceTimer);
      syncDebounceTimer = setTimeout(syncCloudCrm, 600);
      if (e?.detail?.from && e?.detail?.text) {
        const { from, text, timestamp, formattedPhone } = e.detail;
        setConversations(prev => {
          const list = Array.isArray(prev) ? [...prev] : [];
          const phoneToMatch = (formattedPhone || from).replace(/[^0-9]/g, '');
          let convIdx = list.findIndex(c => (c.phone || '').replace(/[^0-9]/g, '') === phoneToMatch);
          const newMsg = {
            id: `MSG-${Date.now()}`,
            sender: 'customer',
            text,
            timestamp: timestamp || new Date().toISOString(),
            status: 'received'
          };
          if (convIdx !== -1) {
            const conv = { ...list[convIdx] };
            conv.messages = [...(conv.messages || []), newMsg];
            conv.lastMessage = text;
            conv.timestamp = timestamp || new Date().toISOString();
            list[convIdx] = conv;
          } else {
            list.unshift({
              id: `CONV-${Date.now()}`,
              customerName: `+${from}`,
              phone: `+${from}`,
              companyName: 'New WhatsApp Contact',
              lastMessage: text,
              timestamp: timestamp || new Date().toISOString(),
              unreadCount: 1,
              status: 'active',
              messages: [newMsg]
            });
          }
          saveCrmStore('whatsapp_conversations', list);
          return list;
        });
      }
    };

    // Real-Time single-row listener for Opportunities
    const handleOppRealtime = (e) => {
      const { opportunity, action, id } = e?.detail || {};
      if (action === 'delete' && id) {
        setOpportunities(prev => (Array.isArray(prev) ? prev.filter(o => o.id !== id) : []));
      } else if (opportunity && opportunity.id) {
        setOpportunities(prev => {
          const list = Array.isArray(prev) ? [...prev] : [];
          const idx = list.findIndex(o => o.id === opportunity.id);
          if (idx !== -1) {
            list[idx] = { ...list[idx], ...opportunity };
            return list;
          }
          return [opportunity, ...list];
        });
      }
    };

    window.addEventListener('controlroom_opportunity_update', handleOppRealtime);
    window.addEventListener('controlroom_whatsapp_message', handleCrmPush);

    return () => {
      isMounted = false;
      window.removeEventListener('controlroom_opportunity_update', handleOppRealtime);
      window.removeEventListener('controlroom_whatsapp_message', handleCrmPush);
    };
  }, []);

  // Save Handlers
  const handleBatchUpdateCustomers = (customerList) => {
    if (!Array.isArray(customerList) || customerList.length === 0) return;
    const map = new Map();
    (customers || []).forEach(c => {
      const k = (c.customerCode || c.id || c.zohoContactId || '').toLowerCase().trim();
      if (k) map.set(k, c);
    });
    customerList.forEach(c => {
      const k = (c.customerCode || c.id || c.zohoContactId || '').toLowerCase().trim();
      if (k) {
        map.set(k, { ...(map.get(k) || {}), ...c });
      }
    });
    const unified = Array.from(map.values());
    setCustomers(unified);
    saveCrmStore('customers', unified);
    saveCloudStore('customer_store', unified);
    try {
      localStorage.setItem('controlroom_customer_store', JSON.stringify(unified));
      localStorage.setItem('businz_crm_customers', JSON.stringify(unified));
      window.dispatchEvent(new CustomEvent('controlroom_customer_store_updated', { detail: unified }));
    } catch (e) {}
  };

  const handleSaveLead = (lead) => {
    const updated = [lead, ...leads.filter(l => l.id !== lead.id)];
    setLeads(updated);
    saveCrmStore('leads', updated);
    try {
      saveCloudStore('crm_leads', updated);
    } catch (e) {}
  };

  const handleUpdateLeadStatus = (leadId, newStatus, extraNotes = '') => {
    setLeads(prev => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const idx = list.findIndex(l => l.id === leadId);
      if (idx === -1) return list;
      const lead = { ...list[idx] };
      const oldStatus = lead.status;
      lead.status = newStatus;
      
      const newTimelineItem = {
        id: `TL-${Date.now()}`,
        type: 'status_change',
        title: `Status: ${newStatus}`,
        description: extraNotes || `Lead stage progressed from "${oldStatus}" to "${newStatus}"`,
        timestamp: new Date().toISOString()
      };
      lead.timeline = [newTimelineItem, ...(lead.timeline || [])];
      list[idx] = lead;
      saveCrmStore('leads', list);
      try {
        saveCloudStore('crm_leads', list);
      } catch (e) {}
      return list;
    });
  };

  const handleBatchUpdateLeads = (leadIds, updates) => {
    setLeads(prev => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const updated = list.map(l => {
        if (leadIds.includes(l.id)) {
          return {
            ...l,
            ...updates,
            timeline: [
              {
                id: `TL-${Date.now()}`,
                type: 'batch_update',
                title: updates.assignedSalesperson ? `Assigned to ${updates.assignedSalesperson}` : (updates.status ? `Status: ${updates.status}` : 'Updated'),
                description: updates.status ? `Batch updated to ${updates.status}` : 'Batch updated by Sales Manager',
                timestamp: new Date().toISOString()
              },
              ...(l.timeline || [])
            ]
          };
        }
        return l;
      });
      saveCrmStore('leads', updated);
      try {
        saveCloudStore('crm_leads', updated);
      } catch (e) {}
      return updated;
    });
  };

  const handleDeleteLeads = (leadIds) => {
    setLeads(prev => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const updated = list.filter(l => !leadIds.includes(l.id));
      saveCrmStore('leads', updated);
      try {
        saveCloudStore('crm_leads', updated);
      } catch (e) {}
      return updated;
    });
  };

  const handleSaveCustomer = async (customer) => {
    const custKey = customer.customerCode || customer.id;
    const updated = [customer, ...customers.filter(c => (c.customerCode || c.id) !== custKey)];
    setCustomers(updated);
    saveCrmStore('customers', updated);

    // Also sync to Supabase canonical customers table so BOM creation and all views pick it up immediately
    try {
      saveCloudStore('customer_store', customer);
      localStorage.setItem('controlroom_customer_store', JSON.stringify(updated));
      localStorage.setItem('businz_crm_customers', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('controlroom_customer_update', { detail: customer }));
      window.dispatchEvent(new CustomEvent('controlroom_customer_store_updated', { detail: updated }));
    } catch (e) {
      console.warn('Error syncing customer to cloud store:', e);
    }

    // Automatically synchronize to Central Store
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer)
      });
      if (res.ok) {
        const resJson = await res.json();
        const savedCustomer = resJson?.customer || customer;
        const withCust = {
          ...customer,
          ...savedCustomer
        };
        setCustomers(prev => prev.map(c => 
          (c.customerCode || c.id) === custKey ? withCust : c
        ));
        const refreshed = updated.map(c => 
          (c.customerCode || c.id) === custKey ? withCust : c
        );
        saveCrmStore('customers', refreshed);
      }
    } catch (err) {
      console.warn('Customer background sync notice:', err);
    }
  };

  const handleSaveOpportunity = (opp) => {
    const updated = [opp, ...opportunities.filter(o => o.id !== opp.id)];
    setOpportunities(updated);
    saveCloudOpportunityRow(opp);
  };

  const handleUpdateOpportunity = (opp) => {
    const updated = opportunities.map(o => o.id === opp.id ? opp : o);
    setOpportunities(updated);
    saveCloudOpportunityRow(opp);
  };

  const handleDeleteOpportunity = (oppId) => {
    setOpportunities(prev => prev.filter(o => o.id !== oppId));
    deleteCloudOpportunityRow(oppId);
  };

  const handleSaveFollowup = (fu) => {
    const updated = [fu, ...followups.filter(f => f.id !== fu.id)];
    setFollowups(updated);
    saveCrmStore('followups', updated);
  };

  const handleSaveQuotation = (q) => {
    const updated = [q, ...quotations.filter(quote => quote.id !== q.id)];
    setQuotations(updated);
    saveCrmStore('quotations', updated);
  };

  const handleSendWhatsAppMessage = (convId, msg) => {
    const updated = conversations.map(c => {
      if (c.id === convId) {
        return {
          ...c,
          messages: [...(c.messages || []), msg]
        };
      }
      return c;
    });
    setConversations(updated);
    saveCrmStore('whatsapp_conversations', updated);
  };

  // Convert Lead to Customer & Opportunity
  const handleConvertLead = (lead) => {
    // 1. Create or link Customer
    const nextCode = `CUST-VRM-${String(100 + customers.length + 1)}`;
    const newCustomer = {
      id: nextCode,
      customerCode: nextCode,
      companyName: lead.companyName,
      customerType: 'EPC Contractor',
      industry: 'Solar Energy / Utility Scale',
      gstNumber: '',
      panNumber: '',
      address: '',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600001',
      creditLimit: 2500000,
      creditDays: 30,
      paymentTerms: '50% Advance + 50% Dispatch',
      assignedSalesperson: lead.assignedSalesperson || localStorage.getItem('controlroom_logged_user_name') || 'Mohith JV',
      source: lead.source,
      primaryContact: {
        name: lead.contactPerson,
        designation: lead.designation || 'Project Head',
        phone: lead.phone,
        whatsapp: lead.whatsapp || lead.phone,
        email: lead.email
      },
      createdAt: new Date().toISOString()
    };
    handleSaveCustomer(newCustomer);

    // 2. Create Opportunity
    const nextOppId = `OPP-2026-${String(100 + opportunities.length + 1)}`;
    const newOpp = {
      id: nextOppId,
      customerId: newCustomer.id,
      companyName: lead.companyName,
      title: `${lead.estimatedKw || 100} kW ${lead.category || 'Aluminium Mounting Structure'}`,
      dealValue: (lead.estimatedKw || 100) * 2800, // estimated ₹ 2,800/kW
      stage: 'Requirement Received',
      probability: 40,
      assignedSalesperson: lead.assignedSalesperson || localStorage.getItem('controlroom_logged_user_name') || 'Mohith JV',
      targetCloseDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };
    handleSaveOpportunity(newOpp);

    // 3. Update Lead status to Converted
    handleSaveLead({
      ...lead,
      status: 'Converted'
    });

    // Navigate to Opportunities view
    setActiveTab('Opportunities');
  };

  // Auto Create Lead from WhatsApp Conversation
  const handleAutoCreateLeadFromWhatsApp = (conv) => {
    const nextNumber = getNextSequence('LEAD', leads || []).code;
    const newLead = {
      id: nextNumber,
      leadNumber: nextNumber,
      companyName: conv.companyName || `${conv.customerName} Project`,
      contactPerson: conv.customerName,
      designation: 'Solar Inquirer',
      phone: conv.phone,
      whatsapp: conv.phone,
      email: '',
      source: 'WhatsApp',
      status: 'New Lead',
      assignedSalesperson: localStorage.getItem('controlroom_logged_user_name') || 'Mohith JV',
      estimatedKw: 100,
      category: 'Aluminium Mounting Structures',
      notes: `Inbound WhatsApp conversation automatically converted to CRM lead.`,
      createdAt: new Date().toISOString()
    };

    handleSaveLead(newLead);
    setActiveTab('Leads');
  };

  const navItems = [
    { id: 'Dashboard', label: 'Sales Dashboard', icon: LayoutDashboard },
    { id: 'Leads', label: 'Leads Directory', icon: Users, badge: leads.filter(l => l.status === 'New Lead').length || undefined },
    { id: 'Customers', label: 'B2B Customers', icon: Building2Icon },
    { id: 'Opportunities', label: 'Pipeline & Deals', icon: Briefcase, badge: opportunities.filter(o => o.stage !== 'Won' && o.stage !== 'Lost').length || undefined },
    { id: 'Follow-ups', label: 'Follow-ups', icon: Calendar, badge: followups.filter(f => f.status !== 'Completed').length || undefined },
    { id: 'WhatsApp', label: 'WhatsApp Inbox', icon: MessageSquare },
    { id: 'Quotations', label: 'Quotations', icon: FileText },
    { id: 'Products', label: 'Product Master', icon: Boxes },
    { id: 'Reports', label: 'Analytics & Reports', icon: BarChart3 }
  ];

  function Building2Icon(props) {
    return <Users {...props} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Main CRM Body Area */}
      <div>
        {activeTab === 'Dashboard' && (
          <CrmDashboard
            leads={leads}
            opportunities={opportunities}
            followups={followups}
            quotations={quotations}
            isLoading={isCloudSyncing}
            onNavigateTab={(tab) => {
              if (tab === 'Sales BOM' || tab === 'BOM' || tab === 'Items Directory') {
                onNavigateTab(tab);
              } else {
                setActiveTab(tab);
              }
            }}
            onUpdateOpportunityStage={(oppId, newStage) => {
              const opp = opportunities.find(o => o.id === oppId);
              if (opp) handleUpdateOpportunity({ ...opp, stage: newStage });
            }}
            onCreateLead={() => setActiveTab('Leads')}
            onCreateOpportunity={() => setActiveTab('Opportunities')}
          />
        )}

        {activeTab === 'Leads' && (
          <CrmLeadsView
            leads={leads}
            customers={customers}
            userRole={userRole}
            isLoading={isCloudSyncing}
            onSaveLead={handleSaveLead}
            onConvertLead={handleConvertLead}
            onUpdateLeadStatus={handleUpdateLeadStatus}
            onBatchUpdateLeads={handleBatchUpdateLeads}
            onDeleteLeads={handleDeleteLeads}
            onNavigateTab={(tab) => {
              if (tab === 'Sales BOM' || tab === 'BOM') onNavigateTab(tab);
              else setActiveTab(tab);
            }}
            onOpenWhatsAppChat={(contact) => setActiveTab('WhatsApp')}
          />
        )}

        {activeTab === 'Customers' && (
          <CrmCustomersView
            customers={customers}
            opportunities={opportunities}
            quotations={quotations}
            isLoading={isCloudSyncing}
            onSaveCustomer={handleSaveCustomer}
            onBatchUpdateCustomers={handleBatchUpdateCustomers}
            onNavigateTab={(tab) => {
              if (tab === 'Sales BOM' || tab === 'BOM') onNavigateTab(tab);
              else setActiveTab(tab);
            }}
            onOpenWhatsAppChat={() => setActiveTab('WhatsApp')}
          />
        )}

        {activeTab === 'Opportunities' && (
          <CrmOpportunitiesView
            opportunities={opportunities}
            customers={customers}
            isLoading={isCloudSyncing}
            onUpdateOpportunity={handleUpdateOpportunity}
            onCreateOpportunity={handleSaveOpportunity}
            onDeleteOpportunity={handleDeleteOpportunity}
            onNavigateTab={(tab) => {
              if (tab === 'Sales BOM' || tab === 'BOM') onNavigateTab(tab);
              else setActiveTab(tab);
            }}
          />
        )}

        {activeTab === 'Follow-ups' && (
          <CrmFollowupsView
            followups={followups}
            onSaveFollowup={handleSaveFollowup}
            onOpenWhatsAppChat={() => setActiveTab('WhatsApp')}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'WhatsApp' && (
          <CrmWhatsAppInbox
            conversations={conversations}
            templates={templates}
            onSendMessage={handleSendWhatsAppMessage}
            onAutoCreateLead={handleAutoCreateLeadFromWhatsApp}
            onNavigateTab={(tab) => {
              if (tab === 'Sales BOM' || tab === 'BOM') onNavigateTab(tab);
              else setActiveTab(tab);
            }}
          />
        )}

        {activeTab === 'Quotations' && (
          <CrmQuotationsView
            userRole={userRole}
            quotations={quotations}
            isLoading={isCloudSyncing}
            onSaveQuotation={handleSaveQuotation}
            onNavigateTab={(tab) => {
              if (['Performa Invoice', 'Proforma Invoice', 'Sales BOM', 'BOM', 'Items Directory', 'BOM Orders'].includes(tab) || (onNavigateTab && !['Leads', 'Customers', 'Opportunities', 'Follow-ups', 'WhatsApp', 'Quotations', 'Products', 'Reports', 'Dashboard'].includes(tab))) {
                if (onNavigateTab) onNavigateTab(tab);
              } else {
                setActiveTab(tab);
              }
            }}
            onOpenWhatsAppChat={() => setActiveTab('WhatsApp')}
          />
        )}

        {activeTab === 'Products' && (
          <CrmProductCatalog
            onNavigateTab={(tab) => {
              if (tab === 'Items Directory' || tab === 'BOM' || tab === 'Sales BOM') onNavigateTab(tab);
              else setActiveTab(tab);
            }}
          />
        )}

        {activeTab === 'Reports' && (
          <CrmReportsView
            leads={leads}
            opportunities={opportunities}
            quotations={quotations}
            proformaInvoices={proformaInvoices}
            boms={boms}
            invoices={invoices}
          />
        )}
      </div>
    </div>
  );
}
