import { fetchCloudStore, saveCloudStore } from '../utils/supabaseDataSync';

/**
 * VRM Sales CRM Data Store & Synchronization Engine
 * Handles Leads, Customers, Contacts, Opportunities, Activities, Follow-ups,
 * WhatsApp Conversations, WhatsApp Messages, WhatsApp Templates, and Quotations.
 */

// Initial Seed Data tailored for VRM Structures India Pvt Ltd
export const INITIAL_CRM_CUSTOMERS = [
  {
    id: 'CUST-VRM-101',
    customerCode: 'CUST-VRM-101',
    companyName: 'Vikram Solar Pvt Ltd',
    customerType: 'EPC Contractor',
    industry: 'Solar Energy / Utility Scale',
    gstNumber: '33AABCV1234F1Z5',
    panNumber: 'AABCV1234F',
    address: 'No 1427, GNT Road, Nagappa Industrial Estate, Puzhal',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600066',
    creditLimit: 5000000,
    creditDays: 30,
    paymentTerms: 'Net 30 Days',
    assignedSalesperson: 'Mohith JV',
    source: 'Website',
    primaryContact: {
      name: 'Rajesh Kannan',
      designation: 'Procurement Head',
      phone: '+91 98765 43210',
      whatsapp: '+91 98765 43210',
      email: 'rajesh@vikramsolar.com'
    },
    createdAt: '2026-05-10T10:00:00.000Z'
  },
  {
    id: 'CUST-VRM-102',
    customerCode: 'CUST-VRM-102',
    companyName: 'Tata Power Solar Systems Ltd',
    customerType: 'Independent Power Producer (IPP)',
    industry: 'Renewable Infrastructure',
    gstNumber: '29AAACT2345D1ZA',
    panNumber: 'AAACT2345D',
    address: 'Corporate Park, Phase 2, Whitefield',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560066',
    creditLimit: 10000000,
    creditDays: 45,
    paymentTerms: '50% Advance + 50% Dispatch',
    assignedSalesperson: 'Vijay',
    source: 'Referral',
    primaryContact: {
      name: 'Karthik Raja',
      designation: 'VP Supply Chain',
      phone: '+91 98450 12345',
      whatsapp: '+91 98450 12345',
      email: 'karthik.raja@tatapower.com'
    },
    createdAt: '2026-06-01T09:30:00.000Z'
  },
  {
    id: 'CUST-VRM-103',
    customerCode: 'CUST-VRM-103',
    companyName: 'Waaree Energies Ltd',
    customerType: 'Module & Structure Manufacturer',
    industry: 'Solar EPC & Rooftop',
    gstNumber: '24AAACW5678B1Z2',
    panNumber: 'AAACW5678B',
    address: 'Plot 48, GIDC Industrial Estate, Sachin',
    city: 'Surat',
    state: 'Gujarat',
    pincode: '394230',
    creditLimit: 3000000,
    creditDays: 15,
    paymentTerms: '100% Advance',
    assignedSalesperson: 'Mohith JV',
    source: 'WhatsApp',
    primaryContact: {
      name: 'Dharmesh Patel',
      designation: 'Project Director',
      phone: '+91 97234 56789',
      whatsapp: '+91 97234 56789',
      email: 'dharmesh.p@waaree.com'
    },
    createdAt: '2026-07-15T11:15:00.000Z'
  }
];

