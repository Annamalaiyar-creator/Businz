import { fetchCloudStore, saveCloudStore } from '../utils/supabaseDataSync';

/**
 * VRM Sales CRM Data Store & Synchronization Engine
 * Handles Leads, Customers, Contacts, Opportunities, Activities, Follow-ups,
 * WhatsApp Conversations, WhatsApp Messages, WhatsApp Templates, and Quotations.
 */

// Initial Seed Data (Empty for live database sync)
export const INITIAL_CRM_CUSTOMERS = [];

export const INITIAL_CRM_LEADS = [];

export const INITIAL_CRM_OPPORTUNITIES = [];

export const STAGE_PROBABILITIES = {
  'New Lead': 10,
  'Contacted': 20,
  'Qualified': 30,
  'Requirement Received': 40,
  'BOM / Quotation': 50,
  'Quotation Sent': 60,
  'Negotiation': 75,
  'Confirmation Pending': 90,
  'Won': 100,
  'Lost': 0
};

export const INITIAL_CRM_FOLLOWUPS = [];

export const INITIAL_WHATSAPP_TEMPLATES = [
  {
    id: 'TMP-001',
    name: 'welcome_vrm',
    category: 'Welcome',
    title: 'Welcome to VRM Structures',
    body: 'Hi {{customer_name}}, thank you for contacting VRM Structures India Pvt Ltd. We specialize in precision-engineered solar mounting structures (Rooftop Aluminium, Tin Shed Clamps, HDG Ground Mount, and Solar Walkways). How can we assist with your project requirement today?',
    variables: ['customer_name']
  },
  {
    id: 'TMP-002',
    name: 'followup_requirement',
    category: 'Follow-up',
    title: 'Solar Requirement Follow-up',
    body: 'Hi {{customer_name}}, just following up regarding your solar structure requirement for {{company}}. Our engineering team has prepared the optimal mounting design. Could we connect briefly today to finalize details?',
    variables: ['customer_name', 'company']
  },
  {
    id: 'TMP-003',
    name: 'quotation_shared',
    category: 'Quotation',
    title: 'Official Quotation Attached',
    body: 'Hi {{customer_name}}, please find your official quotation #{{quote_number}} for {{amount}} attached. This includes complete technical specs, structural warranty, and estimated dispatch schedules.',
    variables: ['customer_name', 'quote_number', 'amount']
  },
  {
    id: 'TMP-004',
    name: 'bom_confirmation',
    category: 'BOM Confirmation',
    title: 'BOM Product Confirmation',
    body: 'Hi {{customer_name}}, please review the attached Bill of Materials #{{bom_number}} for {{company}}. Please reply with your confirmation to allocate inventory and initiate dispatch packing.',
    variables: ['customer_name', 'bom_number', 'company']
  },
  {
    id: 'TMP-005',
    name: 'payment_reminder',
    category: 'Payment Reminder',
    title: 'Commercial Payment Advice',
    body: 'Hi {{customer_name}}, this is a friendly reminder regarding the pending payment of {{amount}} for Proforma Invoice #{{invoice_number}} due on {{due_date}}. Please share payment advice once initiated.',
    variables: ['customer_name', 'amount', 'invoice_number', 'due_date']
  },
  {
    id: 'TMP-006',
    name: 'dispatch_update',
    category: 'Dispatch Update',
    title: 'Order Dispatched Notification',
    body: 'Hi {{customer_name}}, your order for BOM #{{bom_number}} has been packed and dispatched via {{transporter_name}}. Vehicle No: {{vehicle_no}}, LR No: {{lr_no}}. Thank you for choosing VRM Structures!',
    variables: ['customer_name', 'bom_number', 'transporter_name', 'vehicle_no', 'lr_no']
  }
];

