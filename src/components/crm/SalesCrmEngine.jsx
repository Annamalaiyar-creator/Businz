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
import { fetchCloudStore, saveCloudStore } from '../../utils/supabaseDataSync';

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

  // Live Zoho customers sync on mount
  // Live Supabase Cloud + Zoho sync on mount
  useEffect(() => {
    let isMounted = true;
    const syncCloudCrm = async () => {
      try {
        const [cloudCust, cloudLeads, cloudOpps, cloudQuotes] = await Promise.all([
          fetchCloudStore('customer_store', []),
          fetchCloudStore('crm_leads', []),
          fetchCloudStore('crm_opportunities', []),
          fetchCloudStore('crm_quotations', [])
        ]);

        if (isMounted) {
          if (Array.isArray(cloudCust) && cloudCust.length > 0) setCustomers(cloudCust);
          if (Array.isArray(cloudLeads) && cloudLeads.length > 0) setLeads(cloudLeads);
          if (Array.isArray(cloudOpps) && cloudOpps.length > 0) setOpportunities(cloudOpps);
          if (Array.isArray(cloudQuotes) && cloudQuotes.length > 0) setQuotations(cloudQuotes);
        }

        // Also fetch live Zoho Customers
        const res = await fetch('/api/zoho/customers');
        if (res.ok) {
          const liveList = await res.json();
          if (isMounted && Array.isArray(liveList) && liveList.length > 0) {
            setCustomers(prev => {
              const map = new Map();
              prev.forEach(c => {
                const k = (c.customerCode || c.id || c.zohoContactId || '').toLowerCase().trim();
                if (k) map.set(k, c);
              });
              liveList.forEach(c => {
                const k = (c.customerCode || c.id || c.zohoContactId || '').toLowerCase().trim();
                if (k) {
                  map.set(k, { ...(map.get(k) || {}), ...c });
                }
              });
              const unified = Array.from(map.values());
              saveCloudStore('customer_store', unified);
              return unified;
            });
          }
        }
      } catch (err) {
        console.warn('Initial Supabase/Zoho CRM sync notice:', err);
      }
    };
    syncCloudCrm();

    // Instant Real-Time Push Listener for WhatsApp messages & CRM updates
    const handleCrmPush = (e) => {
      syncCloudCrm();
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

    window.addEventListener('controlroom_whatsapp_message', handleCrmPush);
    window.addEventListener('controlroom_crm_updated', syncCloudCrm);
    window.addEventListener('controlroom_storage_update', syncCloudCrm);

    return () => {
      isMounted = false;
      window.removeEventListener('controlroom_whatsapp_message', handleCrmPush);
      window.removeEventListener('controlroom_crm_updated', syncCloudCrm);
      window.removeEventListener('controlroom_storage_update', syncCloudCrm);
    };
  }, []);

  // Save Handlers
  const handleBatchUpdateCustomers = (customerList) => {
    if (!Array.isArray(customerList) || customerList.length === 0) return;
    setCustomers(prev => {
      const map = new Map();
      prev.forEach(c => {
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
      saveCrmStore('customers', unified);
      saveCloudStore('customer_store', unified);
      return unified;
    });
  };

  const handleSaveLead = (lead) => {
    const updated = [lead, ...leads.filter(l => l.id !== lead.id)];
    setLeads(updated);
    saveCrmStore('leads', updated);
  };

  const handleSaveCustomer = async (customer) => {
    const custKey = customer.customerCode || customer.id;
    const updated = [customer, ...customers.filter(c => (c.customerCode || c.id) !== custKey)];
    setCustomers(updated);
    saveCrmStore('customers', updated);

    // Also sync to Supabase customer store so BOM creation picks it up immediately
    try {
      fetchCloudStore('customer_store', []).then(existingBOMCust => {
        const list = Array.isArray(existingBOMCust) ? existingBOMCust : [];
        const filtered = list.filter(c => {
          const cCode = (c.customerCode || c.code || c.id || '').toLowerCase().trim();
          const targetCode = (customer.customerCode || customer.id || customer.code || '').toLowerCase().trim();
          return cCode !== targetCode;
        });
        const bomRecord = {
          code: customer.companyName || customer.customerName || customer.customerCode,
          c2: customer.companyName || customer.customerName || customer.customerCode,
          gstNo: customer.gstNumber || '',
          c3: (customer.primaryContact && customer.primaryContact.name) || '',
          c4: (customer.primaryContact && customer.primaryContact.phone) || '',
          c5: (customer.primaryContact && customer.primaryContact.email) || '',
          status: 'ACTIVE',
          customerCode: customer.customerCode || customer.id,
          ...customer
        };
        const updatedBOMCust = [bomRecord, ...filtered];
        saveCloudStore('customer_store', updatedBOMCust);
        window.dispatchEvent(new CustomEvent('controlroom_customer_update', { detail: bomRecord }));
      });
    } catch (e) {
      console.warn('Error syncing customer to cloud store:', e);
    }

    // Automatically synchronize to Zoho Books
    try {
      const res = await fetch('/api/zoho/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer)
      });
      if (res.ok) {
        const resJson = await res.json();
        if (resJson && resJson.customer && resJson.customer.zohoContactId) {
          const withZoho = {
            ...customer,
            ...resJson.customer,
            zohoContactId: resJson.customer.zohoContactId
          };
          setCustomers(prev => prev.map(c => 
            (c.customerCode || c.id) === custKey ? withZoho : c
          ));
          const refreshed = updated.map(c => 
            (c.customerCode || c.id) === custKey ? withZoho : c
          );
          saveCrmStore('customers', refreshed);
        }
      }
    } catch (err) {
      console.warn('Zoho customer background sync:', err);
    }
  };

  const handleSaveOpportunity = (opp) => {
    const updated = [opp, ...opportunities.filter(o => o.id !== opp.id)];
    setOpportunities(updated);
    saveCrmStore('opportunities', updated);
  };

  const handleUpdateOpportunity = (opp) => {
    const updated = opportunities.map(o => o.id === opp.id ? opp : o);
    setOpportunities(updated);
    saveCrmStore('opportunities', updated);
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
    const nextNumber = `LEAD-${String(leads.length + 1).padStart(3, '0')}`;
    const newLead = {
      id: `LEAD-2026-${String(Date.now()).slice(-4)}`,
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
            onSaveLead={handleSaveLead}
            onConvertLead={handleConvertLead}
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
            onUpdateOpportunity={handleUpdateOpportunity}
            onCreateOpportunity={handleSaveOpportunity}
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
          />
        )}
      </div>
    </div>
  );
}
