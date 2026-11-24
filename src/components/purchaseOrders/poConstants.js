export const COMPANY_LOCATIONS = {
  'VRM Structures India Pvt Ltd': {
    name: 'VRM Structures India Pvt Ltd',
    locationLabel: 'VRM Structures India Pvt Ltd',
    address: '1427, GNT Road, Nagappa Industrial Estate, Madhavaram, Chennai, Tamil Nadu - 600066',
    address1: '1427, GNT Road, Nagappa Industrial Estate',
    address2: 'Madhavaram',
    city: 'Chennai',
    pincode: '600066',
    gst: '33AAGCV4262N1ZZ',
    email: 'contact@vrmstructures.com',
    phone: '+91 98847 20789',
    state: 'Tamil Nadu'
  },
  'VRM Structures (AP)': {
    name: 'VRM Structures India Pvt Ltd',
    locationLabel: 'VRM Structures (AP)',
    address: 'NO 150B, PERUMAL KOVIL STREET, Padi. Tada, District - Thirupati, TADA, Andhra Pradesh - 524401, India',
    address1: 'NO 150B, PERUMAL KOVIL STREET, Padi. Tada',
    address2: 'District - Thirupati',
    city: 'TADA',
    pincode: '524401',
    gst: '37AAGCV4262N1ZR',
    email: 'ap@vrmstructures.com',
    phone: '+91 98847 20789',
    state: 'Andhra Pradesh'
  },
  'Jashsun': {
    name: 'Jash Sun Power Dynamics Private Limited',
    locationLabel: 'Jashsun',
    address: '2nd, 1/135A, JASH SUN, 2nd Street, Elavanthangal, Kelambakkam, Chengalpattu, Tamil Nadu - 603103, India',
    address1: '2nd, 1/135A, JASH SUN, 2nd Street, Elavanthangal',
    address2: 'Kelambakkam',
    city: 'Chengalpattu',
    pincode: '603103',
    gst: '33AAGCJ6197G1ZC',
    email: 'contact@jashsun.com',
    phone: '+91 98847 20789',
    state: 'Tamil Nadu'
  }
};
// Alias legacy keys for backward compatibility
COMPANY_LOCATIONS['VRM Structures (Madhavaram)'] = COMPANY_LOCATIONS['VRM Structures India Pvt Ltd'];

export const getCompanyProfile = (locationKey) => {
  if (!locationKey) return COMPANY_LOCATIONS['VRM Structures India Pvt Ltd'];
  const norm = String(locationKey).trim().toLowerCase();
  if (norm.includes('ap') || norm.includes('andhra') || norm.includes('tada') || norm.includes('nellore')) {
    return COMPANY_LOCATIONS['VRM Structures (AP)'];
  }
  if (norm.includes('jash') || norm.includes('sun')) {
    return COMPANY_LOCATIONS['Jashsun'];
  }
  return COMPANY_LOCATIONS['VRM Structures India Pvt Ltd'];
};

export const PRESET_MATERIALS = [
  { name: 'GI Steel Coil 2mm', account: 'Raw Material', unit: 'MT', rate: 45000, tax: 18 },
  { name: 'GI Steel Coil 1.6mm', account: 'Raw Material', unit: 'MT', rate: 43000, tax: 18 },
  { name: 'CRC Sheet 1.2mm', account: 'Raw Material', unit: 'MT', rate: 52000, tax: 18 },
  { name: 'Self Drilling Screw', account: 'Consumables', unit: 'NOS', rate: 3.5, tax: 18 },
  { name: 'Hex Bolt M10', account: 'Fasteners', unit: 'NOS', rate: 6.2, tax: 18 },
  { name: 'Structural Steel I-Beam', account: 'Raw Material', unit: 'MT', rate: 48000, tax: 18 },
  { name: 'Electrical Copper Cable 4sqmm', account: 'Consumables', unit: 'MTR', rate: 120, tax: 18 },
  { name: 'Cement Bag 50kg', account: 'Raw Material', unit: 'NOS', rate: 410, tax: 18 },
  { name: 'Industrial Fan 5KW', account: 'Raw Material', unit: 'KW', rate: 18500, tax: 18 }
];