export const INITIAL_CRM_LEADS = [
  {
    id: 'LEAD-2026-001',
    leadNumber: 'LEAD-001',
    companyName: 'Adani Green Energy Ltd',
    contactPerson: 'Amit Sharma',
    designation: 'Lead Engineer - Solar BOS',
    phone: '+91 98111 22334',
    whatsapp: '+91 98111 22334',
    email: 'amit.sharma@adani.com',
    location: 'Ahmedabad, Gujarat',
    source: 'WhatsApp',
    requirement: '100 kW Rooftop Solar Mounting Structure (Alu Rail 2414mm + Mid/End Clamps)',
    estimatedValue: 480000,
    assignedSalesperson: 'Mohith JV',
    status: 'Requirement Received', // New Lead | Contacted | Qualified | Requirement Received | Opportunity Created | Won | Lost
    priority: 'HIGH',
    nextFollowup: new Date(Date.now() + 2 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 36 * 3600000).toISOString(),
    notes: 'Inquired through WhatsApp regarding 100 kW rooftop industrial profile with expedited delivery in Gujarat.'
  },
  {
    id: 'LEAD-2026-002',
    leadNumber: 'LEAD-002',
    companyName: 'L&T Construction - Solar Division',
    contactPerson: 'Suresh Menon',
    designation: 'Senior SCM Manager',
    phone: '+91 94440 98765',
    whatsapp: '+91 94440 98765',
    email: 'suresh.menon@lntecc.com',
    location: 'Chennai, Tamil Nadu',
    source: 'Website',
    requirement: '500 kW Ground Mount Fixed Tilt HDG C-Purlin & Column Structure',
    estimatedValue: 2450000,
    assignedSalesperson: 'Vijay',
    status: 'Contacted',
    priority: 'HIGH',
    nextFollowup: new Date(Date.now() + 5 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    notes: 'Submitted web enquiry for utility grade HDG 80-micron structures.'
  },
  {
    id: 'LEAD-2026-003',
    leadNumber: 'LEAD-003',
    companyName: 'Sree Ganesh Renewables',
    contactPerson: 'Ganesh Babu',
    designation: 'Founder & CEO',
    phone: '+91 98421 34567',
    whatsapp: '+91 98421 34567',
    email: 'ganesh@sreeganeshsolar.in',
    location: 'Coimbatore, Tamil Nadu',
    source: 'Referral',
    requirement: '25 kW Commercial Shed Mini Rail Kit with SS Fasteners',
    estimatedValue: 135000,
    assignedSalesperson: 'Mohith JV',
    status: 'New Lead',
    priority: 'MEDIUM',
    nextFollowup: new Date(Date.now() + 24 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    notes: 'Referred by Vikram Solar site engineer. Needs quick quote for tin shed installation.'
  },
  {
    id: 'LEAD-2026-004',
    leadNumber: 'LEAD-004',
    companyName: 'Bright Rays EPC Pvt Ltd',
    contactPerson: 'Manish Verma',
    designation: 'Project Lead',
    phone: '+91 99300 44556',
    whatsapp: '+91 99300 44556',
    email: 'manish@brightrays.com',
    location: 'Pune, Maharashtra',
    source: 'WhatsApp',
    requirement: '75 kW Ballasted Flat Roof Mounting Structure',
    estimatedValue: 390000,
    assignedSalesperson: 'Mohith JV',
    status: 'Qualified',
    priority: 'HIGH',
    nextFollowup: new Date(Date.now() - 2 * 3600000).toISOString(), // Overdue
    createdAt: new Date(Date.now() - 72 * 3600000).toISOString(),
    notes: 'Requires wind speed compliance report for 150 km/h rooftop installation.'
  },
  {
    id: 'LEAD-2026-005',
    leadNumber: 'LEAD-005',
    companyName: 'SunVolt CleanTech',
    contactPerson: 'Priya Sundaram',
    designation: 'Procurement Specialist',
    phone: '+91 98840 77889',
    whatsapp: '+91 98840 77889',
    email: 'priya@sunvolt.co.in',
    location: 'Hyderabad, Telangana',
    source: 'Phone',
    requirement: 'Sample kit of 35mm Mid and End Clamps with EPDM rubber',
    estimatedValue: 25000,
    assignedSalesperson: 'Vijay',
    status: 'Contacted',
    priority: 'LOW',
    nextFollowup: new Date(Date.now() + 48 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 96 * 3600000).toISOString(),
    notes: 'Sampling requested before bulk 1 MW order in Q3.'
  }
];

export const INITIAL_CRM_OPPORTUNITIES = [
  {
    id: 'OPP-2026-101',
    oppNumber: 'OPP-101',
    customerName: 'Vikram Solar Pvt Ltd',
    customerId: 'CUST-VRM-101',
    contactPerson: 'Rajesh Kannan',
    phone: '+91 98765 43210',
    title: '500 kW Industrial Rooftop Structure - Oragadam Plant',
    requirement: 'Aluminium Rail 2414mm (ALU-LEN-2414MM) + Rapid Mid Clamps + SS304 Hardware',
    productCategory: 'Aluminium Mounting Structures',
    estimatedQty: '500 kW / 1,200 panels',
    dealValue: 1250000,
    stage: 'Negotiation', // 1. New Lead | 2. Contacted | 3. Qualified | 4. Requirement Received | 5. BOM / Quotation | 6. Quotation Sent | 7. Negotiation | 8. Confirmation Pending | 9. Won | 10. Lost
    probability: 75,
    expectedClosingDate: '2026-09-20',
    salesperson: 'Mohith JV',
    priority: 'HIGH',
    bomCode: 'BOM-101',
    quotationNumber: 'QT-2026-012',
    lastActivity: 'Revised quote shared with 2% discount on aluminium rails',
    nextFollowup: new Date(Date.now() + 4 * 3600000).toISOString(),
    createdAt: '2026-08-15T11:00:00.000Z'
  },
  {
    id: 'OPP-2026-102',
    oppNumber: 'OPP-102',
    customerName: 'Tata Power Solar Systems Ltd',
    customerId: 'CUST-VRM-102',
    contactPerson: 'Karthik Raja',
    phone: '+91 98450 12345',
    title: '1 MW Ground Mount Solar PV Structure - Pavagada Site',
    requirement: 'HDG Cold-formed C Purlins, Column posts, Base plates, Galvanized Nut Bolts',
    productCategory: 'HDG Ground Mounting Structures',
    estimatedQty: '1,000 kW / 2,400 panels',
    dealValue: 3850000,
    stage: 'Quotation Sent',
    probability: 60,
    expectedClosingDate: '2026-09-30',
    salesperson: 'Vijay',
    priority: 'HIGH',
    quotationNumber: 'QT-2026-015',
    lastActivity: 'Official quotation with STAAD Pro structural design calculations sent via WhatsApp & Email',
    nextFollowup: new Date(Date.now() + 20 * 3600000).toISOString(),
    createdAt: '2026-08-20T14:30:00.000Z'
  },
  {
    id: 'OPP-2026-103',
    oppNumber: 'OPP-103',
    customerName: 'Waaree Energies Ltd',
    customerId: 'CUST-VRM-103',
    contactPerson: 'Dharmesh Patel',
    phone: '+91 97234 56789',
    title: '250 kW Tin Shed Solar Clamping System',
    requirement: 'Mini Rail 100mm with EPDM, Self-drilling screws, 35mm End Clamps',
    productCategory: 'Tin Shed Clamping Systems',
    estimatedQty: '250 kW / 600 panels',
    dealValue: 620000,
    stage: 'Confirmation Pending',
    probability: 90,
    expectedClosingDate: '2026-09-12',
    salesperson: 'Mohith JV',
    priority: 'HIGH',
    bomCode: 'BOM-102',
    quotationNumber: 'QT-2026-018',
    lastActivity: 'Client verbal approval received, waiting on PO issuance and advance deposit',
    nextFollowup: new Date(Date.now() + 1 * 3600000).toISOString(),
    createdAt: '2026-08-25T10:00:00.000Z'
  },
  {
    id: 'OPP-2026-104',
    oppNumber: 'OPP-104',
    customerName: 'Adani Green Energy Ltd',
    contactPerson: 'Amit Sharma',
    phone: '+91 98111 22334',
    title: '100 kW Rooftop Solar Mounting Structure',
    requirement: 'Universal Rail Aluminium Structure for trapezoidal sheet',
    productCategory: 'Aluminium Mounting Structures',
    estimatedQty: '100 kW / 240 panels',
    dealValue: 480000,
    stage: 'BOM / Quotation',
    probability: 40,
    expectedClosingDate: '2026-10-05',
    salesperson: 'Mohith JV',
    priority: 'MEDIUM',
    lastActivity: 'Draft BOM prepared with engineering team',
    nextFollowup: new Date(Date.now() + 8 * 3600000).toISOString(),
    createdAt: '2026-09-01T15:00:00.000Z'
  },
  {
    id: 'OPP-2026-105',
    oppNumber: 'OPP-105',
    customerName: 'Bright Energy Tech',
    contactPerson: 'Sunil Nair',
    phone: '+91 98200 11223',
    title: '50 kW Walkway & Handrail Integration',
    requirement: 'FRP Walkway and GI Handrail for Solar Roof Maintenance',
    productCategory: 'Walkways & Safety Handrails',
    estimatedQty: '150 running meters',
    dealValue: 280000,
    stage: 'Won',
    probability: 100,
    expectedClosingDate: '2026-09-05',
    salesperson: 'Vijay',
    priority: 'MEDIUM',
    bomCode: 'BOM-103',
    quotationNumber: 'QT-2026-009',
    lastActivity: 'Deal won! Advance 100% paid and forwarded to Production',
    nextFollowup: null,
    createdAt: '2026-08-10T12:00:00.000Z'
  },
  {
    id: 'OPP-2026-106',
    oppNumber: 'OPP-106',
    customerName: 'Ray Power EPC',
    contactPerson: 'Prakash Rao',
    phone: '+91 97000 88990',
    title: '300 kW Ground Mount Fixed Tilt Structure',
    requirement: 'Galvanized C-channel posts & purlins',
    productCategory: 'HDG Ground Mounting Structures',
    estimatedQty: '300 kW',
    dealValue: 1100000,
    stage: 'Lost',
    probability: 0,
    expectedClosingDate: '2026-08-28',
    salesperson: 'Mohith JV',
    priority: 'LOW',
    lossReason: 'Customer selected local competitor offering lower steel grade',
    lastActivity: 'Customer confirmed selection of competitor on pricing basis',
    nextFollowup: null,
    createdAt: '2026-08-01T09:00:00.000Z'
  }
];

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

export const INITIAL_CRM_FOLLOWUPS = [
  {
    id: 'FOL-001',
    customerName: 'Vikram Solar Pvt Ltd',
    oppId: 'OPP-2026-101',
    oppTitle: '500 kW Industrial Rooftop Structure',
    activityType: 'Call', // Call | WhatsApp | Email | Meeting | Site Visit | Other
    date: new Date().toISOString().split('T')[0],
    time: '11:00 AM',
    reminder: true,
    status: 'Upcoming', // Upcoming | Completed | Overdue
    notes: 'Follow up with Rajesh regarding revised quotation and delivery timeline to Oragadam.',
    outcome: '',
    salesperson: 'Mohith JV',
    priority: 'HIGH'
  },
  {
    id: 'FOL-002',
    customerName: 'Waaree Energies Ltd',
    oppId: 'OPP-2026-103',
    oppTitle: '250 kW Tin Shed Solar Clamping System',
    activityType: 'WhatsApp',
    date: new Date().toISOString().split('T')[0],
    time: '02:30 PM',
    reminder: true,
    status: 'Upcoming',
    notes: 'Send proforma invoice details and request advance payment proof upload.',
    outcome: '',
    salesperson: 'Mohith JV',
    priority: 'HIGH'
  },
  {
    id: 'FOL-003',
    customerName: 'Bright Rays EPC Pvt Ltd',
    leadId: 'LEAD-2026-004',
    activityType: 'Meeting',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    time: '04:00 PM',
    reminder: true,
    status: 'Overdue',
    notes: 'Review ballasted mounting wind speed calculations with technical director.',
    outcome: '',
    salesperson: 'Mohith JV',
    priority: 'HIGH'
  },
  {
    id: 'FOL-004',
    customerName: 'Tata Power Solar Systems Ltd',
    oppId: 'OPP-2026-102',
    oppTitle: '1 MW Ground Mount Solar PV Structure',
    activityType: 'Site Visit',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    time: '10:00 AM',
    reminder: true,
    status: 'Upcoming',
    notes: 'Soil bearing test coordinate meeting at Pavagada site.',
    outcome: '',
    salesperson: 'Vijay',
    priority: 'HIGH'
  }
];

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

export const INITIAL_CRM_QUOTATIONS = [
  {
    id: 'QT-2026-012',
    quoteNumber: 'QT-2026-012',
    date: '2026-09-02',
    validUntil: '2026-09-22',
    customerName: 'Vikram Solar Pvt Ltd',
    companyName: 'Vikram Solar Pvt Ltd',
    contactPerson: 'Rajesh Kannan',
    phone: '+91 98765 43210',
    email: 'rajesh@vikramsolar.com',
    billingAddress: 'No 1427, GNT Road, Nagappa Industrial Estate, Puzhal, Chennai 600066',
    deliveryAddress: 'Oragadam Industrial Corridor, Kanchipuram, Tamil Nadu',
    oppId: 'OPP-2026-101',
    salesperson: 'Mohith JV',
    status: 'Sent', // Draft | Sent | Accepted | Revised | Cancelled
    paymentTerms: '50% Advance + 50% Dispatch',
    deliveryTerms: 'Ex-Works Chennai, within 7 working days from advance receipt',
    notes: 'Price includes structural warranty of 10 years against manufacturing defects. Anodized 15 micron minimum.',
    items: [
      { name: 'Solar Mounting Rail 2414mm (6063-T6)', sku: 'ALU-LEN-2414MM', category: 'Aluminium Rails', qty: 500, unit: 'Pieces', rate: 1200, discount: 2, gstRate: 18 },
      { name: 'Mid Clamp Assembly 35mm with EPDM', sku: 'RM-CLP-MID-35', category: 'Clamps', qty: 1200, unit: 'Pieces', rate: 45, discount: 0, gstRate: 18 },
      { name: 'End Clamp Assembly 35mm with EPDM', sku: 'RM-CLP-END-35', category: 'Clamps', qty: 400, unit: 'Pieces', rate: 40, discount: 0, gstRate: 18 },
      { name: 'SS304 Allen Bolt M8 x 25mm + Spring Nut', sku: 'FAST-SS-M8-25', category: 'Fasteners', qty: 1600, unit: 'Sets', rate: 15, discount: 0, gstRate: 18 }
    ],
    subtotal: 1054000,
    discountTotal: 12000,
    taxableAmount: 1042000,
    gstTotal: 187560,
    grandTotal: 1229560
  },
  {
    id: 'QT-2026-015',
    quoteNumber: 'QT-2026-015',
    date: '2026-09-04',
    validUntil: '2026-09-24',
    customerName: 'Tata Power Solar Systems Ltd',
    companyName: 'Tata Power Solar Systems Ltd',
    contactPerson: 'Karthik Raja',
    phone: '+91 98450 12345',
    email: 'karthik.raja@tatapower.com',
    billingAddress: 'Corporate Park, Phase 2, Whitefield, Bengaluru 560066',
    deliveryAddress: 'Pavagada Solar Park, Tumkur District, Karnataka',
    oppId: 'OPP-2026-102',
    salesperson: 'Vijay',
    status: 'Sent',
    paymentTerms: 'Net 30 Days',
    deliveryTerms: 'FOR Pavagada Site, delivered in staggered batches',
    notes: 'Hot Dip Galvanized coating 80 microns minimum conforming to IS 4759 standards.',
    items: [
      { name: 'HDG C Purlin 100 x 50 x 2mm x 6000mm', sku: 'HDG-C-PURLIN-6M', category: 'HDG Structure', qty: 400, unit: 'Nos', rate: 4500, discount: 0, gstRate: 18 },
      { name: 'HDG Column Post 120 x 60 x 2.5mm x 2500mm', sku: 'HDG-COL-POST-2.5M', category: 'HDG Structure', qty: 200, unit: 'Nos', rate: 3800, discount: 0, gstRate: 18 },
      { name: 'HDG Rafter Section 100 x 50 x 2mm x 4200mm', sku: 'HDG-RAF-4.2M', category: 'HDG Structure', qty: 200, unit: 'Nos', rate: 3200, discount: 0, gstRate: 18 }
    ],
    subtotal: 3200000,
    discountTotal: 0,
    taxableAmount: 3200000,
    gstTotal: 576000,
    grandTotal: 3776000
  }
];

export const INITIAL_CRM_ACTIVITIES = [
  {
    id: 'ACT-001',
    entityType: 'lead',
    entityId: 'LEAD-2026-001',
    customerName: 'Adani Green Energy Ltd',
    type: 'whatsapp_inquiry',
    title: 'WhatsApp Enquiry Received',
    description: 'Inbound message: "Hi, I need solar structure for 100 panels. What is the price?"',
    actor: 'Amit Sharma (Customer)',
    timestamp: new Date(Date.now() - 25 * 60000).toISOString()
  },
  {
    id: 'ACT-002',
    entityType: 'lead',
    entityId: 'LEAD-2026-001',
    customerName: 'Adani Green Energy Ltd',
    type: 'auto_lead_created',
    title: 'Lead Automatically Created via WhatsApp',
    description: 'Auto-created Lead #LEAD-001 from incoming WhatsApp +91 98111 22334. Assigned to Mohith JV.',
    actor: 'System Bot',
    timestamp: new Date(Date.now() - 24 * 60000).toISOString()
  },
  {
    id: 'ACT-003',
    entityType: 'opportunity',
    entityId: 'OPP-2026-101',
    customerName: 'Vikram Solar Pvt Ltd',
    type: 'quotation_sent',
    title: 'Quotation #QT-2026-012 Sent',
    description: 'Sent quotation PDF via WhatsApp & Email to Rajesh Kannan (Deal value: ₹ 12.5 L).',
    actor: 'Mohith JV',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString()
  },
  {
    id: 'ACT-004',
    entityType: 'opportunity',
    entityId: 'OPP-2026-103',
    customerName: 'Waaree Energies Ltd',
    type: 'customer_confirmation',
    title: 'Commercial Confirmation Received',
    description: 'Dharmesh Patel confirmed order for 250 kW Tin Shed System. Waiting for advance RTGS proof.',
    actor: 'Mohith JV',
    timestamp: new Date(Date.now() - 120 * 60000).toISOString()
  }
];

/**
 * Universal safe store loader and syncer
 */
export function getCrmStore(key, initialData = []) {
  try {
    const raw = localStorage.getItem(`businz_crm_${key}`) || 
                localStorage.getItem(`controlroom_crm_${key}`) || 
                localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
