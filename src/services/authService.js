import { USER_ROLES_CONFIG } from '../components/LoginScreen';
import { fetchCloudStore, saveCloudStore } from '../utils/supabaseDataSync';
import { registerActiveSession, revokeSession } from './sessionService';
import { clearCustomerCacheOnLogout } from './customerService';

/**
 * ControlRoom Authentication & Login Service
 * Dedicated module for handling authentication, credential matching, session persistence, and role resolution.
 */

// Hardcoded operational employee credentials eliminated (Phase 8D).
// All identities and credentials must be provisioned through secure, database-backed storage.
export const DEFAULT_CORE_EMPLOYEES = [];

const mergeWithCoreEmployees = (incomingList = []) => {
  const normalize = (c) => String(c || '').trim().toUpperCase().replace(/O/g, '0').replace(/[-_\s]/g, '');
  const empMap = new Map();
  if (Array.isArray(incomingList)) {
    incomingList.forEach(e => {
      if (!e) return;
      const code = normalize(e.employee_code || e.code);
      const email = String(e.email || '').trim().toLowerCase();
      if (code) {
        empMap.set(code, { ...(empMap.get(code) || {}), ...e });
      } else if (email) {
        empMap.set(email, e);
      }
    });
  }
  return Array.from(empMap.values());
};

// Synchronous cached memory copy & async cloud fetch
export const syncEmployeesFromCloud = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch('/api/store/employees_store', { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);
    if (res && res.ok) {
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
        // Authoritative: Server database overwrites local cache directly
        const merged = mergeWithCoreEmployees(json.data);
        localStorage.setItem('controlroom_employees_list', JSON.stringify(merged));
        const registeredCodes = merged.map(e => (e.employee_code || e.code)).filter(Boolean);
        localStorage.setItem('controlroom_registered_codes', JSON.stringify(registeredCodes));
        return merged;
      }
    }
  } catch (_) {}

  try {
    const list = await fetchCloudStore('employees_store', []);
    if (Array.isArray(list) && list.length > 0) {
      const merged = mergeWithCoreEmployees(list);
      localStorage.setItem('controlroom_employees_list', JSON.stringify(merged));
      const registeredCodes = merged.map(e => (e.employee_code || e.code)).filter(Boolean);
      localStorage.setItem('controlroom_registered_codes', JSON.stringify(registeredCodes));
      return merged;
    }
  } catch(e) {}

  const currentLocal = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
  const merged = mergeWithCoreEmployees(currentLocal);
  localStorage.setItem('controlroom_employees_list', JSON.stringify(merged));
  return merged;
};

export const normalizeDepartmentRole = (role) => {
  if (!role) return 'Sales';
  const r = String(role).trim();
  const lower = r.toLowerCase();
  if (lower === 'sales' || lower.includes('sales')) return 'Sales';
  if (lower === 'dispatch' || lower.includes('dispatch')) return 'Dispatch';
  if (lower === 'production' || lower.includes('production') || lower.includes('floor')) return 'Production';
  if (lower === 'procurement' || lower.includes('procurement') || lower.includes('purchase')) return 'Procurement';
  if (lower === 'accounts' || lower.includes('account') || lower.includes('finance')) return 'Accounts';
  if (lower === 'billing' || lower.includes('billing') || lower.includes('invoice')) return 'Billing';
  if (lower === 'design' || lower.includes('design')) return 'Design';
  if (lower === 'tech support' || lower.includes('technical support')) return 'Tech Support';
  if (lower === 'ceo' || lower === 'md' || lower.includes('managing director')) return 'CEO';
  if (lower.includes('technical admin') || lower.includes('developer') || lower.startsWith('ta')) return 'Technical Administrator';
  return r;
};

