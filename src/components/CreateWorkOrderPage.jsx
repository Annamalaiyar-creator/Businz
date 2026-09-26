import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Send, 
  Layers, 
  FileText, 
  Clock, 
  CheckCircle2, 
  ArrowLeft,
  AlertTriangle,
  Info,
  CheckCircle,
  Package,
  Boxes,
  Cpu,
  RotateCcw,
  Lightbulb,
  Zap
} from 'lucide-react';
import { prodModuleEngine } from '../utils/productionModuleEngine';
import { VRM_PRODUCTS } from '../utils/vrmProductsData';
import NotificationToast from './NotificationToast';
import { addLiveNotification } from './Header';

export const PRODUCT_CATALOG_OPTIONS = [
  { label: "Double C Rail NEW", code: "CC4.8N", totalLen: 4800, defaultCutLen: 4800, profileGroup: "double_c" },
  { label: "Double C Rail", code: "CC3.6", totalLen: 3600, defaultCutLen: 3600, profileGroup: "double_c" },
  { label: "Strut Rail", code: "SR3.6", totalLen: 3600, defaultCutLen: 3600, profileGroup: "strut_rail" },
  { label: "Mini Rail - 300mm", code: "MR-300MM", totalLen: 2414, defaultCutLen: 300, profileGroup: "mini_rail" },
  { label: "Mini Rail - 100mm", code: "MR100O", totalLen: 2414, defaultCutLen: 100, profileGroup: "mini_rail" },
  { label: "Mini Rail - 100mm (New)", code: "MR100N", totalLen: 2414, defaultCutLen: 100, profileGroup: "mini_rail" },
  { label: "Locking Nut", code: "LC", totalLen: 3000, defaultCutLen: 40, profileGroup: "locking_nut" },
  { label: "Mini Rail - 60mm", code: "MR60", totalLen: 2414, defaultCutLen: 60, profileGroup: "mini_rail" },
  { label: "Mini Rail - 40mm", code: "MR40", totalLen: 2414, defaultCutLen: 40, profileGroup: "mini_rail" },
  { label: "Adhesive rail 100 mm", code: "AR100", totalLen: 2414, defaultCutLen: 100, profileGroup: "adhesive_rail" },
  { label: "Adhesive rail 120 mm", code: "AR120", totalLen: 2414, defaultCutLen: 120, profileGroup: "adhesive_rail" },
  { label: "Mid Section", code: "MID-SEC", totalLen: 2730, defaultCutLen: 2730, profileGroup: "mid_sec" },
  { label: "Top Section - 2 Mtr", code: "TOP-2M", totalLen: 2000, defaultCutLen: 2000, profileGroup: "top_sec" },
  { label: "Bottom Section - 2 Mtr", code: "BOT-2M", totalLen: 2000, defaultCutLen: 2000, profileGroup: "bot_sec" },
  { label: "Top Section - 1.5 Mtr", code: "TOP-1.5M", totalLen: 1500, defaultCutLen: 1500, profileGroup: "top_sec" },
  { label: "Bottom Section - 2.4 Mtr", code: "BOT-2.4M", totalLen: 2400, defaultCutLen: 2400, profileGroup: "bot_sec" },
  { label: "Mid Clamp - 47 mm", code: "MC47", totalLen: 2650, defaultCutLen: 47, profileGroup: "clamp" },
  { label: "Mid Clamp - 35 mm", code: "MC35", totalLen: 2650, defaultCutLen: 35, profileGroup: "clamp" },
  { label: "Mid Clamp - 30 mm", code: "MC30", totalLen: 2650, defaultCutLen: 30, profileGroup: "clamp" },
  { label: "T Nut -10mm", code: "T10", totalLen: 2562, defaultCutLen: 10, profileGroup: "t_nut" },
  { label: "Mid Clamp (Universal)", code: "UM", totalLen: 2650, defaultCutLen: 35, profileGroup: "clamp" },
  { label: "End Clamp 35mm (New)", code: "UE", totalLen: 2650, defaultCutLen: 35, profileGroup: "clamp" },
  { label: "End Clamp 35mm", code: "EC35", totalLen: 2650, defaultCutLen: 35, profileGroup: "clamp" },
  { label: "L Bracket", code: "ALB", totalLen: 2050, defaultCutLen: 50, profileGroup: "l_bracket" },
  { label: "T Nut (KMC) - 8mm", code: "T8", totalLen: 2580, defaultCutLen: 8, profileGroup: "t_nut_kmc" }
];