export const TERMS_PRESETS = [
  {
    key: 'inverter',
    label: 'Solar Inverter',
    text: `1. Inverter shall be supplied as per approved technical specifications and make/model mentioned in the PO.
2. Material should be new, unused, and supplied with original manufacturer warranty certificate.
3. Supplier shall provide required documents including test certificates, datasheets, manuals, and warranty details along with material.
4. Delivery shall be completed within the agreed timeline from the date of PO.
5. Any damage/defect found during inspection shall be replaced by the supplier at no additional cost.
6. Payment will be released before dispatch of the material.
7. Warranty support and service shall be provided by the supplier/manufacturer as per warranty conditions.
8. Material shall be properly packed to avoid any transit damage.
9. GST and other applicable taxes shall be as per agreed quotation.
10. Supplier shall ensure the inverter is compatible with the required solar system specifications.`
  },
  {
    key: 'solar_panels',
    label: 'Solar Panels',
    text: `1. Supply of solar panels shall be as per the approved specifications and PO requirements.
2. Panels shall be new, unused, and free from any manufacturing defects.
3. Manufacturer's warranty documents shall be provided along with the material.
4. Material shall be supplied with all relevant test certificates and compliance documents.
5. Any damaged, defective, or short-supplied material shall be replaced by the supplier at no additional cost.
6. Delivery shall be made as per the agreed schedule mentioned in the PO.
7. Packing and transportation shall be in the supplier's scope to ensure safe delivery.
8. GST and other applicable taxes shall be clearly mentioned in the invoice.
9. Payment shall be made as per the mutually agreed payment terms mentioned in the PO.
10. Final acceptance of the material is subject to inspection at the delivery site.`
  },
  {
    key: 'general_material',
    label: 'General Material',
    text: `1. Material shall be supplied as per the specifications and quantity mentioned in the Purchase Order.
2. Material must be free from rust, defects, and physical damage.
3. Delivery shall be made as per the committed schedule.
4. Supplier shall provide a tax invoice along with the material.
5. Any rejected material due to quality issues shall be replaced by the supplier at no additional cost.
6. Material shall be properly packed to avoid damage during transit.
7. Any deviation from the PO specifications must be approved before dispatch.
8. Payment Terms: 100% payment shall be made before dispatch of the material.`
  },
  {
    key: 'aluminium_profile',
    label: 'Aluminium Profile',
    text: `1. Material: Aluminium Profile as per approved drawing/specification.
2. Quantity: As per Purchase Order.
3. Quality: Material should be free from dents, scratches, bends, and manufacturing defects.
4. Test Certificate: Material Test Certificate (MTC) to be provided along with the material.
5. Delivery: Material to be supplied as per the delivery schedule mentioned in the PO.
6. Packing: Proper packing to be ensured to avoid transit damage.
7. Inspection: Material is subject to inspection and acceptance at our site.
8. Payment Terms: 30 days credit from the date of material receipt and invoice submission.
9. Taxes: GST shall be applicable as per government norms.
10. Rejected or damaged material, if any, shall be replaced by the supplier at no additional cost.`
  },
  {
    key: 'cables',
    label: 'Cables (AC, DC & Earthing)',
    text: `1. Material shall be supplied as per approved specification, make, size, and quantity mentioned in the Purchase Order.
2. Cable shall be new, unused, and supplied with proper packing.
3. Material should be free from defects and damage; any defective material found will be replaced by the supplier at their cost.
4. Cable length, size, and quality shall be as per PO requirement and manufacturer standards.
5. Test certificates / quality certificates shall be provided along with the material, if required.
6. Delivery shall be completed within the agreed timeline mentioned in the PO.
7. Material should be supplied with proper invoice and required documents.
8. Payment will be released before dispatch of the material.
9. Any shortage in quantity or transit damage shall be informed and resolved by the supplier.
10. Warranty shall be as per manufacturer’s standard terms.`
  }
];
