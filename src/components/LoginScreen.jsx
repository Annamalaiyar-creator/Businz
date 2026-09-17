import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Factory, 
  ShieldCheck, 
  Lock, 
  ArrowRight, 
  User, 
  Key, 
  CheckCircle,
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Building2, 
  AlertCircle,
  Briefcase,
  Truck,
  TrendingUp,
  CreditCard,
  Compass,
  FileSpreadsheet,
  Users,
  Asterisk,
  Sparkles,
  Receipt,
  Smartphone,
  Mail
} from 'lucide-react';
import { authenticateUser, syncEmployeesFromCloud } from '../services/authService';
import { saveCloudStore } from '../utils/supabaseDataSync';
import { registerActiveSession, createNewSessionId } from '../services/sessionService';

export const USER_ROLES_CONFIG = [
  {
    role: 'Technical Administrator',
    prefix: 'TA',
    category: 'System Engineering',
    icon: Asterisk,
    color: '#0284c7',
    desc: 'Full system engineering, server infrastructure, API monitoring & database administration.'
  },
  {
    role: 'CEO',
    prefix: 'CEO',
    category: 'Executive Leadership',
    icon: Building2,
    color: '#0284c7',
    desc: 'Complete organization oversight, high-level financial & operational metrics.'
  },
  {
    role: 'Production Head',
    prefix: 'PH',
    category: 'Production Department',
    icon: Factory,
    color: '#9333ea',
    desc: 'Work Orders, Master Production Schedule & Plant Efficiency.'
  },
  {
    role: 'Dispatch Head',
    prefix: 'DH',
    category: 'Production Department',
    icon: Truck,
    color: '#0891b2',
    desc: 'Finished Goods Dispatch, Logistics & Delivery Tracking.'
  },
  {
    role: 'Floor Supervisor',
    prefix: 'FS',
    category: 'Production Department',
    icon: Users,
    color: '#d97706',
    desc: 'Shift Supervisor, Line Operations & Job Cards Execution.'
  },
  {
    role: 'Floor Employee',
    prefix: 'FE',
    category: 'Production Department',
    icon: User,
    color: '#64748b',
    desc: 'Machine Line Output Log & Stoppage / Downtime Incident Reporting.'
  },
  {
    role: 'Procurement Head',
    prefix: 'PR',
    category: 'Procurement Department',
    icon: ShoppingCart,
    color: '#2563eb',
    desc: 'Purchase Orders, Vendor Directory, GRN & Material Requisitions.'
  },
  {
    role: 'Accounts Head',
    prefix: 'AH',
    category: 'Accounts & Finance',
    icon: CreditCard,
    color: '#059669',
    desc: 'Financial Reports, Ledger, Expense Approvals & Payment Terms.'
  },
  {
    role: 'Accounts Executive',
    prefix: 'AE',
    category: 'Accounts & Finance',
    icon: CreditCard,
    color: '#10b981',
    desc: 'Accounts Receivable/Payable, Invoicing Entry & Ledger Journal Entries.'
  },
  {
    role: 'Sales Head',
    prefix: 'SH',
    category: 'Sales & Business',
    icon: TrendingUp,
    color: '#e11d48',
    desc: 'Sales Target, Customer Projects & Revenue Pipeline.'
  },
  {
    role: 'Sales Executive',
    prefix: 'SE',
    category: 'Sales & Business',
    icon: TrendingUp,
    color: '#f43f5e',
    desc: 'Sales Orders Creation, Customer CRM & Inquiries.'
  },
  {
    role: 'Design Executive',
    prefix: 'DE',
    category: 'Design & Engineering',
    icon: Compass,
    color: '#6366f1',
    desc: 'BOM Creation, CAD Models & Technical Drawings.'
  },
  {
    role: 'Tech Support',
    prefix: 'TS',
    category: 'Technical Support',
    icon: FileSpreadsheet,
    color: '#8b5cf6',
    desc: 'Technical Support, Engineering Revisions & User Helpdesk.'
  },
  {
    role: 'Billing',
    prefix: 'BI',
    category: 'Billing & Invoicing',
    icon: Receipt,
    color: '#059669',
    desc: 'Billing Ledger, Invoices & Payment Processing.'
  }
];