export default function CreateWorkOrderPage({ onBack, onWorkOrderCreated }) {
  // 1. GENERAL & PRODUCTION STATE
  const [formStep, setFormStep] = useState(1); // 1 = General Details, 2 = Process Routing & Work Plan
  const [woNumber, setWoNumber] = useState(() => prodModuleEngine.getNextWoNumber());
  const [woDate, setWoDate] = useState(new Date().toISOString().split('T')[0]);
  // Multi-Product Target Output Items List (Initializes completely empty for new Work Order)
  const [productItems, setProductItems] = useState([
    { id: 1, productCode: '', cutLength: '', targetQty: '' }
  ]);

  // Helper to dynamically resolve person names for assigned heads from login session or registered database
  const getAssignedHeadPersonName = (roleType) => {
    if (typeof window === 'undefined') return roleType;
    const currentRole = localStorage.getItem('controlroom_user_role') || '';
    const currentName = localStorage.getItem('controlroom_logged_user_name') || '';

    // 1. If active logged-in user holds this role, prioritize their active name
    if (currentName && !currentName.includes('@') && currentName !== 'undefined' && currentName !== 'null') {
      if (roleType === 'Floor Supervisor' && (currentRole === 'Floor Supervisor' || currentRole.toLowerCase().includes('supervisor'))) {
        return currentName;
      }
      if (roleType === 'Dispatch Head' && (currentRole === 'Dispatch Head' || currentRole.toLowerCase().includes('dispatch'))) {
        return currentName;
      }
    }

    // 2. Look up in registered employees from local storage or cloud store
    try {
      const stored = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      const cloudStored = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
      const allEmps = [...(Array.isArray(stored) ? stored : []), ...(Array.isArray(cloudStored) ? cloudStored : [])];

      const match = allEmps.find(e => {
        if (!e) return false;
        const r = String(e.role || '').toLowerCase();
        if (roleType === 'Floor Supervisor') {
          return r === 'floor supervisor' || r.includes('supervisor');
        }
        if (roleType === 'Dispatch Head') {
          return r === 'dispatch head' || r.includes('dispatch');
        }
        return false;
      });

      if (match) {
        const empName = match.employee_name || match.name;
        if (empName && !empName.includes('@') && empName !== 'undefined' && empName !== 'null') {
          return empName;
        }
      }
    } catch (e) {}

    // Fallbacks
    if (roleType === 'Dispatch Head') return 'Kalpana';
    if (roleType === 'Floor Supervisor') return 'Floor Supervisor';
    return roleType;
  };

  // Creator details dynamically derived from active logged-in session account
  const resolveLoggedPersonName = () => {
    if (typeof window === 'undefined') return 'Production Head';
    const storedName = localStorage.getItem('controlroom_logged_user_name');
    const storedUser = localStorage.getItem('controlroom_logged_user') || '';
    const userRole = localStorage.getItem('controlroom_user_role') || 'Production Head';

    // If storedName exists and is not an email address, use it
    if (storedName && !storedName.includes('@') && storedName !== 'undefined' && storedName !== 'null') {
      return storedName;
    }

    // Attempt to match from registered employees list
    try {
      const emps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      const cloudEmps = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
      const allEmps = [...emps, ...cloudEmps];
      const found = allEmps.find(e => 
        (e.email && e.email.toLowerCase() === storedUser.toLowerCase()) ||
        (storedName && e.employee_name && e.employee_name.toLowerCase() === storedName.toLowerCase()) ||
        (e.role && e.role === userRole)
      );
      if (found && found.employee_name) {
        return found.employee_name;
      }
    } catch (e) {}

    // Fallbacks mapped by role
    if (userRole === 'Production Head') return 'Senthil Kumar';
    if (userRole === 'Technical Administrator' || userRole === 'CEO') return 'Annamalaiyar';
    if (userRole === 'Dispatch Head') return getAssignedHeadPersonName('Dispatch Head');
    if (userRole === 'Floor Supervisor') return getAssignedHeadPersonName('Floor Supervisor');
    if (userRole === 'Floor Employee') return 'Ramesh';
    if (userRole === 'Accounts Head') return 'Venkatesh';
    if (userRole === 'Accounts Executive') return 'Priya';
    if (userRole === 'Sales Head') return 'Vijay';
    if (userRole === 'Sales Executive') return 'Mohith JV';
    if (userRole === 'Design Engineer') return 'Dinesh';
    if (userRole === 'Procurement Head' || userRole === 'Procurement Admin') return 'ARUN BOOPATHI M';

    // If storedUser was an email, strip @domain or capitalize
    if (storedUser && !storedUser.includes('@')) {
      return storedUser;
    }
    if (storedUser && storedUser.includes('@')) {
      const prefix = storedUser.split('@')[0].replace(/[._-]/g, ' ');
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }

    return 'Senthil Kumar';
  };

  const loggedUserName = resolveLoggedPersonName();
  const loggedUserRole = typeof window !== 'undefined'
    ? (localStorage.getItem('controlroom_user_role') || 'Production Head')
    : 'Production Head';
  const creatorDisplay = `${loggedUserName} (${loggedUserRole})`;

  // Helper to load real registered Floor Employees & Operators alone (excluding Production Head/Executives/CEO)
  const loadEmployees = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      const cloudStored = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
      const combined = [...(Array.isArray(stored) ? stored : []), ...(Array.isArray(cloudStored) ? cloudStored : [])];
      
      const empMap = new Map();
      combined.forEach(emp => {
        if (!emp) return;
        const code = emp.employee_code || emp.code || emp.id;
        if (code && !empMap.has(code)) {
          empMap.set(code, emp);
        }
      });

      const all = Array.from(empMap.values());
      // Return strictly Floor Employees alone (excluding Production Head, Technical Admin, CEO, Accounts, Sales, etc.)
      const filtered = all.filter(emp => {
        const roleUpper = String(emp.role || '').toUpperCase();
        const codeUpper = String(emp.employee_code || emp.code || '').toUpperCase();
        const prefixUpper = String(emp.prefix || '').toUpperCase();
        
        // Exclude management / other department roles
        if (roleUpper.includes('HEAD') || roleUpper.includes('ADMIN') || roleUpper.includes('CEO') || roleUpper.includes('ACCOUNTS') || roleUpper.includes('SALES') || roleUpper.includes('PROCUREMENT') || roleUpper.includes('DIRECTOR') || prefixUpper === 'PH' || prefixUpper === 'TA' || prefixUpper === 'CEO') {
          return false;
        }

        return roleUpper.includes('FLOOR') || roleUpper.includes('OPERATOR') || roleUpper.includes('TECHNICIAN') || roleUpper.includes('WORKER') || prefixUpper === 'FE' || codeUpper.startsWith('FE-');
      });

      // Default fallback floor employees if none registered yet
      if (filtered.length === 0) {
        return [
          { employee_name: 'Karthi', name: 'Karthi', employee_code: 'FE-101', role: 'Floor Employee' },
          { employee_name: 'Ramesh', name: 'Ramesh', employee_code: 'FE-102', role: 'Floor Employee' },
          { employee_name: 'Murugan', name: 'Murugan', employee_code: 'FE-103', role: 'Floor Employee' },
          { employee_name: 'Saravanan', name: 'Saravanan', employee_code: 'FE-104', role: 'Floor Employee' }
        ];
      }

      return filtered;
    } catch (e) {
      return [];
    }
  };

  const [floorEmployeesList, setFloorEmployeesList] = useState(loadEmployees);

  // Reload employee list on mount to catch any recently created accounts
  useEffect(() => {
    setFloorEmployeesList(loadEmployees());
  }, []);

  const [assignedEmployee, setAssignedEmployee] = useState('');
  const [assignedHeads, setAssignedHeads] = useState(['Floor Supervisor', 'Dispatch Head']);
  const floorSupervisorName = getAssignedHeadPersonName('Floor Supervisor');
  const dispatchHeadName = getAssignedHeadPersonName('Dispatch Head');

  const [priority, setPriority] = useState('');
  const [productionLocation, setProductionLocation] = useState('');
  const [expectedStartDate, setExpectedStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [remarks, setRemarks] = useState('');
  const [leftoverStrategy, setLeftoverStrategy] = useState('OVER_PRODUCE_FG');
  const [toastAlert, setToastAlert] = useState(null);
  const [customProductName, setCustomProductName] = useState('');

  // Synchronize available product catalog with both predefined options and any newly created items in prodModuleEngine
  const [availableCatalog, setAvailableCatalog] = useState(() => {
    const list = [...PRODUCT_CATALOG_OPTIONS];
    try {
      const engineInv = prodModuleEngine.getInventory() || [];
      engineInv.forEach(item => {
        if (item.category === 'Finished Goods' && !list.some(p => p.code === item.code)) {
          list.push({
            code: item.code,
            label: `${item.name} (${item.code})`,
            totalLen: 2414
          });
        }
      });
    } catch (_) {}
    return list;
  });

  // Operations & Process Work Plan State (Cutting, Punching, QC, Packing, etc.)
  const [processWorkPlan, setProcessWorkPlan] = useState([]);

  const handleAddWorkPlanStep = () => {
    const defaultOp = floorEmployeesList.length > 0 
      ? (floorEmployeesList[0].employee_name || floorEmployeesList[0].name || '')
      : '';
    setProcessWorkPlan(prev => [
      ...prev,
      {
        id: Date.now(),
        stepNo: prev.length + 1,
        opName: '',
        machine: 'C - 1',
        operator: defaultOp,
        estTimeHours: '',
        estTimeMins: '',
        estTime: '',
        status: 'Pending'
      }
    ]);
  };

  const handleRemoveWorkPlanStep = (id) => {
    setProcessWorkPlan(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, stepNo: i + 1 })));
  };

  const handleUpdateWorkPlanStep = (id, field, value) => {
    setProcessWorkPlan(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // Calculation state from recipe engine
  const [matCalc, setMatCalc] = useState(null);

  const recipes = prodModuleEngine.getRecipes();

  const handleAddProductItem = () => {
    setProductItems(prev => [
      ...prev,
      { id: Date.now(), productCode: '', cutLength: '', targetQty: '' }
    ]);
  };

  const handleRemoveProductItem = (id) => {
    setProductItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateProductItem = (id, field, value) => {
    setProductItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return { ...item, [field]: value };
    }));
  };

  // Check if any product row is missing cut length or has invalid length
  const invalidCutLengthItem = productItems.find(it => {
    if (!it.productCode) return false;
    const cat = PRODUCT_CATALOG_OPTIONS.find(p => p.code === it.productCode);
    const rawLen = cat?.totalLen || 2414;
    const cut = parseFloat(String(it.cutLength || '').replace(/[^\d.]/g, '')) || 0;
    return cut <= 0 || cut > rawLen;
  });

  // Active primary product item for calculation
  const primaryItem = productItems[0] || { productCode: '', cutLength: '', targetQty: '' };
  const selectedProductCode = primaryItem.productCode;
  const cutLength = primaryItem.cutLength;
  const targetQty = primaryItem.targetQty;

  const setCutLength = (val) => {
    setProductItems(prev => prev.map((item, idx) => idx === 0 ? { ...item, cutLength: val } : item));
  };

  const setTargetQty = (val) => {
    setProductItems(prev => prev.map((item, idx) => idx === 0 ? { ...item, targetQty: val } : item));
  };

  const setSelectedProductCode = (val) => {
    setProductItems(prev => prev.map((item, idx) => idx === 0 ? { ...item, productCode: val } : item));
  };

  const getItemCutYieldRule = (pCode, pCutLen) => {
    if (!pCode) return null;
    const catalogItem = PRODUCT_CATALOG_OPTIONS.find(p => p.code === pCode);
    const rawLen = catalogItem?.totalLen || 2414;
    const parsedCutLen = parseFloat(String(pCutLen || '').replace(/[^\d.]/g, ''));
    if (!parsedCutLen || parsedCutLen <= 0 || parsedCutLen > rawLen) return null;
    const bladeKerf = 2;
    const pieces = Math.max(1, Math.floor((rawLen + bladeKerf) / (parsedCutLen + bladeKerf)));
    return {
      rawLen,
      cutLen: parsedCutLen,
      pieces,
      label: catalogItem?.label || pCode
    };
  };

  // Helper to resolve raw material stock dynamically across inventory engine & local raw store
  const resolveRawMaterialStock = (rawLen) => {
    let invMatch = (prodModuleEngine.inventory || []).find(i => 
      i.code === `ALU-LEN-${rawLen}MM` || 
      i.code === `RM-ALU-${rawLen}` ||
      (rawLen === 2414 && (i.code === 'ALU-LEN-2414MM' || i.code === 'RM-ALU-2414')) ||
      (i.lengthMm && String(i.lengthMm) === String(rawLen))
    );

    let stockFound = null;
    if (invMatch && (invMatch.availableStock !== undefined || invMatch.physicalStock !== undefined)) {
      const v = Number(invMatch.availableStock !== undefined ? invMatch.availableStock : invMatch.physicalStock);
      if (v > 0) stockFound = v;
    }

    if (stockFound === null) {
      try {
        const saved = localStorage.getItem('controlroom_raw_materials_store');
        if (saved) {
          const parsed = JSON.parse(saved);
          const found = parsed.find(m => 
            m.code === `ALU-LEN-${rawLen}MM` || 
            m.code === `RM-ALU-${rawLen}` ||
            (rawLen === 2414 && (m.code === 'ALU-LEN-2414MM' || m.code === 'RM-ALU-2414')) ||
            String(m.lengthMm) === String(rawLen)
          );
          if (found && (found.availableStock !== undefined || found.stock !== undefined)) {
            const v = Number(found.availableStock !== undefined ? found.availableStock : found.stock);
            if (v > 0) stockFound = v;
          }
        }
      } catch (_) {}
    }

    if (stockFound === null) {
      stockFound = rawLen === 2414 ? 250 : (rawLen === 2650 ? 80 : 50);
    }

    if (invMatch && stockFound > 0 && (!invMatch.availableStock || invMatch.availableStock <= 0)) {
      invMatch.availableStock = stockFound;
      invMatch.physicalStock = Math.max(invMatch.physicalStock || 0, stockFound);
    }

    return stockFound;
  };

  // Helper to fetch raw material stock count for any selected product
  const getRawMaterialStock = (pCode) => {
    if (!pCode) return null;
    const catalogItem = PRODUCT_CATALOG_OPTIONS.find(p => p.code === pCode);
    const rawLen = catalogItem?.totalLen || 2414;
    const availStock = resolveRawMaterialStock(rawLen);
    return {
      rawLen,
      rawMaterialName: `Aluminium Raw Bar (${rawLen} mm)`,
      availableStock: availStock
    };
  };

  // Multi-Material Calculation across all configured product rows
  const multiMatBreakdown = (() => {
    if (!productItems || productItems.length === 0) return [];
    
    // Group products by their raw material length profile
    const groups = new Map();
    productItems.forEach((item, idx) => {
      if (!item.productCode) return;
      const cat = PRODUCT_CATALOG_OPTIONS.find(p => p.code === item.productCode);
      const rawLen = cat?.totalLen || 2414;
      const parsedCut = parseFloat(String(item.cutLength || '').replace(/[^\d.]/g, '')) || 0;
      const parsedQty = parseFloat(item.targetQty || '') || 0;
      if (parsedCut <= 0 || parsedQty <= 0) return;

      const bladeKerf = 2;
      const piecesPerBar = Math.max(1, Math.floor((rawLen + bladeKerf) / (parsedCut + bladeKerf)));
      const barsNeeded = Math.ceil(parsedQty / piecesPerBar);

      const key = `${rawLen}`;
      if (!groups.has(key)) {
        // Find matching raw stock in inventory
        const availStock = resolveRawMaterialStock(rawLen);

        groups.set(key, {
          rawLengthMm: rawLen,
          rawMaterialName: `Aluminium Raw Length (${rawLen} mm)`,
          availableStock: availStock,
          totalBarsRequired: 0,
          items: []
        });
      }

      const group = groups.get(key);
      group.totalBarsRequired += barsNeeded;
      group.items.push({
        index: idx + 1,
        productCode: item.productCode,
        productLabel: cat?.label || item.productCode,
        cutLength: parsedCut,
        targetQty: parsedQty,
        piecesPerBar,
        barsNeeded
      });
    });

    return Array.from(groups.values()).map(g => ({
      ...g,
      isSufficient: g.availableStock >= g.totalBarsRequired,
      shortageQty: Math.max(0, g.totalBarsRequired - g.availableStock)
    }));
  })();

  const allMaterialsSufficient = multiMatBreakdown.length === 0 || multiMatBreakdown.every(m => m.isSufficient);

  // Recalculate material requirements whenever product items or selection changes
  useEffect(() => {
    if (productItems && productItems.length > 0) {
      const calc = prodModuleEngine.calculateMaterialRequirement(selectedProductCode, Number(targetQty), cutLength, productItems);
      setMatCalc(calc);
    } else {
      setMatCalc(null);
    }
  }, [productItems, selectedProductCode, cutLength, targetQty]);



  // Submit Handler
  const handleCreateWorkOrder = async (e) => {
    e.preventDefault();

    // Check for missing or invalid cut lengths in any row
    if (invalidCutLengthItem) {
      const cat = PRODUCT_CATALOG_OPTIONS.find(p => p.code === invalidCutLengthItem.productCode);
      const rawLen = cat?.totalLen || 2414;
      const parsedCut = parseFloat(String(invalidCutLengthItem.cutLength || '').replace(/[^\d.]/g, '')) || 0;
      setToastAlert({
        type: 'error',
        title: 'Cut Length Required to Proceed',
        message: parsedCut <= 0 
          ? `Cut length for ${cat?.label || invalidCutLengthItem.productCode || 'product'} is missing. Please enter a valid cut length (e.g. ${cat?.defaultCutLen || 35} mm) before proceeding.`
          : `Cut length (${parsedCut} mm) exceeds the raw bar length (${rawLen} mm) for ${cat?.label || invalidCutLengthItem.productCode}. Cannot proceed.`
      });
      return;
    }

    if (!targetQty || Number(targetQty) <= 0) {
      setToastAlert({
        type: 'error',
        title: 'Target Quantity Required',
        message: 'Please enter a valid target quantity (> 0).'
      });
      return;
    }

    if (!matCalc || matCalc.error) {
      setToastAlert({
        type: 'error',
        title: 'Material Calculation Error',
        message: 'Unable to calculate material requirement for selected product.'
      });
      return;
    }

    // Validate raw material sufficiency across all profiles
    if (!allMaterialsSufficient) {
      setToastAlert({
        type: 'error',
        title: 'Insufficient Raw Material Stock',
        message: 'There is no raw material available'
      });
      return;
    }

    if (!matCalc.isSufficient || matCalc.availableStock <= 0 || (matCalc.shortageQty && matCalc.shortageQty > 0)) {
      setToastAlert({
        type: 'error',
        title: 'Insufficient Raw Material Stock',
        message: 'There is no raw material available'
      });
      return;
    }

    try {
      const cutLenVal = cutLength ? parseFloat(String(cutLength).replace(/[^\d.]/g, '')) : 300;
      const matchedOpt = (availableCatalog || PRODUCT_CATALOG_OPTIONS).find(o => o.code === selectedProductCode);
      
      // Auto-generate code and product entry in inventory if product is not listing or new
      let fgProductCode = selectedProductCode;
      let fgProductName = matchedOpt ? matchedOpt.label : selectedProductCode;

      if (!fgProductCode || fgProductCode === 'custom_new' || !matchedOpt) {
        fgProductCode = `PROD-${Date.now().toString().slice(-5)}`;
        fgProductName = customProductName.trim() || `Finished Product (${fgProductCode})`;
      }

      // Ensure product exists in prodModuleEngine inventory catalog so it lists in inventory store
      const engineInv = prodModuleEngine.getInventory();
      let existingInEngine = engineInv.find(i => (i.code && i.code.toUpperCase() === fgProductCode.toUpperCase()) || (i.name && i.name.toLowerCase() === fgProductName.toLowerCase()));
      if (!existingInEngine) {
        const newProductCatalogItem = {
          code: fgProductCode,
          name: fgProductName,
          category: 'Finished Goods',
          unit: 'Pieces',
          physicalStock: 0,
          reservedStock: 0,
          availableStock: 0,
          issuedStock: 0,
          consumedStock: 0,
          safetyStock: 20,
          unitRate: 150,
          bayLocation: 'Bay #4 - FG Store'
        };
        prodModuleEngine.inventory.push(newProductCatalogItem);
        prodModuleEngine.saveToStorage();
      }
      
      const newWO = prodModuleEngine.createWorkOrder({
        id: woNumber,
        date: woDate,
        productionHead: creatorDisplay,
        finishedProductCode: fgProductCode,
        finishedProductName: fgProductName,
        targetQty: Number(targetQty),
        cutLength: cutLength,
        productItems: productItems,
        matCalc: matCalc,
        priority,
        productionLocation,
        assignedEmployee,
        assignedHeads,
        expectedStartDate,
        expectedCompletionDate,
        instructions,
        remarks,
        processWorkPlan,
        leftoverStrategy,
        excessFgQty: matCalc ? matCalc.excessOutputPossible : 0,
        returnedOffcutMeters: matCalc ? (matCalc.remainderOffcutMeters !== undefined ? matCalc.remainderOffcutMeters : Number((((matCalc.rawLengthMm || 2414) - (((Number(targetQty) || 0) % (matCalc.piecesPerLength || 1)) * (matCalc.cutLenMm || 100))) / 1000).toFixed(2))) : 0
      });

      addLiveNotification({
        id: `notif-wo-${Date.now()}`,
        role: 'Production Admin',
        title: 'Work Order Issued',
        message: `Work Order ${newWO.id} issued. Raw Material (${newWO.rawMaterialPhysicalToIssue} ${newWO.rawMaterialUnit}) reserved & issued to floor.`,
        time: 'Just now',
        targetTab: 'Work Orders',
        badgeColor: '#0284C7'
      });

      try {
        await fetch('/api/workorders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workOrderNo: newWO.id || woNumber,
            productName: fgProductName || newWO.finishedProductName || 'Mini Rail - 300 mm',
            productCode: fgProductCode,
            finishedProductCode: fgProductCode,
            finishedProductName: fgProductName,
            plannedQty: Number(targetQty),
            completedQty: 0,
            status: 'PENDING_MATERIAL',
            targetDate: expectedCompletionDate || woDate
          })
        });
      } catch (e) {
        console.error('Server sync failed:', e);
      }

      if (onWorkOrderCreated) {
        onWorkOrderCreated(newWO);
      } else if (onBack) {
        onBack();
      }
    } catch (err) {
      setToastAlert({
        type: 'error',
        title: 'Uh oh! Something went wrong',
        message: err.message || 'Error creating Work Order.'
      });
    }
  };

  const inputStyle = {
    width: '100%',
    height: '40px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    padding: '0 12px',
    fontSize: '13px',
    fontWeight: '600',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#FFFFFF',
    color: '#64748B'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', minWidth: 0, fontFamily: "'DM Sans', sans-serif" }}>
      
      {/* HEADER BANNER */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        padding: '18px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F172A' }}>Create Work Order</h1>
          <p style={{ fontSize: '12.5px', color: '#64748B', margin: '2px 0 0 0' }}>
            Step {formStep} of 2: {formStep === 1 ? 'Product Recipe & Material Details' : 'Manufacturing Process Routing & Work Plan'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{ border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* STEP PROGRESS STEPPER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: '#FFFFFF', padding: '16px 24px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        
        {/* Step 1 Pill */}
        <div
          onClick={() => setFormStep(1)}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
        >
          <span style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: formStep === 1 ? '#0E7490' : '#E2E8F0',
            color: formStep === 1 ? '#FFFFFF' : '#64748B',
            fontWeight: '800',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            1
          </span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: formStep === 1 ? '#0F172A' : '#64748B' }}>
              Work Order & Material Details
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>
              Product recipe, target output, dates
            </div>
          </div>
        </div>

        {/* Connector Line */}
        <div style={{ flex: 1, height: '2px', backgroundColor: formStep === 2 ? '#0E7490' : '#E2E8F0', margin: '0 8px' }} />

        {/* Step 2 Pill */}
        <div
          onClick={() => {
            if (invalidCutLengthItem) {
              const cat = PRODUCT_CATALOG_OPTIONS.find(p => p.code === invalidCutLengthItem.productCode);
              const rawLen = cat?.totalLen || 2414;
              const parsedCut = parseFloat(String(invalidCutLengthItem.cutLength || '').replace(/[^\d.]/g, '')) || 0;
              setToastAlert({
                type: 'error',
                title: 'Cut Length Required to Proceed',
                message: parsedCut <= 0 
                  ? `Cut length for ${cat?.label || invalidCutLengthItem.productCode || 'product'} is missing. Please enter a valid cut length (e.g. ${cat?.defaultCutLen || 35} mm) before proceeding.`
                  : `Cut length (${parsedCut} mm) exceeds the raw bar length (${rawLen} mm) for ${cat?.label || invalidCutLengthItem.productCode}. Cannot proceed.`
              });
              return;
            }
            if (!targetQty || Number(targetQty) <= 0) {
              setToastAlert({
                type: 'error',
                title: 'Target Quantity Required',
                message: 'Please enter a target quantity in Step 1 before proceeding.'
              });
              return;
            }
            setFormStep(2);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
        >
          <span style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: formStep === 2 ? '#0E7490' : '#E2E8F0',
            color: formStep === 2 ? '#FFFFFF' : '#64748B',
            fontWeight: '800',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            2
          </span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: formStep === 2 ? '#0F172A' : '#64748B' }}>
              Manufacturing Process Routing & Work Plan
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>
              Cutting, Slot Punching, QC, Packing steps
            </div>
          </div>
        </div>

      </div>

      {formStep === 2 ? (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          
          {/* STEP 2 TITLE BAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                Manufacturing Process Routing & Work Plan
              </h3>
              <p style={{ fontSize: '12.5px', color: '#64748B', margin: '4px 0 0 0' }}>
                Define sequential shop-floor operations & assign machine workstations and operators.
              </p>
            </div>
          </div>

          {/* PROCESS STEPS TABLE */}
          <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: '700', fontSize: '12px' }}>
                  <th style={{ padding: '12px 14px', width: '50px', textAlign: 'center' }}>Step</th>
                  <th style={{ padding: '12px 14px' }}>Process Operation Description</th>
                  <th style={{ padding: '12px 14px' }}>Workstation / Machine</th>
                  <th style={{ padding: '12px 14px' }}>Assigned Floor Employee</th>
                  <th style={{ padding: '12px 14px', width: '130px' }}>Est. Cycle Time</th>
                  <th style={{ padding: '12px 14px', width: '60px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {processWorkPlan.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '28px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                      No process operations added yet. Click <strong style={{ color: '#0E7490' }}>+ Add Process Step</strong> below to add rows.
                    </td>
                  </tr>
                ) : (
                  processWorkPlan.map((step, idx) => (
                    <tr key={step.id} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '800', color: '#0E7490' }}>
                        <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#ECFEFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {step.stepNo}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <input
                          type="text"
                          value={step.opName}
                          placeholder="e.g. Uncoiling & Cut to Length"
                          onChange={(e) => handleUpdateWorkPlanStep(step.id, 'opName', e.target.value)}
                          style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '13px', color: '#334155', fontWeight: '600', outline: 'none' }}
                        />
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <select
                          value={step.machine}
                          onChange={(e) => handleUpdateWorkPlanStep(step.id, 'machine', e.target.value)}
                          style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '13px', color: '#475569', outline: 'none', fontWeight: '600' }}
                        >
                          <option value="C - 1">C - 1</option>
                          <option value="C - 2">C - 2</option>
                          <option value="T - 1">T - 1</option>
                          <option value="P - 1">P - 1</option>
                          <option value="P - 2">P - 2</option>
                          <option value="P - 3">P - 3</option>
                          <option value="D - 1">D - 1</option>
                          <option value="D - 2">D - 2</option>
                          <option value="D - 3">D - 3</option>
                          <option value="D - 4">D - 4</option>
                          <option value="D - 5">D - 5</option>
                        </select>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <select
                          value={step.operator}
                          onChange={(e) => handleUpdateWorkPlanStep(step.id, 'operator', e.target.value)}
                          style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '13px', color: '#475569', outline: 'none' }}
                        >
                          {floorEmployeesList.length === 0 ? (
                            <option value="" disabled style={{ color: '#94A3B8' }}>No Floor Employees</option>
                          ) : (
                            floorEmployeesList.map(fe => {
                              const empName = fe.employee_name || fe.name || 'Floor Employee';
                              return (
                                <option key={fe.employee_code || empName} value={empName} style={{ color: '#334155' }}>
                                  {empName}
                                </option>
                              );
                            })
                          )}
                        </select>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={step.estTimeHours || ''}
                            onChange={(e) => {
                              const hVal = e.target.value;
                              const mVal = step.estTimeMins || '';
                              const hNum = Number(hVal) || 0;
                              const mNum = Number(mVal) || 0;
                              const formatted = (hNum > 0 && mNum > 0) ? `${hNum} hr ${mNum} mins` : hNum > 0 ? `${hNum} hr` : mNum > 0 ? `${mNum} mins` : '';
                              handleUpdateWorkPlanStep(step.id, 'estTimeHours', hVal);
                              handleUpdateWorkPlanStep(step.id, 'estTime', formatted);
                            }}
                            style={{ width: '48px', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 6px', fontSize: '13px', textAlign: 'center', color: '#64748B', outline: 'none' }}
                          />
                          <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700' }}>hr</span>

                          <input
                            type="number"
                            min="0"
                            max="59"
                            placeholder="15"
                            value={step.estTimeMins || ''}
                            onChange={(e) => {
                              const mVal = e.target.value;
                              const hVal = step.estTimeHours || '';
                              const hNum = Number(hVal) || 0;
                              const mNum = Number(mVal) || 0;
                              const formatted = (hNum > 0 && mNum > 0) ? `${hNum} hr ${mNum} mins` : hNum > 0 ? `${hNum} hr` : mNum > 0 ? `${mNum} mins` : '';
                              handleUpdateWorkPlanStep(step.id, 'estTimeMins', mVal);
                              handleUpdateWorkPlanStep(step.id, 'estTime', formatted);
                            }}
                            style={{ width: '48px', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 6px', fontSize: '13px', textAlign: 'center', color: '#64748B', outline: 'none' }}
                          />
                          <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700' }}>min</span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveWorkPlanStep(step.id)}
                          style={{ border: 'none', backgroundColor: '#FEF2F2', color: '#EF4444', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Remove Operation Step"
                        >
                          <Trash2 style={{ width: '15px', height: '15px' }} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* SECTION: ASSIGN TO THE HEADS */}
          <div style={{
            backgroundColor: '#F8FAFC',
            border: '1.5px solid #0E7490',
            borderRadius: '14px',
            padding: '18px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 2px 6px rgba(14, 116, 144, 0.06)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ECFEFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E7490' }}>
                  <Zap size={18} />
                </div>
                <div>
                  <h4 style={{ fontSize: '14.5px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                    Assign to the Heads
                  </h4>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    Assigned directly to shop-floor supervisors for mobile handling. Laborers do not need mobile phones.
                  </span>
                </div>
              </div>

              <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', padding: '4px 10px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} style={{ color: '#059669' }} /> Live Either-Or Sync Enabled
              </span>
            </div>

            {/* Supervisor Checkbox Selectors */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginTop: '4px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: assignedHeads.includes('Floor Supervisor') ? '#ECFEFF' : '#FFFFFF',
                border: assignedHeads.includes('Floor Supervisor') ? '1.5px solid #0E7490' : '1px solid #CBD5E1',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}>
                <input
                  type="checkbox"
                  checked={assignedHeads.includes('Floor Supervisor')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setAssignedHeads(prev => [...prev, 'Floor Supervisor']);
                    } else {
                      if (assignedHeads.length > 1) {
                        setAssignedHeads(prev => prev.filter(h => h !== 'Floor Supervisor'));
                      }
                    }
                  }}
                  style={{ accentColor: '#0E7490', width: '17px', height: '17px' }}
                />
                <div>
                  <strong style={{ fontSize: '13px', color: '#0F172A', display: 'block' }}>{floorSupervisorName} (Floor Supervisor)</strong>
                  <span style={{ fontSize: '11.5px', color: '#64748B' }}>Floor line operations, machine stations & cutting jobs</span>
                </div>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: assignedHeads.includes('Dispatch Head') ? '#ECFEFF' : '#FFFFFF',
                border: assignedHeads.includes('Dispatch Head') ? '1.5px solid #0E7490' : '1px solid #CBD5E1',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}>
                <input
                  type="checkbox"
                  checked={assignedHeads.includes('Dispatch Head')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setAssignedHeads(prev => [...prev, 'Dispatch Head']);
                    } else {
                      if (assignedHeads.length > 1) {
                        setAssignedHeads(prev => prev.filter(h => h !== 'Dispatch Head'));
                      }
                    }
                  }}
                  style={{ accentColor: '#0E7490', width: '17px', height: '17px' }}
                />
                <div>
                  <strong style={{ fontSize: '13px', color: '#0F172A', display: 'block' }}>{dispatchHeadName} (Dispatch Head)</strong>
                  <span style={{ fontSize: '11.5px', color: '#64748B' }}>Packing verification, staging & dispatch readiness</span>
                </div>
              </label>
            </div>

            <div style={{ fontSize: '11.5px', color: '#475569', backgroundColor: '#FFFFFF', border: '1px dashed #CBD5E1', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={15} style={{ color: '#0E7490', flexShrink: 0 }} />
              <span>
                <strong>Redundancy & Fail-Safe:</strong> If either {floorSupervisorName} or {dispatchHeadName} is absent, the other can immediately accept, start, or report output on mobile. A single update confirms the step for both accounts so floor production never stops.
              </span>
            </div>
          </div>

          {/* ACTIONS BAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setFormStep(1)}
                style={{ border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <ArrowLeft style={{ width: '15px', height: '15px' }} /> Back to Step 1
              </button>

              <button
                type="button"
                onClick={handleAddWorkPlanStep}
                style={{ border: '1px solid #0E7490', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus style={{ width: '15px', height: '15px' }} /> Add Another Process Operation
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button
                type="submit"
                onClick={handleCreateWorkOrder}
                style={{ border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', padding: '10px 24px', borderRadius: '8px', fontSize: '13.5px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(14, 116, 144, 0.3)' }}
              >
                <Send style={{ width: '16px', height: '16px' }} /> Save & Issue WO with Work Plan
              </button>
            </div>
          </div>

        </div>
      ) : (
        <form onSubmit={handleCreateWorkOrder} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '20px' }}>
        
        {/* LEFT COLUMN: WORK ORDER FORM SECTIONS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* SECTION 1: WO METADATA */}
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E7490' }}>
                <FileText style={{ width: '14px', height: '14px' }} />
              </div>
              <h3 style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                Work Order Details
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>WORK ORDER NUMBER</label>
                <input type="text" value={woNumber} onChange={(e) => setWoNumber(e.target.value)} style={{ ...inputStyle, backgroundColor: '#F8FAFC', fontWeight: '700', color: '#64748B' }} />
              </div>
              <div>
                <label style={labelStyle}>DATE</label>
                <input type="date" value={woDate} readOnly style={{ ...inputStyle, backgroundColor: '#F8FAFC', color: '#64748B', cursor: 'not-allowed' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>CREATOR (PRODUCTION HEAD)</label>
                <input type="text" value={creatorDisplay} readOnly style={{ ...inputStyle, backgroundColor: '#F8FAFC', fontWeight: '700', color: '#1E293B' }} />
              </div>
              <div>
                <label style={labelStyle}>PRIORITY</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ ...inputStyle, color: priority ? '#64748B' : '#94A3B8' }}>
                  <option value="" disabled style={{ color: '#94A3B8' }}>Select Priority</option>
                  <option value="High" style={{ color: '#64748B' }}>High Priority</option>
                  <option value="Normal" style={{ color: '#64748B' }}>Normal Priority</option>
                  <option value="Low" style={{ color: '#64748B' }}>Low Priority</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: PRODUCT SELECTION & TARGET */}
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E7490' }}>
                  <Package style={{ width: '14px', height: '14px' }} />
                </div>
                <h3 style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  Product & Target Output
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleAddProductItem}
                  style={{
                    backgroundColor: '#ECFEFF',
                    color: '#0E7490',
                    border: '1px solid #0E7490',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Plus style={{ width: '14px', height: '14px' }} /> Add Product / Item
                </button>

                {(selectedProductCode || cutLength || targetQty) && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductItems([{ id: Date.now(), productCode: '', cutLength: '', targetQty: '' }]);
                      setMatCalc(null);
                    }}
                    style={{
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#F8FAFC',
                      color: '#64748B',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RotateCcw style={{ width: '12px', height: '12px' }} /> Clear
                  </button>
                )}
              </div>
            </div>

            {/* DYNAMIC PRODUCT & TARGET OUTPUT ROWS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {productItems.map((item, index) => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 40px', gap: '12px', alignItems: 'flex-end', backgroundColor: index > 0 ? '#F8FAFC' : 'transparent', padding: index > 0 ? '10px' : '0px', borderRadius: '10px', border: (index > 0 ? '1px solid #E2E8F0' : 'none') }}>
                  <div>
                    <label style={labelStyle}>FINISHED PRODUCT {productItems.length > 1 ? `#${index + 1}` : ''}</label>
                    <select
                      value={item.productCode}
                      onChange={(e) => handleUpdateProductItem(item.id, 'productCode', e.target.value)}
                      style={{ ...inputStyle, fontWeight: '600', color: item.productCode ? '#64748B' : '#94A3B8' }}
                    >
                      <option value="" disabled style={{ color: '#94A3B8' }}>Select Product</option>
                      {availableCatalog.map((catItem, pIdx) => (
                        <option key={pIdx} value={catItem.code} style={{ color: '#64748B' }}>
                          {catItem.label}
                        </option>
                      ))}
                      <option value="custom_new" style={{ color: '#0E7490', fontWeight: 'bold' }}>
                        + Add New / Custom Product (Auto-Code)
                      </option>
                    </select>

                    {item.productCode === 'custom_new' && (
                      <div style={{ marginTop: '8px' }}>
                        <input
                          type="text"
                          value={customProductName}
                          onChange={(e) => setCustomProductName(e.target.value)}
                          placeholder="Enter new product name..."
                          style={{
                            ...inputStyle,
                            border: '1.5px solid #0E7490',
                            backgroundColor: '#F0FDFA',
                            fontSize: '12px',
                            color: '#0E7490',
                            fontWeight: '700'
                          }}
                        />
                        <span style={{ fontSize: '10.5px', color: '#0E7490', fontWeight: '600', marginTop: '2px', display: 'block' }}>
                          ✨ Code will be auto-generated & registered into inventory
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={labelStyle}>CUT LENGTH (MM)</label>
                    {(() => {
                      const cat = PRODUCT_CATALOG_OPTIONS.find(p => p.code === item.productCode);
                      const rawLen = cat?.totalLen || 2414;
                      const parsedCut = parseFloat(String(item.cutLength || '').replace(/[^\d.]/g, '')) || 0;
                      const isMissing = item.productCode && (!item.cutLength || String(item.cutLength).trim() === '' || parsedCut <= 0);
                      const isTooLong = parsedCut > rawLen;

                      return (
                        <>
                          <input
                            type="text"
                            value={item.cutLength}
                            onChange={(e) => handleUpdateProductItem(item.id, 'cutLength', e.target.value)}
                            placeholder={cat?.defaultCutLen ? `e.g. ${cat.defaultCutLen}` : "e.g. 300"}
                            style={{ 
                              ...inputStyle, 
                              fontSize: '13px', 
                              fontWeight: '600', 
                              color: item.cutLength ? '#64748B' : '#94A3B8',
                              border: isTooLong ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                              backgroundColor: isTooLong ? '#FEF2F2' : '#FFFFFF'
                            }}
                          />
                          {isTooLong && (
                            <span style={{ fontSize: '10.5px', color: '#DC2626', fontWeight: '700', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              ⚠️ Cannot exceed raw bar ({rawLen} mm)
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  <div>
                    <label style={labelStyle}>TARGET OUTPUT QTY (PCS)</label>
                    <input
                      type="number"
                      min="1"
                      value={item.targetQty}
                      onChange={(e) => handleUpdateProductItem(item.id, 'targetQty', e.target.value)}
                      placeholder="e.g. 1"
                      style={{ ...inputStyle, fontSize: '13px', fontWeight: '600', color: item.targetQty ? '#64748B' : '#94A3B8' }}
                    />
                  </div>

                  {productItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveProductItem(item.id)}
                      style={{ border: 'none', backgroundColor: '#FEF2F2', color: '#EF4444', width: '38px', height: '40px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Remove Product Item"
                    >
                      <Trash2 style={{ width: '15px', height: '15px' }} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* RECIPE BADGE BANNER FOR EACH CONFIGURED PRODUCT ITEM */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {productItems.map((pItem, pIdx) => {
                const yieldRule = getItemCutYieldRule(pItem.productCode, pItem.cutLength);
                if (!yieldRule) return null;
                return (
                  <div
                    key={pItem.id || pIdx}
                    style={{
                      backgroundColor: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <CheckCircle style={{ width: '16px', height: '16px', color: '#16A34A', flexShrink: 0 }} />
                    <div style={{ fontSize: '12px', color: '#166534', lineHeight: '1.4' }}>
                      {productItems.length > 1 && (
                        <span style={{ fontWeight: '700', marginRight: '6px', color: '#15803D' }}>
                          [{yieldRule.label}]:
                        </span>
                      )}
                      <strong>Cut Yield Rule:</strong> 1 Raw Bar ({yieldRule.rawLen} mm) ÷ {yieldRule.cutLen} mm Cut Length = <strong>{yieldRule.pieces} Pieces per Raw Bar</strong>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* AI PROFIT OPTIMIZER RECOMMENDATION */}
            {Boolean(selectedProductCode && cutLength && matCalc) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

                {/* AI PROFIT OPTIMIZATION & MANDATORY KERF LOSS RECOMMENDATION */}
                {matCalc.isWholeUnitConstraint && matCalc.excessOutputPossible > 0 && (
                  <div style={{
                    backgroundColor: '#FEFCE8',
                    border: '1.5px solid #FDE047',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    boxShadow: '0 2px 6px rgba(234, 179, 8, 0.12)'
                  }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: '#EAB308',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Lightbulb size={16} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#854D0E', letterSpacing: '0.2px' }}>
                          PROFIT OPTIMIZATION & KERF LOSS GUIDANCE
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: '800', backgroundColor: '#FEF08A', color: '#713F12', padding: '2px 8px', borderRadius: '10px' }}>
                          CUTTING LOSS & YIELD ADVICE
                        </span>
                      </div>

                      <div style={{ fontSize: '11.5px', color: '#713F12', lineHeight: '1.45' }}>
                        Issuing <strong>{matCalc.physicalMatToIssue} raw bars ({matCalc.physicalMatToIssue * (matCalc.rawLengthMm || 2414)} mm total)</strong> for <strong>{targetQty} pieces</strong> of {matCalc.cutLenMm || 400} mm cut length.
                      </div>

                      {/* Kerf & Scrap Breakdown */}
                      <div style={{ fontSize: '11px', color: '#854D0E', backgroundColor: '#FEF9C3', padding: '8px 10px', borderRadius: '6px', border: '1px solid #FEF08A', lineHeight: '1.4' }}>
                        • <strong>Mandatory Blade Kerf Loss:</strong> 2 mm per cut stroke ({matCalc.piecesPerLength} finished pieces = {matCalc.cutsPerBar} cuts × 2 mm = {matCalc.kerfLossMmPerBar} mm kerf/bar).<br/>
                        • <strong>Bar Yield:</strong> {matCalc.rawLengthMm || 2414} mm length = <strong>{matCalc.piecesPerLength} Pieces per Bar</strong> with {matCalc.endOffcutScrapMmPerBar} mm end clamp scrap.<br/>
                        • <strong>Unutilized Issued Capacity:</strong> <strong>{matCalc.excessOutputPossible} pieces</strong> remaining in issued material.
                      </div>

                      {/* Actionable Solution to get full 400 mm pieces */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setTargetQty(String(matCalc.expectedTheoreticalOutput))}
                          style={{
                            backgroundColor: '#854D0E',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 4px rgba(133, 77, 14, 0.25)'
                          }}
                        >
                          <Zap size={14} /> Apply Max Profit Target: {matCalc.expectedTheoreticalOutput} Pieces
                        </button>
                        <span style={{ fontSize: '11px', color: '#854D0E', fontWeight: '700' }}>
                          (Eliminates material waste & brings full {matCalc.expectedTheoreticalOutput} pcs of exact 400 mm!)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: ASSIGNMENT & TIMELINE */}
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E7490' }}>
                <Cpu style={{ width: '14px', height: '14px' }} />
              </div>
              <h3 style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                Assignment & Production Schedule
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>START DATE</label>
                <input type="date" value={expectedStartDate} onChange={(e) => setExpectedStartDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>TARGET COMPLETION DATE</label>
                <input type="date" value={expectedCompletionDate} onChange={(e) => setExpectedCompletionDate(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: RAW MATERIAL CALCULATION PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E7490' }}>
                  <Boxes style={{ width: '14px', height: '14px' }} />
                </div>
                <h3 style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  Automatic Material Requirement
                </h3>
              </div>
              <span style={{ fontSize: '10px', fontWeight: '700', backgroundColor: '#F1F5F9', color: '#94A3B8', padding: '2px 7px', borderRadius: '5px' }}>
                RECIPE CALCULATED
              </span>
            </div>

            {/* MULTI-MATERIAL BREAKDOWN IF MULTIPLE PROFILE LENGTHS ARE CONFIGURED */}
            {multiMatBreakdown.length > 1 && (
              <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #DCFCE7', paddingBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', letterSpacing: '0.3px' }}>
                    MULTI-MATERIAL REQUISITION ({multiMatBreakdown.length} RAW PROFILES)
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: '700', backgroundColor: '#DCFCE7', color: '#15803D', padding: '2px 6px', borderRadius: '4px' }}>
                    SEPARATE BARS
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {multiMatBreakdown.map((mat, mIdx) => (
                    <div key={mIdx} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '12px', color: '#0F172A' }}>
                          Profile #{mIdx + 1}: {mat.rawLengthMm} mm Raw Bar
                        </strong>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: mat.isSufficient ? '#16A34A' : '#DC2626', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {mat.isSufficient ? '✓ In Stock' : '⚠️ Shortage'}
                        </span>
                      </div>

                      <div style={{ fontSize: '11.5px', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Required to Issue: <strong style={{ color: '#0E7490' }}>{mat.totalBarsRequired} Bars</strong></span>
                        <span>In Stock: <strong>{mat.availableStock} Bars</strong></span>
                      </div>

                      <div style={{ fontSize: '10.5px', color: '#64748B', backgroundColor: '#F8FAFC', padding: '4px 6px', borderRadius: '4px' }}>
                        Used for: {mat.items.map(it => `${it.productLabel} (${it.targetQty} pcs @ ${it.cutLength}mm)`).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {matCalc ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* EXACT THEORETICAL MAT REQUIRED */}
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748B' }}>THEORETICAL REQUIREMENT</span>
                  <div style={{ fontSize: '17px', fontWeight: '800', color: '#334155' }}>
                    {multiMatBreakdown.length > 1
                      ? `${multiMatBreakdown.reduce((sum, m) => sum + m.totalBarsRequired, 0)} Lengths (${multiMatBreakdown.map(m => `${m.totalBarsRequired}x ${m.rawLengthMm}mm`).join(' + ')})`
                      : `${matCalc.exactRequiredMatQty.toFixed(2)} Lengths`
                    }
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748B' }}>
                    <span>
                      Raw Material: <strong style={{ color: '#475569' }}>{multiMatBreakdown.length > 1 ? `${multiMatBreakdown.length} Raw Profiles` : matCalc.recipe.rawMaterialName}</strong>
                    </span>
                    {selectedProductCode && (() => {
                      const stockInfo = getRawMaterialStock(selectedProductCode);
                      if (!stockInfo) return null;
                      return (
                        <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#0F766E', backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', padding: '2px 6px', borderRadius: '4px' }}>
                          Available: {stockInfo.availableStock} Bars
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* PHYSICAL WHOLE UNIT CONSTRAINT BOX */}
                <div style={{
                  backgroundColor: matCalc.isWholeUnitConstraint ? '#FFF7ED' : '#F8FAFC',
                  border: `1px solid ${matCalc.isWholeUnitConstraint ? '#FFEDD5' : '#E2E8F0'}`,
                  borderRadius: '10px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: '700', color: matCalc.isWholeUnitConstraint ? '#C2410C' : '#64748B' }}>
                      PHYSICAL UNITS TO ISSUE
                    </span>
                    {matCalc.isWholeUnitConstraint && (
                      <span style={{ fontSize: '9.5px', fontWeight: '700', color: '#C2410C', backgroundColor: '#FFEDD5', padding: '2px 5px', borderRadius: '4px' }}>
                        WHOLE UNIT
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: matCalc.isWholeUnitConstraint ? '#C2410C' : '#475569' }}>
                      {multiMatBreakdown.length > 1
                        ? `${multiMatBreakdown.reduce((sum, m) => sum + m.totalBarsRequired, 0)} Lengths (${multiMatBreakdown.map(m => `${m.totalBarsRequired}x ${m.rawLengthMm}mm`).join(' + ')})`
                        : `${matCalc.physicalMatToIssue} Length${matCalc.physicalMatToIssue > 1 ? 's' : ''}`
                      }
                    </div>
                    {selectedProductCode && (() => {
                      const stockInfo = getRawMaterialStock(selectedProductCode);
                      if (!stockInfo) return null;
                      return (
                        <div style={{ fontSize: '11.5px', color: '#475569' }}>
                          In Stock: <strong style={{ color: stockInfo.availableStock > 0 ? '#16A34A' : '#DC2626' }}>{stockInfo.availableStock} Bars</strong>
                        </div>
                      );
                    })()}
                  </div>

                  {matCalc.isWholeUnitConstraint && (
                    <div style={{ fontSize: '11px', color: '#9A3412', lineHeight: '1.35', display: 'flex', gap: '6px', alignItems: 'flex-start', marginTop: '2px' }}>
                      <AlertTriangle style={{ width: '14px', height: '14px', color: '#C2410C', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        Raw material is stocked as whole physical units ({matCalc.recipe.rawMaterialUnit}).
                        <div style={{ marginTop: '2px', fontWeight: '700' }}>
                          Expected Output: {matCalc.expectedTheoreticalOutput} Pieces ({matCalc.excessOutputPossible} excess pieces possible).
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ESTIMATED WASTAGE & SCRAP BOX - Rendered ONLY after FINISHED PRODUCT is selected/added */}
                {(Boolean(selectedProductCode && (selectedProductCode !== 'custom_new' || customProductName.trim()))) && (
                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748B' }}>ESTIMATED SCRAP & WASTAGE</span>
                      <span style={{ fontSize: '9.5px', fontWeight: '700', color: '#DC2626', backgroundColor: '#FEF2F2', padding: '2px 6px', borderRadius: '4px', border: '1px solid #FECACA' }}>
                        {matCalc.wastagePercent}% SCRAP
                      </span>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#475569' }}>
                      {matCalc.endOffcutScrapMmPerBar} mm <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>Bar-End Stub + 2 mm kerf/cut ({matCalc.totalWastageMm} mm total)</span>
                    </div>

                    {/* Explicit 2mm Blade Kerf Loss Breakdown */}
                    <div style={{ fontSize: '11px', color: '#475569', backgroundColor: '#FFFFFF', padding: '6px 8px', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div>• <strong>2 mm Saw Blade Kerf Loss:</strong> {matCalc.totalCutStrokes} cut strokes ({matCalc.targetQty} pcs produced) × 2 mm = <strong>{matCalc.totalKerfLossMm} mm total kerf loss</strong></div>
                      <div>• <strong>Bar-End Stub:</strong> {matCalc.endOffcutScrapMmPerBar} mm per bar</div>
                      <div>• <strong>Formula per Bar:</strong> {matCalc.rawLengthMm || 2414} mm - [{matCalc.piecesPerLength} pcs × {matCalc.cutLenMm || 400} mm + {matCalc.cutsPerBar} cuts × 2 mm kerf] = {matCalc.endOffcutScrapMmPerBar} mm scrap</div>
                    </div>

                    {/* DYNAMIC SMART RECOMMENDATIONS: CONVERT USABLE SCRAP TO ONLY COMPATIBLE SAME-RAW-MATERIAL PRODUCTS */}
                    {/* Strictly displayed only after user inputs product, cut length, and target quantity AND usable scrap yields compatible products */}
                    {(() => {
                      const parsedCut = parseFloat(String(cutLength || '').replace(/[^\d.]/g, '')) || 0;
                      const parsedQty = parseFloat(String(targetQty || '').replace(/[^\d.]/g, '')) || 0;
                      const hasEnteredValues = Boolean(selectedProductCode && parsedCut > 0 && parsedQty > 0);

                      if (!hasEnteredValues || !matCalc.endOffcutScrapMmPerBar || matCalc.endOffcutScrapMmPerBar <= 0) {
                        return null;
                      }

                      const scrapMm = matCalc.endOffcutScrapMmPerBar;
                      const curCode = selectedProductCode;
                      const curCatalog = PRODUCT_CATALOG_OPTIONS.find(p => p.code === curCode);
                      const curRawLen = curCatalog?.totalLen || matCalc.rawLengthMm || 2414;
                      const curGroup = curCatalog?.profileGroup;

                      // Filter catalog to ONLY products sharing the EXACT SAME raw material profile length and profile group
                      // This strictly ensures clamp extrusions (2650 mm) only recommend clamps (e.g. 47mm, 35mm, 30mm)
                      // and mini rail (2414 mm) only recommends mini rails (e.g. 300mm, 100mm, 60mm, 40mm)
                      const compatibleCatalog = PRODUCT_CATALOG_OPTIONS.filter(p => {
                        const sameLength = p.totalLen === curRawLen;
                        const sameGroup = curGroup ? p.profileGroup === curGroup : true;
                        return sameLength && sameGroup;
                      });

                      // Find all compatible products that can produce >= 1 piece from the available scrap length
                      const candidates = compatibleCatalog
                        .map(p => {
                          const bladeKerf = 2;
                          const cutLen = p.defaultCutLen || 35;
                          const yieldQty = Math.floor((scrapMm + bladeKerf) / (cutLen + bladeKerf));
                          const remainderMm = Math.max(0, scrapMm - (yieldQty * cutLen + Math.max(0, yieldQty - 1) * bladeKerf));
                          return { 
                            code: p.code, 
                            name: p.label, 
                            cutLen, 
                            yieldQty, 
                            remainderMm,
                            rawLen: p.totalLen
                          };
                        })
                        .filter(p => p.yieldQty >= 1)
                        .sort((a, b) => b.yieldQty - a.yieldQty);

                      // Only show this section if there is actual usable scrap yielding at least 1 compatible product
                      if (candidates.length === 0) return null;

                      return (
                        <div style={{ marginTop: '8px', paddingTop: '10px', borderTop: '1px dashed #CBD5E1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '12px', color: '#0F172A', fontWeight: '800' }}>
                              ♻️ Usable Offcut Scrap: <strong style={{ color: '#0E7490' }}>{scrapMm} mm bar</strong>
                            </div>
                            <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '600' }}>
                              Recommended Products to Make ({curRawLen} mm Raw Material):
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {candidates.map(cand => (
                              <button
                                key={cand.code}
                                type="button"
                                onClick={() => {
                                  setProductItems(prev => [
                                    ...prev,
                                    {
                                      id: Date.now() + Math.random(),
                                      productCode: cand.code,
                                      cutLength: String(cand.cutLen),
                                      targetQty: String(cand.yieldQty)
                                    }
                                  ]);
                                  setToastAlert({
                                    type: 'success',
                                    title: 'Product Added from Usable Scrap',
                                    message: `Added ${cand.yieldQty} pc(s) of ${cand.name} (${cand.cutLen} mm) from ${scrapMm} mm usable offcut (Same ${curRawLen} mm Raw Material)!`
                                  });
                                }}
                                style={{
                                  backgroundColor: '#ECFEFF',
                                  color: '#0E7490',
                                  border: '1px solid #A5F3FC',
                                  padding: '6px 12px',
                                  borderRadius: '7px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#0E7490';
                                  e.currentTarget.style.color = '#FFFFFF';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#ECFEFF';
                                  e.currentTarget.style.color = '#0E7490';
                                }}
                              >
                                ⚡ + Make {cand.yieldQty} × {cand.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}



              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#94A3B8', fontSize: '12.5px' }}>
                Select product & enter target quantity to calculate raw material requirements.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <button
                type="submit"
                onClick={handleCreateWorkOrder}
                style={{
                  width: '100%',
                  height: '42px',
                  backgroundColor: '#0E7490',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(14, 116, 144, 0.35)',
                  transition: 'background-color 0.2s ease'
                }}
              >
                <Send style={{ width: '15px', height: '15px' }} /> Save & Issue Work Order
              </button>

              <button
                type="button"
                onClick={() => {
                  if (invalidCutLengthItem) {
                    const cat = PRODUCT_CATALOG_OPTIONS.find(p => p.code === invalidCutLengthItem.productCode);
                    const rawLen = cat?.totalLen || 2414;
                    const parsedCut = parseFloat(String(invalidCutLengthItem.cutLength || '').replace(/[^\d.]/g, '')) || 0;
                    setToastAlert({
                      type: 'error',
                      title: 'Cut Length Required to Proceed',
                      message: parsedCut <= 0 
                        ? `Cut length for ${cat?.label || invalidCutLengthItem.productCode || 'product'} is missing. Please enter a valid cut length (e.g. ${cat?.defaultCutLen || 35} mm) before proceeding.`
                        : `Cut length (${parsedCut} mm) exceeds the raw bar length (${rawLen} mm) for ${cat?.label || invalidCutLengthItem.productCode}. Cannot proceed.`
                    });
                    return;
                  }
                  if (!targetQty || Number(targetQty) <= 0) {
                    setToastAlert({
                      type: 'error',
                      title: 'Target Quantity Required',
                      message: 'Please enter a valid target quantity (> 0).'
                    });
                    return;
                  }
                  if (matCalc && !matCalc.isSufficient) {
                    setToastAlert({
                      type: 'error',
                      title: 'Insufficient Raw Material Stock',
                      message: `Cannot proceed! Required raw material: ${matCalc.physicalMatToIssue} ${matCalc.recipe.rawMaterialUnit}s, but available stock is only ${matCalc.availableStock} ${matCalc.recipe.rawMaterialUnit}s (Shortage: ${matCalc.shortageQty} ${matCalc.recipe.rawMaterialUnit}s).`
                    });
                    return;
                  }
                  setFormStep(2);
                }}
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  color: '#475569',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                Configure Process Routing Plan (Step 2) →
              </button>
            </div>
          </div>

        </div>

      </form>
      )}
      {/* ─── CUSTOM TOAST NOTIFICATION ─── */}
      {toastAlert && (
        <NotificationToast
          alert={toastAlert}
          onClose={() => {
            const woToPass = toastAlert.pendingWO;
            setToastAlert(null);
            if (woToPass) {
              if (onWorkOrderCreated) onWorkOrderCreated(woToPass);
              else if (onBack) onBack();
            }
          }}
        />
      )}
    </div>
  );
}
