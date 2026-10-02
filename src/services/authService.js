import { USER_ROLES_CONFIG } from '../components/LoginScreen';
import { fetchCloudStore, saveCloudStore } from '../utils/supabaseDataSync';
import { registerActiveSession, revokeSession } from './sessionService';

/**
 * ControlRoom Authentication & Login Service
 * Dedicated module for handling authentication, credential matching, session persistence, and role resolution.
 */

// Synchronous cached memory copy & async cloud fetch
export const syncEmployeesFromCloud = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch('/api/store/employees_store', { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);
    if (res && res.ok) {
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data)) {
        localStorage.setItem('controlroom_employees_list', JSON.stringify(json.data));
        const registeredCodes = json.data.map(e => (e.employee_code || e.code)).filter(Boolean);
        localStorage.setItem('controlroom_registered_codes', JSON.stringify(registeredCodes));
        return json.data;
      }
    }
  } catch (_) {}

  try {
    const list = await fetchCloudStore('employees_store', []);
    if (Array.isArray(list)) {
      localStorage.setItem('controlroom_employees_list', JSON.stringify(list));
      const registeredCodes = list.map(e => (e.employee_code || e.code)).filter(Boolean);
      localStorage.setItem('controlroom_registered_codes', JSON.stringify(registeredCodes));
      return list;
    }
  } catch(e) {}

  return JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
};

export const authenticateUser = (empId, username, password, selectedRoleObj = null) => {
  const cleanEmpId = String(empId || '').trim();
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanPassword = String(password || '');

  if (!cleanEmpId && !cleanUsername) {
    return { success: false, error: 'Please enter your Employee Code or Email.' };
  }

  if (!cleanPassword) {
    return { success: false, error: 'Please enter your password.' };
  }

  const normalizeCode = (c) => String(c || '').trim().toUpperCase().replace(/O/g, '0').replace(/[-_\s]/g, '');
  const cleanEmpCodeNorm = normalizeCode(cleanEmpId);

  // 1. Find account strictly from registered employee accounts store
  let accountRecord = null;
  
  try {
    let existingEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
    let modified = false;

    // Zero hardcoded accounts - system relies purely on registered employee accounts
    accountRecord = existingEmps.find(e => {
      const empNorm = normalizeCode(e.employee_code || e.code);
      const codeMatches = cleanEmpCodeNorm && (
        empNorm === cleanEmpCodeNorm ||
        empNorm.includes(cleanEmpCodeNorm) ||
        cleanEmpCodeNorm.includes(empNorm)
      );
      const emailMatches = cleanUsername && (e.email || '').toLowerCase() === cleanUsername;
      return codeMatches || emailMatches;
    });
  } catch(e) {}

  if (!accountRecord) {
    return { 
      success: false, 
      error: `Account Not Found: No registered employee account exists matching "${cleanEmpId || cleanUsername}". Please click "Sign up" below to register your account.` 
    };
  }

  // 2. Validate Password strictly against account password
  if (accountRecord.password) {
    const isPassValid = cleanPassword === accountRecord.password;
    if (!isPassValid) {
      return { success: false, error: 'Incorrect Password: The password you entered is invalid. Please try again.' };
    }
  }

  const finalRoleName = accountRecord.role;
  const finalDisplayName = accountRecord.employee_name || cleanUsername;

  // Developer / Technical Administrator accounts (TA-VRM###) bypass access approval requirements
  const isDeveloper = finalRoleName === 'Technical Administrator' || cleanEmpCodeNorm.startsWith('TA');

  // Developer, Executive and Core Department Heads bypass access approval requirements
  const isCoreOrLeadership = isDeveloper || 
    finalRoleName === 'Procurement Head' || 
    finalRoleName === 'Production Head' || 
    finalRoleName === 'CEO' || 
    cleanEmpCodeNorm.startsWith('PR') || 
    cleanUsername === 'maniskremo@gmail.com' ||
    cleanUsername === 'scm@vrmstructures.in';

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
  try {
    localStorage.setItem('controlroom_is_authenticated', 'true');
    localStorage.setItem('controlroom_user_role', finalRoleName);
    localStorage.setItem('controlroom_logged_emp_id', cleanEmpId);
    localStorage.setItem('controlroom_logged_user', cleanUsername);
    localStorage.setItem('controlroom_logged_user_name', finalDisplayName);

    // Register active device session in cloud database
    registerActiveSession(cleanUsername, cleanEmpId, finalDisplayName, finalRoleName);
  } catch (e) {
    console.error('Error saving login session to localStorage:', e);
  }

  return {
    success: true,
    userRole: finalRoleName,
    displayName: finalDisplayName,
    username: cleanUsername,
    matchedRole: accountRecord
  };
};

export const logoutUser = () => {
  try {
    const sesId = localStorage.getItem('controlroom_device_session_id');
    if (sesId) {
      revokeSession(sesId);
    }
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