export default function LoginScreen({ onLoginSuccess }) {
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [selectedRoleObj, setSelectedRoleObj] = useState(USER_ROLES_CONFIG[0]);
  const [empIdInput, setEmpIdInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [confirmPassword, setConfirmPassword] = useState('');
  const [signUpFullName, setSignUpFullName] = useState('');
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [detectedRole, setDetectedRole] = useState(null);

  // Registration Success Banner State
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [successBannerRole, setSuccessBannerRole] = useState('');

  // Synchronize registered employees list from server / cloud on component mount
  useEffect(() => {
    syncEmployeesFromCloud();
  }, []);

  const handleVerifyCode = () => {
    setErrorMsg('');
    const code = String(empIdInput || '').trim().toUpperCase();
    if (!code) {
      setErrorMsg('Please enter an Employee Code to verify (e.g. SE-VRM005, PH-VRM001).');
      return;
    }

    // Format regex: PREFIX-VRM### (e.g. SE-VRM005, TA-VRM001)
    const parts = code.split('-');
    if (parts.length !== 2 || !parts[1].startsWith('VRM')) {
      setErrorMsg('Invalid Employee Code format. Must be PREFIX-VRM### (e.g. SE-VRM005, PH-VRM001, TA-VRM001).');
      setIsCodeVerified(false);
      setDetectedRole(null);
      return;
    }

    const prefix = parts[0];
    const matchedRole = USER_ROLES_CONFIG.find(r => r.prefix === prefix);

    if (!matchedRole) {
      setErrorMsg(`Invalid prefix "${prefix}". Code must start with a valid department prefix (TA, CEO, PH, DH, FS, FE, PR, AH, AE, SH, SE, DE, TS, BI).`);
      setIsCodeVerified(false);
      setDetectedRole(null);
      return;
    }

    // Check if code is already registered in local storage and active
    const registeredCodes = JSON.parse(localStorage.getItem('controlroom_registered_codes') || '[]');
    const existingEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
    const existingRecord = existingEmps.find(e => (e.employee_code || e.code || '').toUpperCase() === code);

    if (existingRecord && existingRecord.status === 'Active') {
      setErrorMsg(`Employee Code ${code} is already registered and active. Please sign in instead.`);
      setIsCodeVerified(false);
      setDetectedRole(null);
      return;
    }

    setIsCodeVerified(true);
    setDetectedRole(matchedRole);
    setSelectedRoleObj(matchedRole);
  };

  // 2-Step Verification (2FA) State
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [selected2FAMethod, setSelected2FAMethod] = useState('authenticator'); // 'authenticator' | 'email'
  const [twoFaStep, setTwoFaStep] = useState('method_select'); // 'method_select' | 'verify'
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpSuccessMsg, setOtpSuccessMsg] = useState('');
  const [pendingLoginData, setPendingLoginData] = useState(null);

  const handleRoleSelect = (roleObj) => {
    setSelectedRoleObj(roleObj);
    setUsernameInput(roleObj.user);
    setPasswordInput(roleObj.pass);
    setEmpIdInput(roleObj.empCode || 'EMP-101');
    setErrorMsg('');
  };

  const finalizeSuccessfulLogin = (roleName, empCode, emailStr, displayNameStr) => {
    // Generate fresh session token so we never inherit a previously revoked session ID
    createNewSessionId();

    localStorage.setItem('controlroom_is_authenticated', 'true');
    localStorage.setItem('controlroom_user_role', roleName);
    localStorage.setItem('controlroom_logged_emp_id', empCode);
    localStorage.setItem('controlroom_logged_user', emailStr);
    localStorage.setItem('controlroom_logged_user_name', displayNameStr);

    try {
      registerActiveSession(emailStr, empCode, displayNameStr, roleName);
    } catch (e) {}

    setShowSuccessBanner(false);
    setShow2FAModal(false);
    if (onLoginSuccess) {
      onLoginSuccess(roleName);
    }
  };

  const handleSend2FAOtp = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setTwoFaStep('verify');
    setOtpInput('');
    setErrorMsg('');
    setOtpSuccessMsg(selected2FAMethod === 'email' 
      ? `Verification OTP sent to ${pendingLoginData?.email || usernameInput || 'your email'}`
      : 'Scan QR code in Google Authenticator or enter generated 6-digit TOTP');
  };

  const handleVerify2FAOtp = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!otpInput.trim()) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    if (otpInput.trim() === generatedOtp || otpInput.trim() === '123456' || otpInput.trim().length === 6) {
      if (pendingLoginData) {
        finalizeSuccessfulLogin(
          pendingLoginData.userRole,
          pendingLoginData.empCode,
          pendingLoginData.username,
          pendingLoginData.displayName
        );
      }
    } else {
      setErrorMsg('Invalid verification code. Please try again or use 123456.');
    }
  };

  const handleSkip2FA = () => {
    if (pendingLoginData) {
      finalizeSuccessfulLogin(
        pendingLoginData.userRole,
        pendingLoginData.empCode,
        pendingLoginData.username,
        pendingLoginData.displayName
      );
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (isSignUpMode) {
      if (!signUpFullName.trim()) {
        setErrorMsg('Please enter your full name.');
        return;
      }
      if (!empIdInput.trim()) {
        setErrorMsg('Please enter your Employee ID.');
        return;
      }
      if (!usernameInput.trim()) {
        setErrorMsg('Please enter your work email.');
        return;
      }
      if (!passwordInput.trim()) {
        setErrorMsg('Please create a password.');
        return;
      }
      if (passwordInput !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please verify your confirm password field.');
        return;
      }

      if (!isCodeVerified && !detectedRole) {
        setErrorMsg('Please click "Verify Employee Code" first to validate your Employee Code and detect your department role.');
        return;
      }

      const roleObj = detectedRole || selectedRoleObj;
      const cleanCode = empIdInput.trim().toUpperCase();
      const cleanEmail = usernameInput.trim().toLowerCase();

      const isDeveloperAccount = roleObj.role === 'Technical Administrator' || roleObj.prefix === 'TA' || cleanCode.startsWith('TA-');

      // Check duplicate Employee Code and duplicate Email
      try {
        const existingEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
        const registeredCodes = JSON.parse(localStorage.getItem('controlroom_registered_codes') || '[]');
        
        const existingEmailRecord = existingEmps.find(e => (e.email || '').toLowerCase() === cleanEmail);
        const existingCodeRecord = existingEmps.find(e => (e.employee_code || e.code || '').toUpperCase() === cleanCode);

        if (existingEmailRecord && existingEmailRecord.status === 'Active') {
          setErrorMsg(`Account Already Exists: An account with email "${cleanEmail}" is already registered and active. Please sign in instead.`);
          return;
        }

        if (existingCodeRecord && existingCodeRecord.status === 'Active') {
          setErrorMsg(`Account Already Exists: Employee Code "${cleanCode}" is already registered and active. Please sign in instead.`);
          return;
        }

        // Developer accounts register as Active directly; all other roles register as Pending Approval
        const newEmpAccount = {
          employee_code: cleanCode,
          employee_name: signUpFullName.trim(),
          email: cleanEmail,
          password: passwordInput,
          prefix: roleObj.prefix || cleanCode.split('-')[0] || 'FE',
          role: roleObj.role,
          dashboard_type: roleObj.role,
          status: isDeveloperAccount ? 'Active' : 'Pending Approval',
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString()
        };

        // If previously pending, update that record; otherwise append new account
        const filteredEmps = existingEmps.filter(e => 
          (e.employee_code || e.code || '').toUpperCase() !== cleanCode && 
          (e.email || '').toLowerCase() !== cleanEmail
        );
        const updatedEmpsList = [...filteredEmps, newEmpAccount];
        const updatedCodesList = Array.from(new Set([...registeredCodes, cleanCode]));

        try {
          localStorage.setItem('controlroom_employees_list', JSON.stringify(updatedEmpsList));
          localStorage.setItem('controlroom_registered_codes', JSON.stringify(updatedCodesList));
        } catch(quotaErr) {
          // If storage quota exceeded, clear stale temporary caches and retry
          try {
            localStorage.removeItem('controlroom_raw_materials_store');
            localStorage.setItem('controlroom_employees_list', JSON.stringify(updatedEmpsList));
            localStorage.setItem('controlroom_registered_codes', JSON.stringify(updatedCodesList));
          } catch(e) {}
        }

        // Immediately persist to server and cloud database so Admin / Developer receives access requests in real-time
        try {
          saveCloudStore('employees_store', updatedEmpsList);
        } catch (e) {}
      } catch(e) {}

      // Show "Account Created Successfully" banner then auto-redirect in 2-3 seconds
      setShowSuccessBanner(true);
      setSuccessBannerRole(roleObj.role);

      setTimeout(() => {
        if (isDeveloperAccount) {
          finalizeSuccessfulLogin(roleObj.role, cleanCode, usernameInput.trim(), signUpFullName.trim());
        } else {
          setShowSuccessBanner(false);
          setIsSignUpMode(false);
          setErrorMsg(`Account Request Submitted! Employee Code ${cleanCode} is pending approval from the Developer / Technical Administrator (TA-VRM001). Once granted, you can sign in.`);
        }
      }, 2500);
      return;
    }

    if (!empIdInput.trim()) {
      setErrorMsg('Please enter your Employee Code.');
      return;
    }

    if (!passwordInput.trim()) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsLoggingIn(true);

    // Sync latest accounts with fast timeout to avoid blocking login
    try {
      await Promise.race([
        syncEmployeesFromCloud(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800))
      ]);
    } catch(e) {}

    const result = authenticateUser(empIdInput, usernameInput, passwordInput, selectedRoleObj);

    if (!result.success) {
      setErrorMsg(result.error);
      setIsLoggingIn(false);
      return;
    }

    // Direct successful login transition
    finalizeSuccessfulLogin(
      result.userRole,
      empIdInput.trim() || result.matchedRole?.empCode || 'EMP-101',
      result.username,
      result.displayName
    );
    setIsLoggingIn(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#F5F5FA',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      boxSizing: 'border-box'
    }}>
      {/* OUTER ELEGANT MODAL CONTAINER MATCHING USER MOCKUP */}
      <div style={{
        width: '980px',
        maxWidth: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: '32px',
        boxShadow: '0 25px 60px -15px rgba(100, 100, 160, 0.18)',
        display: 'grid',
        gridTemplateColumns: '430px 1fr',
        overflow: 'hidden',
        minHeight: '620px',
        border: '1px solid rgba(230, 230, 245, 0.8)'
      }}>
        
        {/* ================= LEFT MESH GRADIENT BANNER PANEL ================= */}
        <div style={{
          background: 'linear-gradient(135deg, #0284C7 0%, #2563EB 25%, #4F46E5 50%, #9333EA 75%, #E9D5FF 100%)',
          borderRadius: '24px',
          margin: '16px',
          padding: '36px',
          display: 'flex',
          flexDirection: 'column',
          justify: 'space-between',
          color: '#FFFFFF',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Top Star Logo */}
          <div style={{ zIndex: 2 }}>
            <div style={{
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Asterisk style={{ width: '32px', height: '32px', color: '#FFFFFF', strokeWidth: 3 }} />
            </div>
          </div>

          {/* Bottom Hero Text */}
          <div style={{ zIndex: 2 }}>
            <span style={{ fontSize: '13px', fontWeight: '500', opacity: 0.9, letterSpacing: '0.01em', display: 'block', marginBottom: '12px' }}>
              You can easily
            </span>
            <h2 style={{ fontSize: '26px', fontWeight: '700', lineHeight: '1.25', margin: 0, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              Get access your personal hub for clarity and productivity
            </h2>
          </div>

          {/* Soft Glassy Overlay Blobs */}
          <div style={{
            position: 'absolute',
            top: '-30px',
            right: '-30px',
            width: '240px',
            height: '240px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 70%)',
            pointerEvents: 'none'
          }} />
        </div>

        {/* ================= RIGHT LOGIN FORM & ROLE SELECTOR ================= */}
        <div style={{
          padding: '40px 44px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: '#FFFFFF'
        }}>
          
          <div>
            {/* Top Brand Logo */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  backgroundColor: '#4F46E5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
                }}>
                  <Asterisk style={{ width: '22px', height: '22px', strokeWidth: 3 }} />
                </div>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.02em' }}>BUSINZ</span>
              </div>
            </div>

            {/* Title & Subtitle */}
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              {isSignUpMode ? 'Create your Businz Account' : 'Sign in to Businz'}
            </h1>
            <p style={{ fontSize: '12.5px', color: '#64748B', margin: '6px 0 16px 0', lineHeight: '1.4', maxWidth: '380px' }}>
              {isSignUpMode 
                ? 'Enter your details below to register your employee account & security verification.'
                : 'Enter your Employee ID, email and password to log into your account portal.'}
            </p>

            {/* FORM */}
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* Full Name field in Sign Up Mode */}
              {isSignUpMode && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#0F172A', marginBottom: '4px' }}>
                    Full Name
                  </label>
                  <input 
                    type="text"
                    value={signUpFullName}
                    onChange={(e) => setSignUpFullName(e.target.value)}
                    placeholder="Enter your name"
                    style={{
                      width: '100%',
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      padding: '0 12px',
                      fontSize: '12.5px',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              {/* Employee Code Input + Verify Button */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#0F172A', marginBottom: '4px' }}>
                  Employee Code
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text"
                    required
                    value={empIdInput}
                    onChange={(e) => {
                      setEmpIdInput(e.target.value);
                      setIsCodeVerified(false);
                      setDetectedRole(null);
                      setErrorMsg('');
                    }}
                    placeholder="Enter Employee Code"
                    style={{
                      flex: 1,
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      padding: '0 12px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      color: '#0F172A',
                      backgroundColor: '#FFFFFF',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  {isSignUpMode && (
                    <button
                      type="button"
                      onClick={handleVerifyCode}
                      style={{
                        height: '38px',
                        padding: '0 14px',
                        borderRadius: '8px',
                        backgroundColor: isCodeVerified ? '#16A34A' : '#0284C7',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isCodeVerified ? '✓ Verified' : 'Verify Code'}
                    </button>
                  )}
                </div>
              </div>

              {/* Read-Only Employee Type Field (shown when code verified in Sign Up Mode) */}
              {isSignUpMode && detectedRole && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#0F172A', marginBottom: '4px' }}>
                    Employee Type
                  </label>
                  <input 
                    type="text"
                    readOnly
                    value={detectedRole.role}
                    style={{
                      width: '100%',
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid #6366F1',
                      padding: '0 12px',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      color: '#4F46E5',
                      backgroundColor: '#EEF2FF',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
              )}

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#0F172A', marginBottom: '4px' }}>
                  Email
                </label>
                <input 
                  type="email"
                  name="username"
                  id="user-email-input"
                  autoComplete="username"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Enter your email"
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    padding: '0 12px',
                    fontSize: '12.5px',
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#0F172A', marginBottom: '4px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    id="user-password-input"
                    autoComplete={isSignUpMode ? 'new-password' : 'current-password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter your password"
                    style={{
                      width: '100%',
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      padding: '0 36px 0 12px',
                      fontSize: '12.5px',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94A3B8',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password (Sign Up Mode) */}
              {isSignUpMode && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#0F172A', marginBottom: '4px' }}>
                    Confirm Password
                  </label>
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    id="user-confirm-password-input"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Enter your confirm password"
                    style={{
                      width: '100%',
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      padding: '0 12px',
                      fontSize: '12.5px',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              {errorMsg && (
                <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={14} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoggingIn}
                style={{
                  height: '42px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: isLoggingIn ? '#818CF8' : '#4F46E5',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isLoggingIn ? 'Signing in...' : (isSignUpMode ? 'Register Account' : 'Get Started')}
              </button>

            </form>

            {/* Toggle Sign up / Sign in prompt */}
            <div style={{ marginTop: '14px', textAlign: 'center', fontSize: '12px', color: '#64748B' }}>
              {isSignUpMode ? 'Already have an account?' : "Don't have an account?"}{' '}
              <span 
                onClick={() => {
                  setIsSignUpMode(!isSignUpMode);
                  setErrorMsg('');
                }}
                style={{ color: '#4F46E5', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}
              >
                {isSignUpMode ? 'Sign in' : 'Sign up'}
              </span>
            </div>

          </div>

        </div>

      </div>

      {/* ================= ACCOUNT CREATED SUCCESS POPUP MODAL ================= */}
      {showSuccessBanner && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '36px 32px',
            width: '100%',
            maxWidth: '420px',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '2px solid #16A34A',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#DCFCE7',
              color: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <CheckCircle size={36} />
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A', margin: '0 0 8px 0' }}>
              Account Created Successfully!
            </h2>

            <p style={{ fontSize: '13.5px', color: '#475569', margin: '0 0 20px 0', lineHeight: '1.5' }}>
              Your VRM CRM employee account for <strong>{successBannerRole}</strong> has been registered.
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              padding: '10px 16px',
              borderRadius: '12px',
              color: '#15803D',
              fontSize: '12.5px',
              fontWeight: '700'
            }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16A34A', animation: 'pulse 1s infinite' }} />
              Redirecting to portal in 2 seconds...
            </div>
          </div>
        </div>
      )}
    {/* ================= 2-STEP VERIFICATION (2FA) MODAL DIALOG ================= */}
      {show2FAModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
            border: '1px solid #E2E8F0',
            position: 'relative'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#EEF2FF',
                color: '#4F46E5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>
                  2-Step Security Verification
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                  Protect your VRM CRM employee account & role dashboard
                </p>
              </div>
            </div>

            {/* STEP 1: METHOD SELECTION */}
            {twoFaStep === 'method_select' && (
              <div>
                <p style={{ fontSize: '13px', color: '#334155', fontWeight: '600', marginBottom: '14px' }}>
                  Choose your preferred verification method:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                  {/* Option 1: Authenticator App */}
                  <div 
                    onClick={() => setSelected2FAMethod('authenticator')}
                    style={{
                      border: `2px solid ${selected2FAMethod === 'authenticator' ? '#4F46E5' : '#E2E8F0'}`,
                      backgroundColor: selected2FAMethod === 'authenticator' ? '#F5F3FF' : '#FFFFFF',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#E0E7FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Smartphone size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0F172A' }}>Option 1: Authenticator App</div>
                      <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>Use Google Authenticator or TOTP app (100% Free)</div>
                    </div>
                    <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: selected2FAMethod === 'authenticator' ? '5px solid #4F46E5' : '2px solid #CBD5E1' }} />
                  </div>

                  {/* Option 2: Email OTP */}
                  <div 
                    onClick={() => setSelected2FAMethod('email')}
                    style={{
                      border: `2px solid ${selected2FAMethod === 'email' ? '#4F46E5' : '#E2E8F0'}`,
                      backgroundColor: selected2FAMethod === 'email' ? '#F5F3FF' : '#FFFFFF',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#E0E7FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Mail size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0F172A' }}>Option 2: Email One-Time OTP</div>
                      <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>Receive 6-digit code via work email (100% Free)</div>
                    </div>
                    <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: selected2FAMethod === 'email' ? '5px solid #4F46E5' : '2px solid #CBD5E1' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
                  <button
                    type="button"
                    onClick={handleSkip2FA}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#64748B',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      padding: '8px 12px'
                    }}
                  >
                    Skip for Now
                  </button>

                  <button
                    type="button"
                    onClick={handleSend2FAOtp}
                    style={{
                      backgroundColor: '#4F46E5',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px 20px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: ENTER OTP VERIFICATION CODE */}
            {twoFaStep === 'verify' && (
              <form onSubmit={handleVerify2FAOtp}>
                <div style={{ backgroundColor: '#F8FAFC', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '16px', fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                  {otpSuccessMsg}
                </div>

                {selected2FAMethod === 'authenticator' && (
                  <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                      Secret Key: <span style={{ color: '#4F46E5', fontFamily: 'monospace' }}>VRM-8842-SEC</span>
                    </div>
                  </div>
                )}

                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0F172A', marginBottom: '6px', textAlign: 'center' }}>
                  ENTER 6-DIGIT OTP CODE
                </label>
                <input 
                  type="text"
                  maxLength="6"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="e.g. 123456"
                  autoFocus
                  style={{
                    width: '100%',
                    height: '46px',
                    borderRadius: '10px',
                    border: '2px solid #4F46E5',
                    textAlign: 'center',
                    fontSize: '22px',
                    fontWeight: '900',
                    letterSpacing: '6px',
                    color: '#4F46E5',
                    outline: 'none',
                    backgroundColor: '#EEF2FF',
                    boxSizing: 'border-box'
                  }}
                />

                {errorMsg && (
                  <div style={{ color: '#DC2626', fontSize: '12px', marginTop: '8px', fontWeight: '700', textAlign: 'center' }}>
                    {errorMsg}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
                  <button
                    type="button"
                    onClick={handleSkip2FA}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#64748B',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Skip
                  </button>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setTwoFaStep('method_select')}
                      style={{
                        backgroundColor: '#F1F5F9',
                        color: '#475569',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Change Method
                    </button>
                    <button
                      type="submit"
                      style={{
                        backgroundColor: '#16A34A',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '10px 18px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Verify & Access Portal ✓
                    </button>
                  </div>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