export const INITIAL_WHATSAPP_CONVERSATIONS = [
  {
    id: 'CHAT-9876543210',
    phone: '+91 98765 43210',
    customerName: 'Rajesh Kannan',
    companyName: 'Vikram Solar Pvt Ltd',
    customerId: 'CUST-VRM-101',
    leadId: null,
    oppId: 'OPP-2026-101',
    assignedSalesperson: 'Mohith JV',
    unreadCount: 0,
    lastMessage: 'Sure Mohith JV, please send the revised offer with 2% discount on aluminium rails.',
    lastMessageTime: new Date(Date.now() - 45 * 60000).toISOString(),
    status: 'Active',
    messages: [
      {
        id: 'MSG-001',
        sender: 'customer',
        text: 'Hi, we have an upcoming 500 kW rooftop project at Oragadam. Do you have 2414mm aluminium rails in ready stock?',
        time: new Date(Date.now() - 5 * 3600000).toISOString(),
        status: 'read'
      },
      {
        id: 'MSG-002',
        sender: 'sales',
        text: 'Hello Rajesh Ji! Yes, VRM has full stock of ALU-LEN-2414MM (6063 T6 grade) in our Chennai warehouse. Let me share our technical catalog and pricing right away.',
        time: new Date(Date.now() - 4 * 3600000).toISOString(),
        status: 'read'
      },
      {
        id: 'MSG-003',
        sender: 'sales',
        text: 'Quotation #QT-2026-012 has been sent to your email. Total order value: ₹ 12,50,000 + GST.',
        time: new Date(Date.now() - 2 * 3600000).toISOString(),
        status: 'read'
      },
      {
        id: 'MSG-004',
        sender: 'customer',
        text: 'Sure Mohith JV, please send the revised offer with 2% discount on aluminium rails.',
        time: new Date(Date.now() - 45 * 60000).toISOString(),
        status: 'read'
      }
    ]
  },
  {
    id: 'CHAT-9811122334',
    phone: '+91 98111 22334',
    customerName: 'Amit Sharma',
    companyName: 'Adani Green Energy Ltd',
    leadId: 'LEAD-2026-001',
    oppId: 'OPP-2026-104',
    assignedSalesperson: 'Mohith JV',
    unreadCount: 1,
    lastMessage: 'Hi, I need solar structure for 100 panels. What is the price?',
    lastMessageTime: new Date(Date.now() - 25 * 60000).toISOString(),
    status: 'Active',
    messages: [
      {
        id: 'MSG-101',
        sender: 'customer',
        text: 'Hi, I need solar structure for 100 panels. What is the price?',
        time: new Date(Date.now() - 25 * 60000).toISOString(),
        status: 'delivered'
      }
    ]
  },
  {
    id: 'CHAT-9723456789',
    phone: '+91 97234 56789',
    customerName: 'Dharmesh Patel',
    companyName: 'Waaree Energies Ltd',
    customerId: 'CUST-VRM-103',
    oppId: 'OPP-2026-103',
    assignedSalesperson: 'Mohith JV',
    unreadCount: 0,
    lastMessage: 'Payment of 100% advance initiated via RTGS. Will share UTR receipt in 30 mins.',
    lastMessageTime: new Date(Date.now() - 120 * 60000).toISOString(),
    status: 'Active',
    messages: [
      {
        id: 'MSG-201',
        sender: 'sales',
        text: 'Dear Dharmesh Ji, BOM #BOM-102 has been finalized for 250 kW Tin Shed clamps. Amount: ₹ 6,20,000.',
        time: new Date(Date.now() - 240 * 60000).toISOString(),
        status: 'read'
      },
      {
        id: 'MSG-202',
        sender: 'customer',
        text: 'Payment of 100% advance initiated via RTGS. Will share UTR receipt in 30 mins.',
        time: new Date(Date.now() - 120 * 60000).toISOString(),
        status: 'read'
      }
    ]
  }
];

export const INITIAL_CRM_QUOTATIONS = [];

export const INITIAL_CRM_ACTIVITIES = [];

/**
 * Universal safe store loader and syncer
 */
export function getCrmStore(key, initialData = []) {
  try {
    const raw = (key === 'customers' || key === 'customer_store')
      ? (localStorage.getItem('controlroom_customer_store') || 
         localStorage.getItem('businz_crm_customers') || 
         localStorage.getItem('controlroom_crm_customers') || 
         localStorage.getItem('controlroom_customer_list') || 
         localStorage.getItem('customers'))
      : (localStorage.getItem(`businz_crm_${key}`) || 
         localStorage.getItem(`controlroom_crm_${key}`) || 
         localStorage.getItem(key));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out legacy mock seeds so old sample data never flashes
        const clean = parsed.filter(item => {
          const idStr = String(item.id || item.customerCode || item.oppNumber || item.leadNumber || item.quoteNumber || '');
          return !idStr.startsWith('OPP-2026-10') && 
                 !idStr.startsWith('LEAD-2026-00') && 
                 !idStr.startsWith('QT-2026-01') && 
                 !idStr.startsWith('FOL-00') && 
                 !idStr.startsWith('ACT-00');
        });
        return clean;
      }
    }
  } catch (e) {}
  return initialData;
}