export const authenticateUser = (empId, username, password, selectedRoleObj = null) => {
  const cleanEmpId = String(empId || '').trim();
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanPassword = String(password || '');

  // Accept single identifier (EMP ID or Email ID) or both
  const identifier = cleanEmpId || cleanUsername;

  if (!identifier) {
    return { success: false, error: 'Please enter your EMP ID or Email ID.' };
  }

  if (!cleanPassword) {
    return { success: false, error: 'Please enter your password.' };
  }

  const normalizeCode = (c) => String(c || '').trim().toUpperCase().replace(/O/g, '0').replace(/[-_\s]/g, '');
  const cleanEmpCodeNorm = normalizeCode(cleanEmpId);
  const identifierNorm = normalizeCode(identifier);
  const identifierLower = identifier.toLowerCase();

  // 1. Find account strictly from registered employee accounts store (merged with core)
  let accountRecord = null;
  
  try {
    const currentLocal = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
    const existingEmps = mergeWithCoreEmployees(currentLocal);

    // If both distinct code and email were provided, check matching both
    if (cleanEmpId && cleanUsername && cleanEmpId.toLowerCase() !== cleanUsername) {
      accountRecord = existingEmps.find(e => {
        const empNorm = normalizeCode(e.employee_code || e.code);
        const emailMatches = String(e.email || '').trim().toLowerCase() === cleanUsername;
        return empNorm === cleanEmpCodeNorm && emailMatches;
      });
    }

    // Check by Email ID
    if (!accountRecord) {
      accountRecord = existingEmps.find(e => String(e.email || '').trim().toLowerCase() === identifierLower);
    }

    // Check by EMP ID / Code
    if (!accountRecord) {
      accountRecord = existingEmps.find(e => normalizeCode(e.employee_code || e.code) === identifierNorm);
    }

    // Fallback: Check if either matches
    if (!accountRecord) {
      accountRecord = existingEmps.find(e => {
        const empNorm = normalizeCode(e.employee_code || e.code);
        const emailMatches = String(e.email || '').trim().toLowerCase() === identifierLower;
        return (identifierNorm && empNorm === identifierNorm) || emailMatches;
      });
    }
  } catch(e) {}

  if (!accountRecord) {
    return { 
      success: false, 
      error: `Account Not Found: No registered employee account exists matching "${identifier}". Please check your EMP ID / Email ID or register your account.` 
    };
  }

  // 2. Validate Password strictly against account password verifier
  // Accounts with missing, null, or empty password verifiers fail authentication unconditionally
  if (!accountRecord.password || typeof accountRecord.password !== 'string' || accountRecord.password.trim().length === 0) {
    return {
      success: false,
      error: 'Account Configuration Error: No valid password verifier found for this account. Please contact your Technical Administrator.'
    };
  }

  const isPassValid = cleanPassword === accountRecord.password;
  if (!isPassValid) {
    return { success: false, error: 'Incorrect Password: The password you entered is invalid. Please try again.' };
  }

  const rawRoleName = accountRecord.role;
  const finalRoleName = normalizeDepartmentRole(rawRoleName);
  let finalDisplayName = accountRecord.employee_name || cleanUsername;
  if (!accountRecord.employee_name && cleanUsername.includes('@')) {
    const emailPrefix = cleanUsername.split('@')[0].replace(/[._-]/g, ' ');
    finalDisplayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  }

  // Developer / Technical Administrator accounts (TA-VRM###) bypass access approval requirements
  const isDeveloper = finalRoleName === 'Technical Administrator' || cleanEmpCodeNorm.startsWith('TA');

  // Developer, Executive and Core Department accounts bypass access approval requirements
  const isCoreOrLeadership = isDeveloper || 
    finalRoleName === 'Procurement' || 
    finalRoleName === 'Production' || 
    finalRoleName === 'Dispatch' || 
    finalRoleName === 'Sales' || 
    finalRoleName === 'Accounts' || 
    finalRoleName === 'Billing' || 
    finalRoleName === 'Design' || 
    finalRoleName === 'Tech Support' || 
    finalRoleName === 'CEO' || 
    finalRoleName === 'Procurement Head' || 
    finalRoleName === 'Production Head' || 
    finalRoleName === 'Dispatch Head' || 
    finalRoleName === 'Sales Head' || 
    cleanEmpCodeNorm.startsWith('PR') || 
    cleanEmpCodeNorm.startsWith('DH') || 
    cleanEmpCodeNorm.startsWith('SH') || 
    cleanEmpCodeNorm.startsWith('SE') || 
    cleanEmpCodeNorm.startsWith('PH') || 
    cleanEmpCodeNorm.startsWith('AH') || 
    cleanEmpCodeNorm.startsWith('AE') || 
    cleanUsername === 'maniskremo@gmail.com' ||
    cleanUsername === 'scm@vrmstructures.in' ||
    cleanUsername === 'dispatch@vrmstructures.in' ||
    cleanUsername === 'sales@vrm.com' ||
    cleanUsername === 'vijay@vrmstructures.in';

  // Check stored employee status list for access permission
  try {
    const existingEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
    const storedEmp = existingEmps.find(e => (e.employee_code || '').toUpperCase() === upperCode || (e.email || '').toLowerCase() === cleanUsername);

    if (storedEmp && !isCoreOrLeadership) {
      if (storedEmp.status === 'Pending Approval') {
        return {
          success: false,
          error: 'Access Pending: Your account registration request has been submitted. Please wait for Developer / Technical Administrator approval to access your dashboard.'
        };
      }
      if (storedEmp.status === 'Disabled' || storedEmp.status === 'Rejected') {
        return {
          success: false,
          error: 'Access Revoked: Your account access has been disabled by the Technical Administrator.'
        };
      }
    }
  } catch(e) {}

  // Persist session to localStorage
  const finalEmpId = accountRecord.employee_code || accountRecord.code || cleanEmpId || identifier;
  const finalUsername = accountRecord.email || cleanUsername || identifier;

  try {
    localStorage.setItem('controlroom_is_authenticated', 'true');
    localStorage.setItem('controlroom_user_role', finalRoleName);
    localStorage.setItem('controlroom_logged_emp_id', finalEmpId);
    localStorage.setItem('controlroom_logged_user', finalUsername);
    localStorage.setItem('controlroom_logged_user_name', finalDisplayName);

    // Register active device session in cloud database with verified credentials
    registerActiveSession(finalUsername, finalEmpId, finalDisplayName, finalRoleName, cleanPassword);
  } catch (e) {
    console.error('Error saving login session to localStorage:', e);
  }

  return {
    success: true,
    userRole: finalRoleName,
    displayName: finalDisplayName,
    username: finalUsername,
    empCode: finalEmpId,
    matchedRole: accountRecord
  };
};

