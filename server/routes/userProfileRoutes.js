import { Router } from 'express';
import fs from 'fs';
import { getStoreFilePath } from '../runtimePaths.js';

export default function createUserProfileRouter(dependencies) {
  const router = Router();
  const {
    requireBusinzSession,
    broadcastRealtimeEvent,
    query,
    isDbConnected,
    getDatabaseStore,
    saveDatabaseStore,
    safeWriteJsonFileAsync,
    activeSessionsMap,
    supabaseMemoryStore
  } = dependencies;

  // GET /api/user/profile - Fetch current authenticated user's profile from database
  router.get('/api/user/profile', requireBusinzSession, async (req, res) => {
    try {
      const session = req.userSession;
      const empCode = String(session.empCode || '').trim();
      const sessionEmail = String(session.email || '').trim().toLowerCase();

      let employees = [];
      try {
        const data = await getDatabaseStore('employees_store');
        if (Array.isArray(data)) employees = data;
      } catch (_) {}

      const matched = employees.find(e => {
        const c = String(e.employee_code || e.code || '').trim().toUpperCase();
        const m = String(e.email || '').trim().toLowerCase();
        return (empCode && c === empCode.toUpperCase()) || (sessionEmail && m === sessionEmail);
      });

      return res.json({
        success: true,
        user: {
          name: matched?.employee_name || matched?.name || session.user || 'User',
          email: matched?.email || session.email || '',
          phone: matched?.phone || matched?.contact || matched?.mobile || '',
          empCode: matched?.employee_code || session.empCode || '',
          role: matched?.role || session.role || 'Employee',
          department: matched?.department || 'Operations'
        }
      });
    } catch (err) {
      console.error('[GET /api/user/profile Error]:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/user/profile - Update user profile across database, sessions, and BOMs
  router.post('/api/user/profile', requireBusinzSession, async (req, res) => {
    try {
      const session = req.userSession;
      const { name, email, phone } = req.body || {};

      const cleanName = String(name || '').trim();
      if (!cleanName) {
        return res.status(400).json({ success: false, error: 'Full name cannot be empty.' });
      }

      const empCode = String(session.empCode || '').trim();
      const oldName = String(session.user || '').trim();
      const cleanEmail = String(email || session.email || '').trim();
      const cleanPhone = String(phone || '').trim();

      // 1. Update in-memory active session map & active_sessions.json
      if (activeSessionsMap) {
        for (const [, s] of activeSessionsMap.entries()) {
          const sEmp = String(s.empCode || s.employee_code || '').trim().toUpperCase();
          const sMail = String(s.email || '').trim().toLowerCase();
          if ((empCode && sEmp === empCode.toUpperCase()) || (cleanEmail && sMail === cleanEmail.toLowerCase())) {
            s.user = cleanName;
            if (cleanEmail) s.email = cleanEmail;
            if (cleanPhone) s.phone = cleanPhone;
          }
        }
        try {
          const sessionList = Array.from(activeSessionsMap.values());
          await safeWriteJsonFileAsync(getStoreFilePath('active_sessions.json'), sessionList);
        } catch (_) {}
      }

      // 2. Update employees_store in database and disk
      try {
        let employees = await getDatabaseStore('employees_store');
        if (Array.isArray(employees)) {
          let updatedAny = false;
          employees = employees.map(e => {
            const c = String(e.employee_code || e.code || '').trim().toUpperCase();
            const m = String(e.email || '').trim().toLowerCase();
            if ((empCode && c === empCode.toUpperCase()) || (cleanEmail && m === cleanEmail.toLowerCase())) {
              updatedAny = true;
              return {
                ...e,
                employee_name: cleanName,
                name: cleanName,
                ...(cleanEmail ? { email: cleanEmail } : {}),
                ...(cleanPhone ? { phone: cleanPhone } : {})
              };
            }
            return e;
          });

          if (updatedAny) {
            await saveDatabaseStore('employees_store', employees);
            await safeWriteJsonFileAsync(getStoreFilePath('employees_store.json'), employees);
          }
        }
      } catch (empErr) {
        console.warn('[Profile Update] employees_store sync notice:', empErr.message);
      }

      // 3. Update public.users in PostgreSQL if table exists
      if (isDbConnected()) {
        try {
          await query(
            `UPDATE public.users 
             SET name = $1, email = COALESCE(NULLIF($2, ''), email) 
             WHERE LOWER(email) = LOWER($3) OR LOWER(role) = LOWER($4)`,
            [cleanName, cleanEmail, session.email || '', session.role || '']
          );
        } catch (dbErr) {
          console.warn('[Profile Update] public.users notice:', dbErr.message);
        }
      }

      // 4. Update BOM Orders in Database & Disk Store where this user was creator or actor
      let bomsUpdatedCount = 0;
      if (isDbConnected()) {
        try {
          // Update BOMs created by this user
          const updateCreatedRes = await query(
            `UPDATE public.bom_orders 
             SET created_by = $1, updated_at = NOW() 
             WHERE (created_by_id IS NOT NULL AND LOWER(created_by_id) = LOWER($2)) 
                OR (created_by IS NOT NULL AND LOWER(created_by) = LOWER($3))`,
            [cleanName, empCode, oldName]
          );
          bomsUpdatedCount += (updateCreatedRes?.rowCount || 0);

          // Update BOMs where this user is salesperson
          if (empCode && empCode.toUpperCase().startsWith('SE')) {
            const updateSalesRes = await query(
              `UPDATE public.bom_orders 
               SET sales_person = $1, updated_at = NOW() 
               WHERE sales_person_code IS NOT NULL AND LOWER(sales_person_code) = LOWER($2)`,
              [cleanName, empCode]
            );
            bomsUpdatedCount += (updateSalesRes?.rowCount || 0);
          }
        } catch (bomDbErr) {
          console.warn('[Profile Update] public.bom_orders sync notice:', bomDbErr.message);
        }
      }

      // 5. Update BOMs in-memory memory store and disk store
      try {
        const bomDiskPath = getStoreFilePath('bom_store.json');
        let currentBoms = supabaseMemoryStore?.bom_store;
        if (!Array.isArray(currentBoms) && fs.existsSync(bomDiskPath)) {
          try { currentBoms = JSON.parse(fs.readFileSync(bomDiskPath, 'utf8')); } catch (_) {}
        }

        if (Array.isArray(currentBoms) && currentBoms.length > 0) {
          let bomsModified = false;
          const updatedBoms = currentBoms.map(b => {
            const bCreatorCode = String(b.createdById || b.created_by_id || '').trim().toLowerCase();
            const bCreatorName = String(b.createdBy || b.created_by || '').trim().toLowerCase();
            const bSalesCode = String(b.salesPersonCode || b.sales_person_code || '').trim().toLowerCase();
            const bSalesName = String(b.salesPerson || b.sales_person || '').trim().toLowerCase();

            let matched = false;
            let nextB = { ...b };

            if ((empCode && bCreatorCode === empCode.toLowerCase()) || (oldName && bCreatorName === oldName.toLowerCase())) {
              nextB.createdBy = cleanName;
              nextB.created_by = cleanName;
              bomsModified = true;
              matched = true;
            }

            if ((empCode && bSalesCode === empCode.toLowerCase()) || (oldName && bSalesName === oldName.toLowerCase())) {
              nextB.salesPerson = cleanName;
              nextB.sales_person = cleanName;
              bomsModified = true;
              matched = true;
            }

            return matched ? nextB : b;
          });

          if (bomsModified) {
            supabaseMemoryStore.bom_store = updatedBoms;
            await safeWriteJsonFileAsync(bomDiskPath, updatedBoms);
            try {
              await saveDatabaseStore('bom_store', updatedBoms);
            } catch (_) {}
          }
        }
      } catch (bStoreErr) {
        console.warn('[Profile Update] bom_store json notice:', bStoreErr.message);
      }

      // 6. Update Proforma Invoices in database, memory, and disk store
      let pisUpdatedCount = 0;
      if (isDbConnected()) {
        try {
          const updatePiRes = await query(
            `UPDATE public.proforma_invoices 
             SET sales_person = $1, created_by = $1, updated_at = NOW() 
             WHERE (created_by_id IS NOT NULL AND LOWER(created_by_id) = LOWER($2)) 
                OR (sales_person_code IS NOT NULL AND LOWER(sales_person_code) = LOWER($2))
                OR (created_by IS NOT NULL AND LOWER(created_by) = LOWER($3))
                OR (sales_person IS NOT NULL AND LOWER(sales_person) = LOWER($3))`,
            [cleanName, empCode, oldName]
          );
          pisUpdatedCount += (updatePiRes?.rowCount || 0);
        } catch (piDbErr) {
          console.warn('[Profile Update] public.proforma_invoices notice:', piDbErr.message);
        }
      }

      for (const storeKey of ['sales_pi_store', 'proforma_invoice_store']) {
        try {
          const piDiskPath = getStoreFilePath(`${storeKey}.json`);
          let currentPis = supabaseMemoryStore?.[storeKey];
          if (!Array.isArray(currentPis) && fs.existsSync(piDiskPath)) {
            try { currentPis = JSON.parse(fs.readFileSync(piDiskPath, 'utf8')); } catch (_) {}
          }

          if (Array.isArray(currentPis) && currentPis.length > 0) {
            let pisModified = false;
            const updatedPis = currentPis.map(p => {
              if (!p) return p;
              const pCreatorCode = String(p.createdById || p.created_by_id || '').trim().toLowerCase();
              const pCreatorName = String(p.createdBy || p.created_by || '').trim().toLowerCase();
              const pSalesCode = String(p.salesPersonCode || p.sales_person_code || p.salesperson_code || '').trim().toLowerCase();
              const pSalesName = String(p.salesPerson || p.salesperson || p.sales_person || '').trim().toLowerCase();

              let matched = false;
              let nextP = { ...p };

              if ((empCode && pCreatorCode === empCode.toLowerCase()) || (oldName && pCreatorName === oldName.toLowerCase())) {
                nextP.createdBy = cleanName;
                nextP.created_by = cleanName;
                pisModified = true;
                matched = true;
              }

              if ((empCode && pSalesCode === empCode.toLowerCase()) || (oldName && pSalesName === oldName.toLowerCase())) {
                nextP.salesPerson = cleanName;
                nextP.salesperson = cleanName;
                nextP.sales_person = cleanName;
                pisModified = true;
                matched = true;
              }

              return matched ? nextP : p;
            });

            if (pisModified) {
              supabaseMemoryStore[storeKey] = updatedPis;
              await safeWriteJsonFileAsync(piDiskPath, updatedPis);
              try {
                await saveDatabaseStore(storeKey, updatedPis);
              } catch (_) {}
            }
          }
        } catch (pStoreErr) {
          console.warn(`[Profile Update] ${storeKey} notice:`, pStoreErr.message);
        }
      }

      // 7. Broadcast Realtime Updates to all clients & browser sessions
      try {
        broadcastRealtimeEvent('user_profile_updated', {
          employee_code: empCode,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          updatedAt: new Date().toISOString()
        });

        broadcastRealtimeEvent('bom_updated', {
          action: 'profile_name_changed',
          employee_code: empCode,
          newName: cleanName,
          bomsUpdated: bomsUpdatedCount
        });

        broadcastRealtimeEvent('pi_updated', {
          action: 'profile_name_changed',
          employee_code: empCode,
          newName: cleanName,
          pisUpdated: pisUpdatedCount
        });
      } catch (_) {}

      return res.json({
        success: true,
        message: 'Profile and associated BOM records successfully updated in database and live server!',
        bomsUpdated: bomsUpdatedCount,
        user: {
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          empCode: session.empCode || empCode,
          role: session.role || 'Employee'
        }
      });
    } catch (err) {
      console.error('[POST /api/user/profile Error]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