export function saveCrmStore(key, data) {
  try {
    try {
      localStorage.setItem(`businz_crm_${key}`, JSON.stringify(data));
    } catch (e) {}
    const cloudKey = (key === 'leads' || key === 'crm_leads') ? 'crm_leads' : (key.startsWith('crm_') ? key : `crm_${key}`);
    saveCloudStore(cloudKey, data);
    // Dispatch local custom event for cross-component re-rendering
    window.dispatchEvent(new CustomEvent('controlroom_crm_update', { detail: { key, count: Array.isArray(data) ? data.length : 1 } }));
    window.dispatchEvent(new CustomEvent('businz_crm_update', { detail: { key, count: Array.isArray(data) ? data.length : 1 } }));
  } catch (e) {
    console.error(`Error saving CRM ${key}:`, e);
  }
}

/**
 * AI Sales Assistant Engine
 * Simulates intelligent NLP analysis on incoming solar structure inquiries
 */
export function analyzeSolarEnquiry(text = '') {
  const clean = String(text || '').toLowerCase();
  
  // Extract kW or panel count
  const kwMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:kw|k\.w|kilowatt|megawatt|mw)/i);
  const panelMatch = clean.match(/(\d+)\s*(?:panel|panels|nos|modules)/i);
  
  let estimatedKw = null;
  let estimatedPanels = null;

  if (kwMatch) {
    let val = parseFloat(kwMatch[1]);
    if (clean.includes('mw') || clean.includes('megawatt')) val = val * 1000;
    estimatedKw = val;
    estimatedPanels = Math.round((val * 1000) / 550); // Assuming standard 550W mono perc panels
  } else if (panelMatch) {
    estimatedPanels = parseInt(panelMatch[1]);
    estimatedKw = Math.round((estimatedPanels * 550) / 1000);
  }

  // Detect structure profile category
  let category = 'Aluminium Mounting Structures';
  if (clean.includes('tin') || clean.includes('sheet') || clean.includes('shed') || clean.includes('mini rail')) {
    category = 'Tin Shed Clamping Systems';
  } else if (clean.includes('ground') || clean.includes('hdg') || clean.includes('purlin') || clean.includes('fixed tilt')) {
    category = 'HDG Ground Mounting Structures';
  } else if (clean.includes('walkway') || clean.includes('handrail') || clean.includes('frp')) {
    category = 'Walkways & Safety Handrails';
  } else if (clean.includes('ballast') || clean.includes('flat roof')) {
    category = 'Ballasted Rooftop Systems';
  }

  // Detect intent
  let intent = 'General Inquiry';
  if (clean.includes('price') || clean.includes('rate') || clean.includes('cost') || clean.includes('quote') || clean.includes('quotation')) {
    intent = 'Price / Quotation Enquiry';
  } else if (clean.includes('urgent') || clean.includes('immediate') || clean.includes('dispatch') || clean.includes('stock')) {
    intent = 'Urgent Stock Availability';
  } else if (clean.includes('drawing') || clean.includes('staad') || clean.includes('spec') || clean.includes('datasheet')) {
    intent = 'Technical Specifications Request';
  }

  // Suggest reply text
  let suggestedReply = `Hello! Thank you for reaching out to VRM Structures. For a ${estimatedKw ? `${estimatedKw} kW` : (estimatedPanels ? `${estimatedPanels} panels` : '')} ${category} requirement, we manufacture premium extruded aluminium (6063 T6) and hot-dip galvanized steel systems conforming to strict IS structural standards. May I know your project location and panel wattage so I can generate a tailored commercial quotation?`;

  return {
    requirement: `${estimatedKw ? `${estimatedKw} kW` : (estimatedPanels ? `${estimatedPanels} panels` : '')} ${category}`.trim(),
    estimatedKw,
    estimatedPanels,
    category,
    intent,
    suggestedReply,
    confidenceScore: estimatedKw || estimatedPanels ? 94 : 78
  };
}
