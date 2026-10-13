import React, { useState } from 'react';
import { Calculator, CheckCircle2, RotateCcw, ArrowRight } from 'lucide-react';

export default function InventoryAutoConversion() {
  // Mode Selection: What does the user want to calculate?
  const [calcTarget, setCalcTarget] = useState('weight'); // 'weight', 'length', 'width', 'thickness'

  // General Purchase Info
  const [purchaseDate, setPurchaseDate] = useState('');
  const [product, setProduct] = useState('');
  const [productType, setProductType] = useState('');
  const [coilGrade, setCoilGrade] = useState('');
  const [ratePerTon, setRatePerTon] = useState('');
  const [remarks, setRemarks] = useState('');

  // 4 Dimensions State
  const [lengthM, setLengthM] = useState('');
  const [widthM, setWidthM] = useState('');
  const [thicknessMm, setThicknessMm] = useState('');
  const [weightKg, setWeightKg] = useState('');

  // Density Constant for Steel = 7.85 kg / (m² · mm)
  const DENSITY = 7.85;

  // Calculate the target value based on the selected target mode
  const L = parseFloat(lengthM) || 0;
  const W = parseFloat(widthM) || 0;
  const T = parseFloat(thicknessMm) || 0;
  const Kg = parseFloat(weightKg) || 0;

  let calculatedValue = '';
  let calculatedUnit = '';
  let isReady = false;

  if (calcTarget === 'weight' && L > 0 && W > 0 && T > 0) {
    calculatedValue = (L * W * T * DENSITY).toFixed(2);
    calculatedUnit = 'Kg';
    isReady = true;
  } else if (calcTarget === 'length' && Kg > 0 && W > 0 && T > 0) {
    calculatedValue = (Kg / (W * T * DENSITY)).toFixed(3);
    calculatedUnit = 'Meters';
    isReady = true;
  } else if (calcTarget === 'width' && Kg > 0 && L > 0 && T > 0) {
    calculatedValue = (Kg / (L * T * DENSITY)).toFixed(3);
    calculatedUnit = 'Meters';
    isReady = true;
  } else if (calcTarget === 'thickness' && Kg > 0 && L > 0 && W > 0) {
    calculatedValue = (Kg / (L * W * DENSITY)).toFixed(2);
    calculatedUnit = 'mm';
    isReady = true;
  }

  // Calculate Total Amount if Rate & Weight available
  const activeWeightKg = calcTarget === 'weight' ? parseFloat(calculatedValue) || Kg : Kg;
  const activeTon = activeWeightKg ? activeWeightKg / 1000 : 0;
  const parsedRate = parseFloat(ratePerTon.replace(/,/g, '')) || 0;
  const totalAmount = activeTon * parsedRate;

  const handleClear = () => {
    setPurchaseDate('');
    setProduct('');
    setProductType('');
    setCoilGrade('');
    setRatePerTon('');
    setRemarks('');
    setLengthM('');
    setWidthM('');
    setThicknessMm('');
    setWeightKg('');
  };

  const handleSave = () => {
    alert(`✅ Entry saved successfully!\nInventory Stock Added: ${(activeWeightKg || 0).toLocaleString('en-IN')} KG (${activeTon.toFixed(3)} Ton)`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif" }}>
      
      {/* SECTION CARD */}
      <div className="section-card" style={{ padding: '28px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        {/* Page Header */}
        <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calculator style={{ width: '22px', height: '22px', color: '#2563eb' }} />
            Inventory Stock Conversion
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
            Formula: <strong style={{ color: '#1e293b' }}>Length (m) × Width (m) × Thickness (mm) × 7.85 = Weight (Kg)</strong>
          </p>
        </div>

        {/* STEP 1: CHOOSE WHAT TO CALCULATE */}
        <div style={{ marginBottom: '24px', backgroundColor: '#f8fafc', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#1e293b', marginBottom: '10px' }}>
            What do you want to calculate?
          </label>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { id: 'weight', label: 'Weight (Kg)', sub: 'Enter L, W, T' },
              { id: 'length', label: 'Length (m)', sub: 'Enter W, T, Weight' },
              { id: 'width', label: 'Width (m)', sub: 'Enter L, T, Weight' },
              { id: 'thickness', label: 'Thickness (mm)', sub: 'Enter L, W, Weight' }
            ].map(target => {
              const isSelected = calcTarget === target.id;
              return (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => setCalcTarget(target.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    color: isSelected ? '#1d4ed8' : '#475569',
                    cursor: 'pointer',
                    minWidth: '150px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{target.label}</span>
                  <span style={{ fontSize: '11px', color: isSelected ? '#2563eb' : '#94a3b8', marginTop: '2px' }}>{target.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: ENTER KNOWN DIMENSIONS */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: '14px' }}>
            Enter Known Values
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            
            {/* Length Field */}
            <div>
              <label htmlFor="inventory-auto-conversion-input-1" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: calcTarget === 'length' ? '#94a3b8' : '#475569', marginBottom: '6px' }}>
                Length (m) {calcTarget === 'length' && '(Auto Solved)'}
              </label>
              <input id="inventory-auto-conversion-input-1" name="input1" aria-label="Length (m) {calcTarget === length && (Auto Solved)}" 
                type="number"
                step="any"
                disabled={calcTarget === 'length'}
                value={calcTarget === 'length' ? calculatedValue : lengthM}
                placeholder={calcTarget === 'length' ? 'Auto Calculated' : 'e.g. 10.00'}
                onChange={(e) => setLengthM(e.target.value)}
                style={{ 
                  width: '100%', 
                  height: '42px', 
                  borderRadius: '8px', 
                  border: calcTarget === 'length' ? '2px solid #16a34a' : '1px solid #cbd5e1', 
                  padding: '0 12px', 
                  fontSize: '14px', 
                  fontWeight: 'bold', 
                  color: calcTarget === 'length' ? '#15803d' : '#0f172a',
                  backgroundColor: calcTarget === 'length' ? '#dcfce7' : '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }} 
               />
            </div>

            {/* Width Field */}
            <div>
              <label htmlFor="inventory-auto-conversion-input-2" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: calcTarget === 'width' ? '#94a3b8' : '#475569', marginBottom: '6px' }}>
                Width (m) {calcTarget === 'width' && '(Auto Solved)'}
              </label>
              <input id="inventory-auto-conversion-input-2" name="input2" aria-label="Width (m) {calcTarget === width && (Auto Solved)}" 
                type="number"
                step="any"
                disabled={calcTarget === 'width'}
                value={calcTarget === 'width' ? calculatedValue : widthM}
                placeholder={calcTarget === 'width' ? 'Auto Calculated' : 'e.g. 1.25'}
                onChange={(e) => setWidthM(e.target.value)}
                style={{ 
                  width: '100%', 
                  height: '42px', 
                  borderRadius: '8px', 
                  border: calcTarget === 'width' ? '2px solid #16a34a' : '1px solid #cbd5e1', 
                  padding: '0 12px', 
                  fontSize: '14px', 
                  fontWeight: 'bold', 
                  color: calcTarget === 'width' ? '#15803d' : '#0f172a',
                  backgroundColor: calcTarget === 'width' ? '#dcfce7' : '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }} 
               />
            </div>

            {/* Thickness Field */}
            <div>
              <label htmlFor="inventory-auto-conversion-input-3" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: calcTarget === 'thickness' ? '#94a3b8' : '#475569', marginBottom: '6px' }}>
                Thickness (mm) {calcTarget === 'thickness' && '(Auto Solved)'}
              </label>
              <input id="inventory-auto-conversion-input-3" name="input3" aria-label="Thickness (mm) {calcTarget === thickness && (Auto Solved)}" 
                type="number"
                step="any"
                disabled={calcTarget === 'thickness'}
                value={calcTarget === 'thickness' ? calculatedValue : thicknessMm}
                placeholder={calcTarget === 'thickness' ? 'Auto Calculated' : 'e.g. 2.00'}
                onChange={(e) => setThicknessMm(e.target.value)}
                style={{ 
                  width: '100%', 
                  height: '42px', 
                  borderRadius: '8px', 
                  border: calcTarget === 'thickness' ? '2px solid #16a34a' : '1px solid #cbd5e1', 
                  padding: '0 12px', 
                  fontSize: '14px', 
                  fontWeight: 'bold', 
                  color: calcTarget === 'thickness' ? '#15803d' : '#0f172a',
                  backgroundColor: calcTarget === 'thickness' ? '#dcfce7' : '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }} 
               />
            </div>

            {/* Weight Field */}
            <div>
              <label htmlFor="inventory-auto-conversion-input-4" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: calcTarget === 'weight' ? '#15803d' : '#475569', marginBottom: '6px' }}>
                Weight (Kg) {calcTarget === 'weight' && '(Auto Solved)'}
              </label>
              <input id="inventory-auto-conversion-input-4" name="input4" aria-label="Weight (Kg) {calcTarget === weight && (Auto Solved)}" 
                type="number"
                step="any"
                disabled={calcTarget === 'weight'}
                value={calcTarget === 'weight' ? calculatedValue : weightKg}
                placeholder={calcTarget === 'weight' ? 'Auto Calculated' : 'e.g. 196.25'}
                onChange={(e) => setWeightKg(e.target.value)}
                style={{ 
                  width: '100%', 
                  height: '42px', 
                  borderRadius: '8px', 
                  border: calcTarget === 'weight' ? '2px solid #16a34a' : '1px solid #cbd5e1', 
                  padding: '0 12px', 
                  fontSize: '14px', 
                  fontWeight: 'bold', 
                  color: calcTarget === 'weight' ? '#15803d' : '#0f172a',
                  backgroundColor: calcTarget === 'weight' ? '#dcfce7' : '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }} 
               />
            </div>

          </div>
        </div>

        {/* STEP 3: RESULT DISPLAY BOX */}
        <div style={{ 
          backgroundColor: isReady ? '#f0fdf4' : '#f8fafc', 
          border: isReady ? '1px solid #bbf7d0' : '1px solid #e2e8f0', 
          borderRadius: '10px', 
          padding: '20px', 
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: isReady ? '#15803d' : '#64748b', letterSpacing: '0.04em' }}>
              Calculated Result
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: isReady ? '#15803d' : '#94a3b8', marginTop: '2px' }}>
              {isReady ? `${calculatedValue} ${calculatedUnit}` : 'Fill in the 3 known values above'}
            </div>
          </div>

          {isReady && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Equivalent in Tons</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>
                {activeTon.toFixed(3)} Ton
              </div>
            </div>
          )}
        </div>

        {/* STEP 4: PURCHASE & ITEM DETAILS */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: '14px' }}>
            Product & Pricing Details
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label htmlFor="inventory-auto-conversion-purchase-date" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Purchase Date
              </label>
              <input id="inventory-auto-conversion-purchase-date" name="purchaseDate" aria-label="Purchase Date" 
                type="date" 
                value={purchaseDate} 
                onChange={(e) => setPurchaseDate(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} 
               />
            </div>

            <div>
              <label htmlFor="inventory-auto-conversion-product" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Product
              </label>
              <select id="inventory-auto-conversion-product" name="product" aria-label="Product" 
                value={product} 
                onChange={(e) => setProduct(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff' }}
              >
                <option value="" disabled hidden>Select Product</option>
                <option value="GI Steel Coil 2.0mm">GI Steel Coil 2.0mm</option>
                <option value="GI Steel Coil 1.6mm">GI Steel Coil 1.6mm</option>
                <option value="Aluminium Coil 1.5mm">Aluminium Coil 1.5mm</option>
                <option value="CRC Sheet 1.2mm">CRC Sheet 1.2mm</option>
              </select>
            </div>

            <div>
              <label htmlFor="inventory-auto-conversion-product-type" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Product Type
              </label>
              <select id="inventory-auto-conversion-product-type" name="productType" aria-label="Product Type" 
                value={productType} 
                onChange={(e) => setProductType(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff' }}
              >
                <option value="" disabled hidden>Select Product Type</option>
                <option value="GI Coil (HR)">GI Coil (HR)</option>
                <option value="GI Coil (CR)">GI Coil (CR)</option>
                <option value="Aluminium Coil">Aluminium Coil</option>
                <option value="Stainless Steel Coil">Stainless Steel Coil</option>
              </select>
            </div>

            <div>
              <label htmlFor="inventory-auto-conversion-coil-grade" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Coil Grade
              </label>
              <select id="inventory-auto-conversion-coil-grade" name="coilGrade" aria-label="Coil Grade" 
                value={coilGrade} 
                onChange={(e) => setCoilGrade(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff' }}
              >
                <option value="" disabled hidden>Select Coil Grade</option>
                <option value="HR">HR</option>
                <option value="CR">CR</option>
                <option value="Fe500">Fe500</option>
                <option value="304">304</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div>
              <label htmlFor="inventory-auto-conversion-rate-ton" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Rate (₹ / Ton)
              </label>
              <input id="inventory-auto-conversion-rate-ton" name="rateTon" aria-label="Rate (₹ / Ton)" 
                type="text" 
                value={ratePerTon} 
                placeholder="e.g. 72,000"
                onChange={(e) => setRatePerTon(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '14px', fontWeight: 'bold', outline: 'none', boxSizing: 'border-box' }} 
               />
            </div>

            <div>
              <label htmlFor="inventory-auto-conversion-total-amount" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Total Amount (₹)
              </label>
              <input id="inventory-auto-conversion-total-amount" name="totalAmount" aria-label="Total Amount (₹)" 
                type="text" 
                readOnly
                value={totalAmount ? totalAmount.toLocaleString('en-IN') : ''} 
                placeholder="0"
                style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '14px', fontWeight: 'bold', backgroundColor: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }} 
               />
            </div>

            <div>
              <label htmlFor="inventory-auto-conversion-remarks" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Remarks
              </label>
              <input id="inventory-auto-conversion-remarks" name="remarks" aria-label="Remarks" 
                type="text" 
                value={remarks} 
                placeholder="Enter remarks..."
                onChange={(e) => setRemarks(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} 
               />
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleSave}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 28px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
            }}
          >
            Save Entry
          </button>

          <button
            onClick={handleClear}
            style={{
              backgroundColor: '#ffffff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '12px 28px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
        </div>

      </div>

    </div>
  );
}
