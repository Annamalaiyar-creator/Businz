export const QUOTATION_TERMS_PRESETS = [
  {
    key: 'standard_mms',
    label: 'Standard Solar MMS',
    text: `1. Validity: This quotation is valid for 15 days from the proposal date. Raw material price escalation clause applies thereafter.
2. Payment Terms: 50% advance along with confirmed Purchase Order / PI approval, balance 50% prior to material dispatch from our manufacturing facility.
3. Delivery Timeline: Dispatch within 7 to 10 working days from receipt of advance payment and approved engineering drawings.
4. Taxes & Duties: GST 18% is applicable as per Govt. statutory norms and charged extra.
5. Structural Warranty: 10 Years limited warranty against manufacturing defects for Aluminium 6063 T6 anodized rails & SS304 hardware.
6. Freight & Transit: Freight charges on to-pay basis or as agreed. Transit insurance by consignee. Unloading at site is in customer's scope.`
  },
  {
    key: 'aluminium_rails',
    label: 'Aluminium Rooftop Rails',
    text: `1. Scope: Supply of high-strength Aluminium 6063 T6 anodized rails, end clamps, mid clamps, and SS304 fasteners as per quotation scope.
2. Price Validity: Offer valid for 15 days from quote date.
3. Payment Terms: 50% advance along with PO, 50% against proforma invoice before dispatch.
4. Delivery: Within 5 to 7 days from advance receipt.
5. Quality & Warranty: Anodized coating 15+ microns, 10 Years warranty against structural corrosion.
6. Freight: Ex-works Chennai / freight to-pay basis. Unloading and site storage in buyer's scope.`
  },
  {
    key: 'hdg_ground',
    label: 'HDG Ground Mounting',
    text: `1. Material Specification: Hot Dip Galvanized (HDG) steel structures with minimum 80 microns coating conforming to IS 4759.
2. Validity: 10 days validity due to steel raw material market fluctuations.
3. Payment: 40% advance with order, 50% against readiness of material before dispatch, 10% on delivery.
4. Fabrication & Delivery: 15 to 20 working days based on project schedule and approved structure drawings.
5. Inspection: Factory inspection allowed before dispatch with prior intimation.
6. Freight & Insurance: Transportation arranged to project site on agreed freight terms; transit insurance in buyer's scope.`
  },
  {
    key: 'tin_shed',
    label: 'Tin Shed Industrial Kits',
    text: `1. Solution: Non-penetrative / penetrative tin shed mini rails, EPDM rubber gaskets, self-drilling screws, and clamp accessories.
2. Price Validity: 15 days from date of issue.
3. Payment Terms: 100% advance payment prior to dispatch.
4. Delivery Period: 3 to 5 business days from payment confirmation.
5. Testing & Warranty: Wind speed tested up to 170 km/h, 10 Years performance warranty.
6. Transportation: Dispatch via local transport / courier; freight paid by customer.`
  },
  {
    key: 'credit_30',
    label: '30 Days Credit (Approved EPC)',
    text: `1. Payment Terms: 30 days credit from the date of site delivery and original invoice submission.
2. Quotation Validity: Valid for 30 days from proposal date.
3. Delivery: Guaranteed dispatch within 7 to 10 days of formal PO issuance.
4. Statutory Taxes: GST 18% applicable as extra.
5. Warranty & Replacement: 10 Years manufacturer structural warranty. Any transit damaged goods replaced free of cost within 7 days.
6. Site Unloading: Consignee / client scope.`
  }
];

export const QUOTE_SENDING_TEMPLATES = [
  {
    key: 'official_intro',
    title: 'Official Commercial Proposal',
    channel: 'Both',
    subject: 'Commercial Quotation for Solar MMS — {{quoteNumber}} | VRM Structures',
    body: `Dear {{customerName}},

Greetings from VRM Structures India Pvt Ltd.

Thank you for your interest in our precision-engineered solar module mounting structures. We are pleased to present our official commercial proposal #{{quoteNumber}} dated {{quoteDate}} for your project requirement:

• Project / Scope: {{structureType}} ({{capacityKw}} kW)
• Quotation Total: {{formattedTotal}} (inclusive of taxes)
• Validity: {{validityDays}} days from proposal date
• Delivery Timeline: 7–10 working days from PO & advance payment

Attached / enclosed please find the itemized quotation along with our structural drawings and structural warranty certificate. 

Please review and feel free to revert if you require any technical adjustments or revisions. We look forward to partnering with your esteemed organization.

Warm regards,
{{salesRep}}
Sales & Engineering Division
VRM Structures India Pvt Ltd
Phone: +91 98400 12345 | sales@vrmstructures.com`
  },
  {
    key: 'quick_whatsapp',
    title: 'Quick WhatsApp Summary',
    channel: 'WhatsApp',
    subject: 'Quotation {{quoteNumber}} — VRM Structures',
    body: `Hi {{customerName}},

Greetings from VRM Structures.

Please find our commercial quotation *#{{quoteNumber}}* for your *{{structureType}}* requirement:

*Grand Total:* {{formattedTotal}}
*Scope:* {{itemCount}} line items ({{capacityKw}} kW capacity)
*Validity:* {{validityDays}} days
*Lead Time:* 7–10 days from drawing approval & advance

Detailed quotation PDF and drawing sheets are ready for your review. Would you like to schedule a quick 5-minute call today to go over any questions?

Best regards,
*{{salesRep}}* | VRM Structures`
  },
  {
    key: 'revision_update',
    title: 'Quotation Revision Notice',
    channel: 'Both',
    subject: 'Revised Quotation {{quoteNumber}} (Rev #{{revCount}}) — VRM Structures',
    body: `Dear {{customerName}},

Hope you are having a productive week.

As per your latest technical feedback and updated site requirements, we have revised commercial quotation #{{quoteNumber}} (Revision #{{revCount}}).

Key updates made:
• Revised Scope: {{structureType}}
• Revised Total: {{formattedTotal}}
• Payment Terms: {{paymentTerms}}

The updated quotation sheet has been generated for your final clearance. Please let us know if everything is in order to issue the Proforma Invoice (PI) and lock production slots.

Warm regards,
{{salesRep}}
VRM Structures India Pvt Ltd`
  },
  {
    key: 'urgent_approval',
    title: 'Price Validity & Fast-Track Lead',
    channel: 'Both',
    subject: 'Urgent: Quotation {{quoteNumber}} Price Lock Confirmation — VRM Structures',
    body: `Dear {{customerName}},

Regarding quotation #{{quoteNumber}} for {{structureType}} (Amount: {{formattedTotal}}), this is a friendly reminder that raw material price validity is active for this week.

To secure this pricing and ensure our priority manufacturing dispatch within 7 days, kindly confirm your approval so we can release the Proforma Invoice (PI) today.

Thank you for your continued trust in VRM Structures.

Best regards,
{{salesRep}}
VRM Structures India Pvt Ltd`
  }
];