export const logoutUser = () => {
  try {
    const sesId = localStorage.getItem('controlroom_device_session_id');
    if (sesId) {
      revokeSession(sesId);
    }
    clearCustomerCacheOnLogout();
    localStorage.removeItem('controlroom_is_authenticated');
    localStorage.removeItem('controlroom_user_role');
    localStorage.removeItem('controlroom_logged_user');
    localStorage.removeItem('controlroom_logged_user_name');
    localStorage.removeItem('controlroom_device_session_id');
    localStorage.removeItem('controlroom_session_start_time');
  } catch (e) {
    console.error('Error removing login session:', e);
  }
};

export const getCurrentSession = () => {
  try {
    const isAuthenticated = localStorage.getItem('controlroom_is_authenticated') === 'true';
    const userRole = localStorage.getItem('controlroom_user_role') || 'Procurement Head';
    const loggedUser = localStorage.getItem('controlroom_logged_user') || '';
    const loggedUserName = localStorage.getItem('controlroom_logged_user_name') || '';

    return {
      isAuthenticated,
      userRole,
      loggedUser,
      loggedUserName
    };
  } catch (e) {
    return {
      isAuthenticated: false,
      userRole: 'Procurement Head',
      loggedUser: '',
      loggedUserName: ''
    };
  }
};
