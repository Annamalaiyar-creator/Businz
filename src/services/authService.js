import { USER_ROLES_CONFIG } from '../components/LoginScreen';
import { fetchCloudStore, saveCloudStore } from '../utils/supabaseDataSync';
import { registerActiveSession, revokeSession } from './sessionService';

/**
 * ControlRoom Authentication & Login Service
 * Dedicated module for handling authentication, credential matching, session persistence, and role resolution.
 */

export const DEFAULT_CORE_EMPLOYEES = [
  {
    employee_code: "TA-VRM001",
    employee_name: "Ar.Annamalaiyar",
    email: "arannamalaiyar@gmail.com",
    password: "Efx@1234",
    prefix: "TA",
    role: "Technical Administrator",
    dashboard_type: "Technical Administrator",
    status: "Active"
  },
  {
    employee_code: "SE-VRM001",
    employee_name: "Mohit JV",
    email: "sales.s4@vrmstructures.in",
    password: "vrm@2018",
    prefix: "SE",
    role: "Sales Executive",
    dashboard_type: "Sales Executive",
    status: "Active"
  },
  {
    employee_code: "PR-VRM001",
    employee_name: "Arun",
    email: "arun@vrmstructures.in",
    password: "arun2002",
    prefix: "PR",
    role: "Procurement Head",
    dashboard_type: "Procurement Head",
    status: "Active"
  },
  {
    employee_code: "PH-VRM001",
    employee_name: "Senthil Kumar",
    email: "production@vrm.com",
    password: "123456",
    prefix: "PH",
    role: "Production Head",
    dashboard_type: "Production Head",
    status: "Active"
  },
  {
    employee_code: "CEO-VRM001",
    employee_name: "Annamalaiyar",
    email: "ceo@vrm.com",
    password: "123456",
    prefix: "CEO",
    role: "CEO",
    dashboard_type: "CEO",
    status: "Active"
  },
  {
    employee_code: "SH-VRM002",
    employee_name: "Manojraj Selvaraj",
    email: "sales.s1@vrmstructures.in",
    password: "Miru@1103",
    prefix: "SH",
    role: "Sales Head",
    dashboard_type: "Sales Head",
    status: "Active"
  },
  {
    employee_code: "DH-VRM001",
    employee_name: "Manikandan",
    email: "dispatch@vrmstructures.in",
    password: "123456",
    prefix: "DH",
    role: "Dispatch Head",
    dashboard_type: "Dispatch Head",
    status: "Active"
  }
];

const mergeWithCoreEmployees = (incomingList = []) => {
  const normalize = (c) => String(c || '').trim().toUpperCase().replace(/O/g, '0').replace(/[-_\s]/g, '');
  const empMap = new Map();
  DEFAULT_CORE_EMPLOYEES.forEach(e => empMap.set(normalize(e.employee_code), e));
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
        const localEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
        const merged = mergeWithCoreEmployees([...localEmps, ...json.data]);
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
      const localEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      const merged = mergeWithCoreEmployees([...localEmps, ...list]);
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

  // 1. Find account strictly from registered employee accounts store (merged with core)
  let accountRecord = null;
  
  try {
    const currentLocal = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
    const existingEmps = mergeWithCoreEmployees(currentLocal);
    localStorage.setItem('controlroom_employees_list', JSON.stringify(existingEmps));

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
    finalRoleName === 'Dispatch Head' || 
    finalRoleName === 'CEO' || 
    cleanEmpCodeNorm.startsWith('PR') || 
    cleanEmpCodeNorm.startsWith('DH') || 
    cleanUsername === 'maniskremo@gmail.com' ||
    cleanUsername === 'scm@vrmstructures.in' ||
    cleanUsername === 'dispatch@vrmstructures.in';

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
