import React, { useState, useEffect } from 'react';
import {
  Sliders, X, CheckCircle2, AlertCircle,
  RefreshCw, Eye, EyeOff, Building2,
  Key, Lock, Check
} from 'lucide-react';

export default function ZohoConfigModal({ isOpen, onClose, initialConfig, onSaved }) {
  const [formData, setFormData] = useState({
    companyName: '',
    orgId: '',
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    apiDomain: 'https://www.zohoapis.in',
    accountsDomain: 'https://accounts.zoho.in'
  });

  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState(null); // { success: boolean, message: string, organization?: any }
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (initialConfig) {
      setFormData({
        companyName: initialConfig.companyName || 'VRM Structures India Private Limited',
        orgId: initialConfig.orgId || '',
        clientId: initialConfig.clientId || '',
        clientSecret: initialConfig.clientSecret || '',
        refreshToken: initialConfig.refreshToken || '',
        apiDomain: initialConfig.apiDomain || 'https://www.zohoapis.in',
        accountsDomain: initialConfig.accountsDomain || 'https://accounts.zoho.in'
      });
    }
  }, [initialConfig, isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestFeedback(null);
    setSaveError(null);

    try {
      const res = await fetch('/api/zoho/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.success) {
        setTestFeedback({
          success: true,
          message: data.message || 'Successfully connected to Zoho Books!',
          organization: data.organization
        });
      } else {
        setTestFeedback({
          success: false,
          message: data.error || 'Connection test failed. Please verify credentials.'
        });
      }
    } catch (err) {
      setTestFeedback({
        success: false,
        message: 'Network error contacting backend: ' + err.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.orgId.trim() || !formData.clientId.trim() || !formData.clientSecret.trim() || !formData.refreshToken.trim()) {
      setSaveError('Please fill in Organization ID, Client ID, Client Secret, and Refresh Token.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/zoho/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.success) {
        if (onSaved) onSaved(data.config);
        onClose();
      } else {
        setSaveError(data.error || 'Failed to save Zoho configuration.');
      }
    } catch (err) {
      setSaveError('Error saving configuration: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '640px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #F8FAFC 0%, #ECFEFF 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: '#ECFEFF',
              border: '1px solid #CFFAFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0E7490'
            }}>
              <Sliders size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  Zoho Books Company & Account Settings
                </h2>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  backgroundColor: '#E0F2FE',
                  color: '#0369A1',
                  padding: '2px 8px',
                  borderRadius: '10px'
                }}>
                  Live Sync
                </span>
              </div>
              <p style={{ fontSize: '12.5px', color: '#64748B', margin: '3px 0 0 0', fontWeight: '500' }}>
                Update your connected company details and Zoho Books credentials.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: '#FFFFFF',
              borderRadius: '10px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748B',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSave} style={{
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          boxSizing: 'border-box'
        }}>
          {/* Company / Legal Entity Name */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Company / Business Name
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="e.g. VRM Structures India Private Limited"
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <Building2 size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '11px' }} />
            </div>
            <p style={{ fontSize: '11px', color: '#64748B', margin: '4px 0 0 0' }}>
              The business or company entity associated with your Zoho Books account.
            </p>
          </div>

          {/* Zoho Organization ID */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Zoho Books Organization ID <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={formData.orgId}
              onChange={(e) => setFormData({ ...formData, orgId: e.target.value })}
              placeholder="e.g. 60082137608"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                fontFamily: 'monospace',
                fontWeight: '600',
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <p style={{ fontSize: '11px', color: '#64748B', margin: '4px 0 0 0' }}>
              Found in Zoho Books: click the top-right Settings Gear ⚙️ &rarr; <strong>Organization Profile</strong>.
            </p>
          </div>

          {/* Zoho Client ID */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Zoho Client ID <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                required
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                placeholder="e.g. 1000.9U5BAN338075M5HBI3U8K1VBNKUU8K"
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12.5px',
                  fontFamily: 'monospace',
                  fontWeight: '600',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <Key size={15} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '11px' }} />
            </div>
            <p style={{ fontSize: '11px', color: '#64748B', margin: '4px 0 0 0' }}>
              From Zoho API Console (<code>api-console.zoho.in</code>).
            </p>
          </div>

          {/* Zoho Client Secret */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Zoho Client Secret <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showSecret ? 'text' : 'password'}
                required
                value={formData.clientSecret}
                onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                placeholder="Enter client secret"
                style={{
                  width: '100%',
                  padding: '9px 40px 9px 36px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12.5px',
                  fontFamily: 'monospace',
                  fontWeight: '600',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <Lock size={15} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '11px' }} />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '9px',
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer'
                }}
              >
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Zoho Refresh Token */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Zoho OAuth Refresh Token <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showToken ? 'text' : 'password'}
                required
                value={formData.refreshToken}
                onChange={(e) => setFormData({ ...formData, refreshToken: e.target.value })}
                placeholder="e.g. 1000.dbba4167...99dacc15c2ef"
                style={{
                  width: '100%',
                  padding: '9px 40px 9px 36px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12.5px',
                  fontFamily: 'monospace',
                  fontWeight: '600',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <Key size={15} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '11px' }} />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '9px',
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer'
                }}
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p style={{ fontSize: '11px', color: '#64748B', margin: '4px 0 0 0' }}>
              Requires scope: <code>ZohoBooks.fullaccess.all</code>.
            </p>
          </div>

          {/* Live Test Feedback Banner */}
          {testFeedback && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: testFeedback.success ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${testFeedback.success ? '#BBF7D0' : '#FECACA'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {testFeedback.success ? (
                  <CheckCircle2 size={17} color="#166534" />
                ) : (
                  <AlertCircle size={17} color="#DC2626" />
                )}
                <span style={{
                  fontSize: '12.5px',
                  fontWeight: '700',
                  color: testFeedback.success ? '#166534' : '#991B1B'
                }}>
                  {testFeedback.message}
                </span>
              </div>

              {testFeedback.organization && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '6px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  border: '1px solid #DCFCE7',
                  marginTop: '4px'
                }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#64748B', display: 'block', fontWeight: '600' }}>Verified Organization:</span>
                    <strong style={{ fontSize: '12px', color: '#0F172A' }}>{testFeedback.organization.name}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#64748B', display: 'block', fontWeight: '600' }}>Organization ID:</span>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#0F172A' }}>{testFeedback.organization.orgId}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#64748B', display: 'block', fontWeight: '600' }}>Currency:</span>
                    <span style={{ fontSize: '12px', color: '#0F172A' }}>{testFeedback.organization.currencyCode} ({testFeedback.organization.currencySymbol})</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#64748B', display: 'block', fontWeight: '600' }}>Contact Email:</span>
                    <span style={{ fontSize: '12px', color: '#0F172A' }}>{testFeedback.organization.contactEmail || 'N/A'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Save Error */}
          {saveError && (
            <div style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#B91C1C',
              fontSize: '12px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <AlertCircle size={15} />
              <span>{saveError}</span>
            </div>
          )}

          {/* Modal Footer Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            borderTop: '1px solid #E2E8F0',
            paddingTop: '16px',
            marginTop: '8px'
          }}>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !formData.orgId || !formData.refreshToken}
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #CBD5E1',
                color: '#334155',
                padding: '9px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: isTesting ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={13} className={isTesting ? 'animate-spin' : ''} />
              <span>{isTesting ? 'Verifying with Zoho...' : 'Test Connection'}</span>
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  padding: '9px 16px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  backgroundColor: '#0E7490',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '9px 20px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: isSaving ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(14, 116, 144, 0.25)'
                }}
              >
                {isSaving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={14} />}
                <span>{isSaving ? 'Saving Changes...' : 'Save & Apply Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
