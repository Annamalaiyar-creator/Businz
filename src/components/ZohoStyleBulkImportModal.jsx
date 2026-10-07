import React, { useState, useRef, useMemo } from 'react';
import {
  UploadCloud, FileSpreadsheet, Download, FileCheck,
  ChevronRight, X, AlertCircle, RefreshCw, ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';

/**
 * Universal Zoho Books-Style Bulk Import Modal
 * 
 * Features:
 * 1. Step 1: File Upload (.xlsx, .xls, .csv) + Sample Excel template download
 * 2. Step 2: Zoho Books-style Field Mapping Table
 *    - Left column: BUSINZ Target Fields (* for required)
 *    - Right column: Dropdown containing ONLY file headers in exact spreadsheet column order
 *    - Unique selection enforcement: Options selected in one field are disabled in others with '(Already mapped)'
 *    - Instant unmapping: Clearing or deselecting a header immediately frees it for other fields
 *    - Live Row 1 sample preview for instant verification
 * 3. Step 3: Data Preview (First 5 rows + total count) & Import Execution
 */
export default function ZohoStyleBulkImportModal({
  isOpen,
  onClose,
  title = 'Import Records',
  subtitle = 'Upload an Excel or CSV file and map your columns directly to BUSINZ fields',
  entityName = 'Records',
  fields = [],
  sampleTemplateRows = [],
  sampleFileName = 'BUSINZ_Import_Template.xlsx',
  onImport
}) {
  const [importStep, setImportStep] = useState(1); // 1: Select File, 2: Map Fields, 3: Preview & Confirm
  const [file, setFile] = useState(null);
  const [rawRows, setRawRows] = useState([]);
  const [fileHeaders, setFileHeaders] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  const [compiledData, setCompiledData] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Reset modal state when closed or opened
  const handleClose = () => {
    if (isImporting) return;
    setImportStep(1);
    setFile(null);
    setRawRows([]);
    setFileHeaders([]);
    setFieldMapping({});
    setCompiledData([]);
    setErrorMsg(null);
    onClose();
  };

  // Smart Header Auto-detection
  const guessMapping = (headersList) => {
    const used = new Set();
    const mapping = {};

    fields.forEach(f => {
      const patterns = f.guessPatterns || [];
      for (const pattern of patterns) {
        const found = headersList.find(h => !used.has(h) && pattern.test(String(h || '').trim()));
        if (found) {
          used.add(found);
          mapping[f.key] = found;
          break;
        }
      }
      if (!mapping[f.key]) {
        mapping[f.key] = '';
      }
    });

    return mapping;
  };

  const handleDownloadSample = () => {
    if (!sampleTemplateRows || sampleTemplateRows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(sampleTemplateRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, sampleFileName);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!Array.isArray(rawJson) || rawJson.length === 0) {
          setErrorMsg('The uploaded sheet contains no data rows.');
          setRawRows([]);
          setFileHeaders([]);
          return;
        }

        // Extract column headers in exact spreadsheet column order
        const headerRow = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [])
          .map(h => String(h || '').trim())
          .filter(h => h && !h.startsWith('__EMPTY'));

        const headersSet = new Set(headerRow);
        rawJson.forEach(row => {
          Object.keys(row).forEach(k => {
            const trimmed = String(k || '').trim();
            if (trimmed && !trimmed.startsWith('__EMPTY')) {
              headersSet.add(trimmed);
            }
          });
        });

        const headersList = Array.from(headersSet);
        if (headersList.length === 0) {
          setErrorMsg('Could not detect any column headers in the uploaded file.');
          return;
        }

        setRawRows(rawJson);
        setFileHeaders(headersList);

        // Auto-detect matches and advance to Step 2
        const autoMapping = guessMapping(headersList);
        setFieldMapping(autoMapping);
        setImportStep(2);
      } catch (err) {
        console.error('Error reading excel/csv file:', err);
        setErrorMsg('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleProceedToPreview = () => {
    // Check required fields
    const missingRequired = fields.filter(f => f.required && !fieldMapping[f.key]);
    if (missingRequired.length > 0) {
      setErrorMsg(`Please map the required field(s): ${missingRequired.map(f => `"${f.label}"`).join(', ')}.`);
      return;
    }

    setErrorMsg(null);

    // Compile rows using chosen mapping
    const compiled = rawRows.map((row, idx) => {
      const record = { _rawIndex: idx };
      fields.forEach(f => {
        const header = fieldMapping[f.key];
        const val = header ? row[header] : '';
        record[f.key] = val !== undefined && val !== null ? String(val).trim() : '';
      });
      return record;
    }).filter(row => {
      // Must have at least one required field or non-empty key value
      const primaryKey = fields.find(f => f.required)?.key || fields[0]?.key;
      return primaryKey ? Boolean(row[primaryKey]) : Object.values(row).some(Boolean);
    });

    if (compiled.length === 0) {
      setErrorMsg('No valid records could be compiled with the selected mapping. Please check your column choices.');
      return;
    }

    setCompiledData(compiled);
    setImportStep(3);
  };

  const handleExecuteImport = async () => {
    if (compiledData.length === 0) return;
    setIsImporting(true);
    setErrorMsg(null);
    try {
      if (typeof onImport === 'function') {
        await onImport(compiledData, rawRows);
      }
      handleClose();
    } catch (err) {
      console.error('Import error:', err);
      setErrorMsg('Import failed: ' + (err.message || 'Unknown error occurred'));
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.15s ease'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isImporting) {
          handleClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid #F1F5F9',
            backgroundColor: '#F8FAFC'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#ECFEFF',
                color: '#0E7490',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <UploadCloud size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                {title}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                {subtitle}
              </p>
            </div>
          </div>

          <button
            disabled={isImporting}
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: isImporting ? 'not-allowed' : 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Wizard Progress Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 24px',
            backgroundColor: '#F1F5F9',
            borderBottom: '1px solid #E2E8F0',
            fontSize: '12px',
            fontWeight: '700'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              onClick={() => { if (importStep > 1 && !isImporting) setImportStep(1); }}
              style={{
                cursor: importStep > 1 ? 'pointer' : 'default',
                color: importStep === 1 ? '#0E7490' : (importStep > 1 ? '#16A34A' : '#64748B'),
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: importStep === 1 ? '#0E7490' : (importStep > 1 ? '#DCFCE7' : '#E2E8F0'),
                color: importStep === 1 ? '#FFFFFF' : (importStep > 1 ? '#16A34A' : '#64748B'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px'
              }}>
                {importStep > 1 ? '✓' : '1'}
              </span>
              <span>1. Select File</span>
            </div>

            <ChevronRight size={14} style={{ color: '#94A3B8' }} />

            <div
              onClick={() => { if (rawRows.length > 0 && !isImporting) setImportStep(2); }}
              style={{
                cursor: rawRows.length > 0 ? 'pointer' : 'default',
                color: importStep === 2 ? '#0E7490' : (importStep > 2 ? '#16A34A' : '#64748B'),
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: importStep === 2 ? '#0E7490' : (importStep > 2 ? '#DCFCE7' : '#E2E8F0'),
                color: importStep === 2 ? '#FFFFFF' : (importStep > 2 ? '#16A34A' : '#64748B'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px'
              }}>
                {importStep > 2 ? '✓' : '2'}
              </span>
              <span>2. Map Fields</span>
            </div>

            <ChevronRight size={14} style={{ color: '#94A3B8' }} />

            <div
              style={{
                color: importStep === 3 ? '#0E7490' : '#64748B',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: importStep === 3 ? '#0E7490' : '#E2E8F0',
                color: importStep === 3 ? '#FFFFFF' : '#64748B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px'
              }}>
                3
              </span>
              <span>3. Preview & Import</span>
            </div>
          </div>

          {file && (
            <div style={{ fontSize: '11.5px', color: '#475569', fontWeight: '500' }}>
              File: <strong>{file.name}</strong> ({rawRows.length} rows)
            </div>
          )}
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 20px',
              backgroundColor: '#FEF2F2',
              borderBottom: '1px solid #FCA5A5',
              color: '#991B1B',
              fontSize: '12.5px'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>{errorMsg}</div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', padding: 0 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ========================================================================= */}
          {/* STEP 1: SELECT FILE */}
          {/* ========================================================================= */}
          {importStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Upload Drop Zone */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />

                <div
                  onClick={() => {
                    if (!isImporting && fileInputRef.current) {
                      fileInputRef.current.click();
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (isImporting) return;
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      const droppedFile = e.dataTransfer.files[0];
                      const fakeEvent = { target: { files: [droppedFile] } };
                      handleFileChange(fakeEvent);
                    }
                  }}
                  style={{
                    border: '2px dashed #CBD5E1',
                    borderRadius: '12px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    backgroundColor: '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#0E7490';
                    e.currentTarget.style.backgroundColor = '#F0FDFA';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#CBD5E1';
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                  }}
                >
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '50%',
                      backgroundColor: '#F1F5F9',
                      color: '#0E7490',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '4px'
                    }}
                  >
                    <UploadCloud size={28} />
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                    Click to select an Excel (.xlsx, .xls) or CSV file
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748B' }}>
                    or drag and drop your spreadsheet here to map fields
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: ZOHO-STYLE FIELD MAPPING TABLE */}
          {/* ========================================================================= */}
          {importStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  fontSize: '12px',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>
                  Map your spreadsheet columns to BUSINZ {entityName.toLowerCase()} fields. Columns selected once are automatically prevented from duplicate selection.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) fileInputRef.current.click();
                  }}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#0E7490',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Change File
                </button>
              </div>

              {/* Zoho Books Style Mapping Table */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '42% 58%',
                    backgroundColor: '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    padding: '10px 16px',
                    fontSize: '11.5px',
                    fontWeight: '800',
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  <div>BUSINZ FIELD</div>
                  <div>IMPORTED FILE HEADERS ({fileHeaders.length} Columns Found)</div>
                </div>

                <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  {fields.map((field, idx) => {
                    const selectedHeader = fieldMapping[field.key] || '';
                    const sampleVal = selectedHeader && rawRows[0] ? rawRows[0][selectedHeader] : null;

                    return (
                      <div
                        key={field.key}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '42% 58%',
                          alignItems: 'center',
                          padding: '10px 16px',
                          borderBottom: idx < fields.length - 1 ? '1px solid #F1F5F9' : 'none',
                          backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'
                        }}
                      >
                        {/* Left: Target Field */}
                        <div style={{ paddingRight: '12px' }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{field.label}</span>
                            {field.required && (
                              <span style={{ color: '#EF4444', fontWeight: '800' }}>*</span>
                            )}
                          </div>
                          {field.hint && (
                            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>
                              {field.hint}
                            </div>
                          )}
                        </div>

                        {/* Right: Dropdown + Unique Selection Enforced */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <select
                              value={selectedHeader}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFieldMapping(prev => ({
                                  ...prev,
                                  [field.key]: val
                                }));
                              }}
                              style={{
                                flex: 1,
                                height: '34px',
                                borderRadius: '6px',
                                border: selectedHeader ? '1.5px solid #0E7490' : '1px solid #CBD5E1',
                                backgroundColor: selectedHeader ? '#F0FDFA' : '#FFFFFF',
                                color: selectedHeader ? '#0F172A' : '#64748B',
                                fontSize: '12.5px',
                                fontWeight: selectedHeader ? '600' : '400',
                                padding: '0 8px',
                                outline: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="">Select</option>
                              {fileHeaders.map(hdr => {
                                const isUsedElsewhere = Object.entries(fieldMapping).some(
                                  ([k, v]) => k !== field.key && v === hdr
                                );
                                return (
                                  <option key={hdr} value={hdr} disabled={isUsedElsewhere}>
                                    {hdr} {isUsedElsewhere ? '(Already mapped)' : ''}
                                  </option>
                                );
                              })}
                            </select>

                            {selectedHeader && (
                              <button
                                type="button"
                                title="Unmap this field"
                                onClick={() => {
                                  setFieldMapping(prev => ({ ...prev, [field.key]: '' }));
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#94A3B8',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <X size={15} />
                              </button>
                            )}
                          </div>

                          {/* Row 1 Sample Preview */}
                          {selectedHeader && sampleVal !== null && sampleVal !== undefined && (
                            <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '2px' }}>
                              <span style={{ color: '#0E7490', fontWeight: '700' }}>Row 1 Sample:</span>
                              <span style={{ color: '#334155', fontStyle: 'italic', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                "{String(sampleVal).trim() || '(empty)'}"
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: PREVIEW & CONFIRM */}
          {/* ========================================================================= */}
          {importStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: '#F0FDFA',
                  borderRadius: '8px',
                  border: '1px solid #CCFBF1'
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#134E4A' }}>
                    Ready to Import {compiledData.length} {entityName}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#115E59' }}>
                    Records compiled using your custom column mapping from <strong>{file?.name}</strong>.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setImportStep(2)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #0E7490',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#0E7490',
                    cursor: 'pointer'
                  }}
                >
                  ← Adjust Mapping
                </button>
              </div>

              <div style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                Preview (First {Math.min(compiledData.length, 5)} rows):
              </div>

              <div
                style={{
                  maxHeight: '260px',
                  overflowY: 'auto',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px'
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                      {fields.slice(0, 6).map(f => (
                        <th key={f.key} style={{ padding: '8px 12px', fontWeight: '700', color: '#475569' }}>
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compiledData.slice(0, 5).map((row, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: idx < 4 ? '1px solid #F1F5F9' : 'none',
                          backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'
                        }}
                      >
                        {fields.slice(0, 6).map(f => (
                          <td key={f.key} style={{ padding: '8px 12px', color: '#334155', fontWeight: f.required ? '600' : '400' }}>
                            {row[f.key] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {compiledData.length > 5 && (
                <div style={{ fontSize: '11.5px', color: '#64748B', textAlign: 'right' }}>
                  + {compiledData.length - 5} more records will be imported
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderTop: '1px solid #F1F5F9',
            backgroundColor: '#F8FAFC'
          }}
        >
          <div>
            {importStep > 1 ? (
              <button
                type="button"
                disabled={isImporting}
                onClick={() => setImportStep(prev => prev - 1)}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  borderRadius: '8px',
                  padding: '9px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: isImporting ? 'not-allowed' : 'pointer'
                }}
              >
                ← Previous
              </button>
            ) : (
              <button
                type="button"
                disabled={isImporting}
                onClick={handleClose}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  borderRadius: '8px',
                  padding: '9px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: isImporting ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {importStep === 1 && (
              <button
                type="button"
                disabled={rawRows.length === 0}
                onClick={() => setImportStep(2)}
                style={{
                  backgroundColor: rawRows.length > 0 ? '#0E7490' : '#94A3B8',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  padding: '9px 20px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: rawRows.length > 0 ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: rawRows.length > 0 ? '0 2px 4px rgba(14, 116, 144, 0.25)' : 'none'
                }}
              >
                <span>Next: Map Fields</span>
                <ArrowRight size={15} />
              </button>
            )}

            {importStep === 2 && (
              <button
                type="button"
                onClick={handleProceedToPreview}
                style={{
                  backgroundColor: '#0E7490',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  padding: '9px 22px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>Next: Preview Data ({rawRows.length} Rows)</span>
                <ArrowRight size={15} />
              </button>
            )}

            {importStep === 3 && (
              <button
                type="button"
                disabled={isImporting || compiledData.length === 0}
                onClick={handleExecuteImport}
                style={{
                  backgroundColor: compiledData.length > 0 ? '#0E7490' : '#94A3B8',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  padding: '9px 24px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: isImporting || compiledData.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: compiledData.length > 0 ? '0 2px 4px rgba(14, 116, 144, 0.25)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Importing {entityName}...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={16} />
                    <span>Import & Save ({compiledData.length}) {entityName}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
