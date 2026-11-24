import React, { useState, useRef } from 'react';
import {
  X, RotateCcw, Save, Upload, Trash2, CheckCircle,
  Palette, Eye, CreditCard, Stamp, PenTool, Info,
  Sliders, Layers, Image, Lock
} from 'lucide-react';
import { compressImageFile, COLOR_PRESETS, TITLE_PRESETS } from './piTemplateConfig';

/**
 * Customizer Drawer Panel for Live Template Editing
 */
export default function TemplateCustomizerDrawer({
  settings,
  onUpdateSettings,
  onSaveAsDefault,
  onResetDefaults,
  onClose
}) {
  const [activeTab, setActiveTab] = useState('branding'); // branding | stampSign | columns | sections | banking
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingStamp, setIsUploadingStamp] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);

  const logoInputRef = useRef(null);
  const stampInputRef = useRef(null);
  const signatureInputRef = useRef(null);

  const handleSave = () => {
    onSaveAsDefault();
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2500);
  };

  // Upload handlers
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingLogo(true);
      const dataUrl = await compressImageFile(file, 450, 0.85);
      try {
        localStorage.setItem('vrm_constant_logo', dataUrl);
      } catch (err) {}
      onUpdateSettings({ customLogoUrl: dataUrl, showLogo: true, logoHeight: 56 });
    } catch (err) {
      alert('Failed to upload logo: ' + err.message);
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleStampUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingStamp(true);
      const dataUrl = await compressImageFile(file, 350, 0.85);
      try {
        localStorage.setItem('vrm_constant_stamp', dataUrl);
      } catch (err) {}
      onUpdateSettings({ customStampUrl: dataUrl, stampMode: 'custom', showSignatoryStamp: true, stampSize: 230 });
    } catch (err) {
      alert('Failed to upload stamp: ' + err.message);
    } finally {
      setIsUploadingStamp(false);
      if (stampInputRef.current) stampInputRef.current.value = '';
    }
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingSignature(true);
      const dataUrl = await compressImageFile(file, 350, 0.85);
      onUpdateSettings({ customSignatureUrl: dataUrl, signatureMode: 'custom', showSignatoryStamp: true });
    } catch (err) {
      alert('Failed to upload signature: ' + err.message);
    } finally {
      setIsUploadingSignature(false);
      if (signatureInputRef.current) signatureInputRef.current.value = '';
    }
  };

  return (
    <div
      className="no-print"
      style={{
        width: '390px',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 20px 35px -5px rgba(0,0,0,0.25)',
        border: '1px solid #CBD5E1',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 90px)',
        maxHeight: '800px',
        position: 'sticky',
        top: '20px',
        overflow: 'hidden',
        zIndex: 10
      }}
    >
      {/* DRAWER HEADER */}
      <div style={{
        padding: '14px 18px',
        backgroundColor: '#0F172A',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #334155'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={17} style={{ color: '#38BDF8' }} />
          <div>
            <div style={{ fontWeight: '800', fontSize: '13.5px' }}>Customize Template</div>
            <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Custom Logo, Stamp, Signature & Layout</div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* TAB NAVIGATION */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        backgroundColor: '#F8FAFC',
        borderBottom: '1px solid #E2E8F0',
        padding: '4px'
      }}>
        {[
          { id: 'branding', label: 'Logo & Colors', icon: Palette },
          { id: 'stampSign', label: 'Stamp & Sign', icon: PenTool },
          { id: 'columns', label: 'Columns', icon: Layers },
          { id: 'sections', label: 'Sections', icon: Eye },
          { id: 'banking', label: 'Banking', icon: CreditCard }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '7px 2px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? '#0E7490' : '#64748B',
                fontWeight: isActive ? '700' : '600',
                fontSize: '10.5px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              <Icon size={13} />
              <span style={{ fontSize: '9.5px', textAlign: 'center' }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SCROLLABLE SETTINGS CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

        {/* TAB 1: BRANDING, LOGO & THEME */}
        {activeTab === 'branding' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* COMPANY LOGO SECTION */}
            <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Image size={14} style={{ color: '#0E7490' }} /> Company Logo
                </span>
                <label htmlFor="vrmproforma-invoice-print-template-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748B', cursor: 'pointer' }}>
                  <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                    type="checkbox"
                    checked={settings.showLogo}
                    onChange={(e) => onUpdateSettings({ showLogo: e.target.checked })}
                    style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
                   />
                  <span>Show</span>
                </label>
              </div>

              {settings.showLogo && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Current Logo Preview */}
                  <div style={{
                    padding: '8px 12px',
                    backgroundColor: '#FFFFFF',
                    border: '1px dashed #CBD5E1',
                    borderRadius: '6px',
                    textAlign: 'center',
                    minHeight: '56px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src={settings.customLogoUrl || '/vrm_logo.png'}
                      alt="Logo Preview"
                      style={{ maxHeight: '48px', maxWidth: '180px', objectFit: 'contain' }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>

                  {/* Logo Actions */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input id="vrmproforma-invoice-print-template-input-1" name="input1" aria-label="Input 1"
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleLogoUpload}
                     />
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isUploadingLogo}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        backgroundColor: '#0E7490',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Upload size={13} /> {isUploadingLogo ? 'Processing...' : (settings.customLogoUrl ? 'Change Logo' : 'Upload Logo')}
                    </button>

                    {settings.customLogoUrl && (
                      <button
                        onClick={() => onUpdateSettings({ customLogoUrl: null })}
                        title="Reset to default VRM logo"
                        style={{
                          padding: '6px 10px',
                          backgroundColor: '#FEE2E2',
                          color: '#DC2626',
                          border: '1px solid #FCA5A5',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Trash2 size={12} /> Reset
                      </button>
                    )}
                  </div>

                  {/* Fixed Logo Size (Locked) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: '#64748B',
                    backgroundColor: '#FFFFFF',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0'
                  }}>
                    <span style={{ fontWeight: '600' }}>Logo Dimensions:</span>
                    <span style={{ fontWeight: '700', color: '#0E7490', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Lock size={12} style={{ flexShrink: 0 }} /> Fixed Standard (56px)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ACCENT COLOR */}
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '8px' }}>
                Brand Accent Color
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {COLOR_PRESETS.map(preset => {
                  const isSelected = settings.accentColor === preset.hex;
                  return (
                    <button
                      key={preset.hex}
                      onClick={() => onUpdateSettings({ accentColor: preset.hex })}
                      style={{
                        padding: '6px 8px',
                        border: isSelected ? `2px solid ${preset.hex}` : '1px solid #E2E8F0',
                        borderRadius: '6px',
                        backgroundColor: isSelected ? `${preset.hex}10` : '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        fontWeight: isSelected ? '700' : '500',
                        color: '#1E293B'
                      }}
                    >
                      <span style={{ width: '13px', height: '13px', borderRadius: '50%', backgroundColor: preset.hex, display: 'inline-block' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DOCUMENT TITLE */}
            <div>
              <label htmlFor="vrmproforma-invoice-print-template-document-title" style={{ fontSize: '11.5px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '6px' }}>
                Document Title
              </label>
              <input id="vrmproforma-invoice-print-template-document-title" name="documentTitle" aria-label="Document Title"
                type="text"
                value={settings.documentTitle}
                onChange={(e) => onUpdateSettings({ documentTitle: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#0F172A',
                  boxSizing: 'border-box'
                }}
               />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                {TITLE_PRESETS.map(preset => (
                  <button
                    key={preset}
                    onClick={() => onUpdateSettings({ documentTitle: preset })}
                    style={{
                      fontSize: '10px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: settings.documentTitle === preset ? '#ECFEFF' : '#F8FAFC',
                      color: settings.documentTitle === preset ? '#0E7490' : '#475569',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* BRAND DETAILS TOGGLES */}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#0F172A' }}>Header Display Options</label>

              <label htmlFor="vrmproforma-invoice-print-template-show-gstin-cin" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '11.5px', color: '#334155' }}>
                <span>Show GSTIN & CIN Numbers</span>
                <input id="vrmproforma-invoice-print-template-show-gstin-cin" name="showGSTINCIN" aria-label="Show GSTIN & CIN Numbers"
                  type="checkbox"
                  checked={settings.showCinGst}
                  onChange={(e) => onUpdateSettings({ showCinGst: e.target.checked })}
                  style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
                 />
              </label>

              <label htmlFor="vrmproforma-invoice-print-template-checkbox" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '11.5px', color: '#334155' }}>
                <span>Show Company Address & Contact</span>
                <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Show Company Address & Contact"
                  type="checkbox"
                  checked={settings.showContactInfo}
                  onChange={(e) => onUpdateSettings({ showContactInfo: e.target.checked })}
                  style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
                 />
              </label>
            </div>
          </div>
        )}

        {/* TAB 2: STAMP & SIGNATURE (NEW HIGH-POWERED CUSTOMIZATION) */}
        {activeTab === 'stampSign' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* 1. OFFICIAL COMPANY STAMP SECTION */}
            <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Stamp size={15} style={{ color: '#0E7490' }} /> Company Stamp / Seal
                </span>
                <label htmlFor="vrmproforma-invoice-print-template-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748B', cursor: 'pointer' }}>
                  <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                    type="checkbox"
                    checked={settings.showSignatoryStamp}
                    onChange={(e) => onUpdateSettings({ showSignatoryStamp: e.target.checked })}
                    style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
                   />
                  <span>Show</span>
                </label>
              </div>

              {settings.showSignatoryStamp && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Stamp Mode Switcher */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    {[
                      { id: 'vector', label: 'Vector Seal' },
                      { id: 'custom', label: 'Custom Stamp' },
                      { id: 'none', label: 'No Stamp' }
                    ].map(mode => {
                      const isSel = settings.stampMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          onClick={() => onUpdateSettings({ stampMode: mode.id })}
                          style={{
                            padding: '6px 4px',
                            borderRadius: '6px',
                            border: isSel ? `2px solid ${settings.accentColor}` : '1px solid #CBD5E1',
                            backgroundColor: isSel ? '#FFFFFF' : '#F1F5F9',
                            color: isSel ? settings.accentColor : '#475569',
                            fontSize: '10.5px',
                            fontWeight: isSel ? '700' : '600',
                            cursor: 'pointer'
                          }}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Stamp Mode A: Vector Seal Text Config */}
                  {settings.stampMode === 'vector' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                      <div>
                        <label htmlFor="vrmproforma-invoice-print-template-seal-header-text" style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>Seal Header Text</label>
                        <input id="vrmproforma-invoice-print-template-seal-header-text" name="sealHeaderText" aria-label="Seal Header Text"
                          type="text"
                          value={settings.stampText}
                          onChange={(e) => onUpdateSettings({ stampText: e.target.value })}
                          style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                         />
                      </div>
                      <div>
                        <label htmlFor="vrmproforma-invoice-print-template-seal-location-subtitle" style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>Seal Location Subtitle</label>
                        <input id="vrmproforma-invoice-print-template-seal-location-subtitle" name="sealLocationSubtitle" aria-label="Seal Location Subtitle"
                          type="text"
                          value={settings.stampLocation}
                          onChange={(e) => onUpdateSettings({ stampLocation: e.target.value })}
                          style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                         />
                      </div>
                    </div>
                  )}

                  {/* Stamp Mode B: Custom Uploaded Stamp Image */}
                  {settings.stampMode === 'custom' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      <div style={{
                        padding: '8px',
                        backgroundColor: '#FFFFFF',
                        border: '1px dashed #CBD5E1',
                        borderRadius: '6px',
                        textAlign: 'center',
                        minHeight: '52px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {settings.customStampUrl ? (
                          <img
                            src={settings.customStampUrl}
                            alt="Custom Stamp Preview"
                            style={{ maxHeight: '48px', maxWidth: '120px', objectFit: 'contain' }}
                          />
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>No stamp image uploaded yet</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input id="vrmproforma-invoice-print-template-input-2" name="input2" aria-label="Input 2"
                          ref={stampInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleStampUpload}
                         />
                        <button
                          onClick={() => stampInputRef.current?.click()}
                          disabled={isUploadingStamp}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            backgroundColor: '#0E7490',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <Upload size={12} /> {isUploadingStamp ? 'Uploading...' : (settings.customStampUrl ? 'Change Stamp Image' : 'Upload Stamp Image')}
                        </button>

                        {settings.customStampUrl && (
                          <button
                            onClick={() => onUpdateSettings({ customStampUrl: null, stampMode: 'vector' })}
                            title="Remove custom stamp"
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#FEE2E2',
                              color: '#DC2626',
                              border: '1px solid #FCA5A5',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748B' }}>
                        💡 Tip: Transparent PNG of rubber stamp gives the best official look.
                      </div>
                    </div>
                  )}

                  {/* Fixed Stamp Size (Locked) */}
                  {settings.stampMode !== 'none' && (
                    <div style={{
                      marginTop: '6px',
                      padding: '8px 10px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '6px',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: '#64748B'
                    }}>
                      <span style={{ fontWeight: '600' }}>Stamp Dimensions:</span>
                      <span style={{ fontWeight: '700', color: '#0E7490', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Lock size={12} style={{ flexShrink: 0 }} /> Fixed Standard (230px)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. AUTHORIZED SIGNATURE SECTION */}
            <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PenTool size={14} style={{ color: '#0E7490' }} /> Authorized Signature
                </span>
                {settings.signatureMode && settings.signatureMode !== 'none' && (
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ signatureMode: 'none' })}
                    style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      color: '#EF4444',
                      backgroundColor: '#FEE2E2',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      cursor: 'pointer'
                    }}
                    title="Remove Authorized Signature"
                  >
                    ✕ Remove
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Signature Mode Switcher */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px' }}>
                  {[
                    { id: 'none', label: 'None' },
                    { id: 'vector', label: 'Digital' },
                    { id: 'custom', label: 'Upload' },
                    { id: 'blank', label: 'Line' }
                  ].map(mode => {
                    const isSel = (settings.signatureMode || 'none') === mode.id;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => onUpdateSettings({ signatureMode: mode.id })}
                        style={{
                          padding: '6px 4px',
                          borderRadius: '6px',
                          border: isSel ? `2px solid ${settings.accentColor}` : '1px solid #CBD5E1',
                          backgroundColor: isSel ? '#FFFFFF' : '#F1F5F9',
                          color: isSel ? settings.accentColor : '#475569',
                          fontSize: '10px',
                          fontWeight: isSel ? '700' : '600',
                          cursor: 'pointer'
                        }}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>

                {/* Signature Custom Image Upload */}
                {settings.signatureMode === 'custom' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    <div style={{
                      padding: '8px',
                      backgroundColor: '#FFFFFF',
                      border: '1px dashed #CBD5E1',
                      borderRadius: '6px',
                      textAlign: 'center',
                      minHeight: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {settings.customSignatureUrl ? (
                        <img
                          src={settings.customSignatureUrl}
                          alt="Custom Signature Preview"
                          style={{ maxHeight: '40px', maxWidth: '140px', objectFit: 'contain' }}
                        />
                      ) : (
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>No signature image uploaded</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input id="vrmproforma-invoice-print-template-input-3" name="input3" aria-label="Input 3"
                        ref={signatureInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleSignatureUpload}
                       />
                      <button
                        onClick={() => signatureInputRef.current?.click()}
                        disabled={isUploadingSignature}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          backgroundColor: '#0E7490',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <Upload size={12} /> {isUploadingSignature ? 'Uploading...' : (settings.customSignatureUrl ? 'Change Signature' : 'Upload Signature')}
                      </button>

                      {settings.customSignatureUrl && (
                        <button
                          onClick={() => onUpdateSettings({ customSignatureUrl: null, signatureMode: 'vector' })}
                          title="Remove custom signature"
                          style={{
                            padding: '6px 10px',
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626',
                            border: '1px solid #FCA5A5',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Signatory Title and Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                  <div>
                    <label htmlFor="vrmproforma-invoice-print-template-signatory-name-optional" style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>Signatory Name (optional)</label>
                    <input id="vrmproforma-invoice-print-template-signatory-name-optional" name="signatoryNameOptional" aria-label="Signatory Name (optional)"
                      type="text"
                      placeholder="e.g. M. Annamalaiyar"
                      value={settings.signatoryName || ''}
                      onChange={(e) => onUpdateSettings({ signatoryName: e.target.value })}
                      style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                     />
                  </div>
                  <div>
                    <label htmlFor="vrmproforma-invoice-print-template-designation-title" style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>Designation Title</label>
                    <input id="vrmproforma-invoice-print-template-designation-title" name="designationTitle" aria-label="Designation Title"
                      type="text"
                      value={settings.signatoryTitle || 'Authorized Signatory'}
                      onChange={(e) => onUpdateSettings({ signatoryTitle: e.target.value })}
                      style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                     />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. CUSTOMER ACCEPTANCE */}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: '11.5px', color: '#0F172A', fontWeight: '700' }}>
              <span>Show Customer Acceptance & Signature Box</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showCustomerAcceptance}
                onChange={(e) => onUpdateSettings({ showCustomerAcceptance: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

          </div>
        )}

        {/* TAB 3: TABLE COLUMNS */}
        {activeTab === 'columns' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '11.5px', color: '#64748B' }}>
              Select which columns and data fields appear in the itemized table:
            </div>

            <label htmlFor="vrmproforma-invoice-print-template-rate-column" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Rate (₹) Column</span>
              <input id="vrmproforma-invoice-print-template-rate-column" name="rateColumn" aria-label="Rate (₹) Column"
                type="checkbox"
                checked={settings.showRateCol !== false}
                onChange={(e) => onUpdateSettings({ showRateCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label htmlFor="vrmproforma-invoice-print-template-hsn-sac-code" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>HSN / SAC Code Column</span>
              <input id="vrmproforma-invoice-print-template-hsn-sac-code" name="hSNSACCode" aria-label="HSN / SAC Code Column"
                type="checkbox"
                checked={settings.showHsn}
                onChange={(e) => onUpdateSettings({ showHsn: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Taxable Value (₹) Column</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showTaxableCol !== false}
                onChange={(e) => onUpdateSettings({ showTaxableCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Set / kW Column</span>
              <input id="vrmproforma-invoice-print-template-set-kw-column" name="setKwColumn" aria-label="Set / kW Column"
                type="checkbox"
                checked={settings.showSetKwCol !== false}
                onChange={(e) => onUpdateSettings({ showSetKwCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label htmlFor="vrmproforma-invoice-print-template-quantity-column" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Quantity Column</span>
              <input id="vrmproforma-invoice-print-template-quantity-column" name="quantityColumn" aria-label="Quantity Column"
                type="checkbox"
                checked={settings.showQty !== false}
                onChange={(e) => onUpdateSettings({ showQty: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Unit of Measure (UOM) Column</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showUom}
                onChange={(e) => onUpdateSettings({ showUom: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Total / Amount (₹) Column</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showTotalCol !== false}
                onChange={(e) => onUpdateSettings({ showTotalCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label htmlFor="vrmproforma-invoice-print-template-discount-column" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Discount Column</span>
              <input id="vrmproforma-invoice-print-template-discount-column" name="discountColumn" aria-label="Discount Column"
                type="checkbox"
                checked={settings.showDiscountCol}
                onChange={(e) => onUpdateSettings({ showDiscountCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label htmlFor="vrmproforma-invoice-print-template-line-item-gst" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Line Item GST% Column</span>
              <input id="vrmproforma-invoice-print-template-line-item-gst" name="lineItemGST" aria-label="Line Item GST% Column"
                type="checkbox"
                checked={settings.showGstCol}
                onChange={(e) => onUpdateSettings({ showGstCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label htmlFor="vrmproforma-invoice-print-template-s-no-column" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>S.No Column</span>
              <input id="vrmproforma-invoice-print-template-s-no-column" name="sNoColumn" aria-label="S.No Column"
                type="checkbox"
                checked={settings.showSnoCol !== false}
                onChange={(e) => onUpdateSettings({ showSnoCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Item Technical Descriptions</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showItemDescription}
                onChange={(e) => onUpdateSettings({ showItemDescription: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>
          </div>
        )}

        {/* TAB 4: SECTIONS & ADDRESSES */}
        {activeTab === 'sections' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#0F172A' }}>Address & Transport Blocks</label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Show Ship To / Delivery Address</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showShipTo}
                onChange={(e) => onUpdateSettings({ showShipTo: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Show Dispatch & Vehicle Details</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showTransportDetails}
                onChange={(e) => onUpdateSettings({ showTransportDetails: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Show Sales Executive Name</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showSalesExecutive}
                onChange={(e) => onUpdateSettings({ showSalesExecutive: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>
          </div>
        )}

        {/* TAB 5: BANKING & TERMS */}
        {activeTab === 'banking' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Show Company Bank Account</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showBankDetails}
                onChange={(e) => onUpdateSettings({ showBankDetails: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            {settings.showBankDetails && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                <div>
                  <label htmlFor="vrmproforma-invoice-print-template-beneficiary-name" style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B' }}>Beneficiary Name</label>
                  <input id="vrmproforma-invoice-print-template-beneficiary-name" name="beneficiaryName" aria-label="Beneficiary Name"
                    type="text"
                    value={settings.bankBeneficiary}
                    onChange={(e) => onUpdateSettings({ bankBeneficiary: e.target.value })}
                    style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                   />
                </div>
                <div>
                  <label htmlFor="vrmproforma-invoice-print-template-bank-name" style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B' }}>Bank Name</label>
                  <input id="vrmproforma-invoice-print-template-bank-name" name="bankName" aria-label="Bank Name"
                    type="text"
                    value={settings.bankName}
                    onChange={(e) => onUpdateSettings({ bankName: e.target.value })}
                    style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                   />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label htmlFor="vrmproforma-invoice-print-template-account-no" style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B' }}>Account No.</label>
                    <input id="vrmproforma-invoice-print-template-account-no" name="accountNo" aria-label="Account No."
                      type="text"
                      value={settings.bankAccountNo}
                      onChange={(e) => onUpdateSettings({ bankAccountNo: e.target.value })}
                      style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                     />
                  </div>
                  <div>
                    <label htmlFor="vrmproforma-invoice-print-template-ifsc-code" style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B' }}>IFSC Code</label>
                    <input id="vrmproforma-invoice-print-template-ifsc-code" name="iFSCCode" aria-label="IFSC Code"
                      type="text"
                      value={settings.bankIfsc}
                      onChange={(e) => onUpdateSettings({ bankIfsc: e.target.value })}
                      style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                     />
                  </div>
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600', marginBottom: '8px' }}>
                <span>Show Terms & Conditions</span>
                <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                  type="checkbox"
                  checked={settings.showTerms}
                  onChange={(e) => onUpdateSettings({ showTerms: e.target.checked })}
                  style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
                 />
              </label>

              {settings.showTerms && (
                <div>
                  <label htmlFor="vrmproforma-invoice-print-template-edit-terms-1" style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                    Edit Terms (1 per line)
                  </label>
                  <textarea id="vrmproforma-invoice-print-template-edit-terms-1" name="editTerms1" aria-label="Edit Terms (1 per line)"
                    rows={6}
                    value={settings.termsText}
                    onChange={(e) => onUpdateSettings({ termsText: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '11px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      lineHeight: '1.4',
                      boxSizing: 'border-box',
                      resize: 'vertical'
                    }}
                   />
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* DRAWER FOOTER: PERSISTENCE & ACTIONS */}
      <div style={{
        padding: '12px 18px',
        borderTop: '1px solid #E2E8F0',
        backgroundColor: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {saveSuccessNotice && (
          <div style={{
            fontSize: '11.5px',
            color: '#15803D',
            backgroundColor: '#DCFCE7',
            padding: '6px 10px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: '700'
          }}>
            <CheckCircle size={14} /> Saved as your default template!
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: '#0E7490',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Save size={14} /> Save As Default
          </button>

          <button
            onClick={onResetDefaults}
            title="Reset to factory VRM defaults"
            style={{
              padding: '8px 12px',
              backgroundColor: '#FFFFFF',
              color: '#64748B',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}
