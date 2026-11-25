import { Router } from 'express';
import fs from 'fs';
import {
  getLeads as getDbLeads,
  getLeadDetail,
  createLead as createDbLead,
  updateLead as updateDbLead,
  assignLead as assignDbLead,
  recordLeadActivity,
  updateLeadStatus as updateDbLeadStatus,
  scheduleLeadFollowup,
  getNotificationsForEmployee,
  markNotificationRead,
  checkAndProcessLeadInactivity
} from '../leadManagementService.js';
import { getStoreFilePath, isMaintenanceModeActive } from '../runtimePaths.js';

export default function createCrmLeadsRouter(dependencies) {
  const router = Router();
  const {
    requireBusinzSession,
    getNotificationsForUser,
    markNotificationAsRead,
    broadcastRealtimeEvent,
    createInternalNotification,
    assignProformaInvoiceInDatabase,
    supabaseMemoryStore,
    pushStoreToSupabase,
    pool,
    getDatabaseStore,
    getVerifiedUserSession,
    isOptimizationTestMode
  } = dependencies;

  // ==========================================
  // 🚀 CENTRALIZED LEADS DATABASE REST API & AUDIT
  // ==========================================
  router.get(['/api/crm/leads', '/api/leads'], async (req, res) => {
    try {
      const userRole = req.headers['x-user-role'] || req.query.userRole || '';
      const userEmpId = req.headers['x-user-emp-id'] || req.query.userEmpId || '';
      const userName = req.headers['x-user-name'] || req.query.userName || '';
      const { search, status, source, assignedTo, unassignedOnly } = req.query;

      const leads = await getDbLeads({
        userRole,
        userEmpId,
        userName,
        search,
        status,
        source,
        assignedTo,
        unassignedOnly: unassignedOnly === 'true'
      });

      res.json({ success: true, count: leads.length, data: leads });
    } catch (err) {
      console.error('[GET /api/crm/leads error]:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Lead Notifications Endpoint for Sales & CRM Users
  router.get('/api/crm/leads/notifications', requireBusinzSession, async (req, res) => {
    try {
      const empCode = req.userSession?.empCode || req.query.employeeCode || req.query.empCode || req.query.userId || '';
      const role = req.userSession?.role || 'Sales Executive';

      console.log(`[Leads Notif Route] Query params -> empCode: "${empCode}", role: "${role}"`);
      const result = await getNotificationsForUser({ empCode, role, limit: 50 });
      console.log(`[Leads Notif Route] Found ${result?.notifications?.length || 0} notifications for empCode: "${empCode}", role: "${role}"`);
      const notifs = (result.notifications || []).map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        created_at: n.created_at,
        read: Boolean(n.is_read),
        type: n.event_type || 'lead_assigned',
        leadId: n.document_id,
        metadata: n.metadata
      }));

      res.json({ success: true, count: notifs.length, unreadCount: result.unreadCount, notifications: notifs, data: notifs });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/api/crm/leads/notifications/:id/read', async (req, res) => {
    try {
      const empCode = req.query.employeeCode || req.headers['x-user-emp-id'] || req.headers['x-employee-code'] || '';
      await markNotificationAsRead({ notificationId: req.params.id, empCode });
      res.json({ success: true, message: 'Notification marked as read' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get(['/api/crm/leads/:id', '/api/leads/:id'], async (req, res) => {
    try {
      const { id } = req.params;
      const detail = await getLeadDetail(id);
      if (!detail) {
        return res.status(404).json({ success: false, error: 'Lead not found' });
      }
      res.json({ success: true, data: detail, lead: detail });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post(['/api/crm/leads', '/api/leads'], async (req, res) => {
    try {
      const leadData = (req.body && req.body.lead) ? req.body.lead : req.body;
      if (!leadData || Object.keys(leadData).length === 0) {
        return res.status(400).json({ success: false, error: 'No lead data provided' });
      }

      const creatorUser = {
        employee_code: req.headers['x-user-emp-id'] || req.body.creatorEmpId || 'USER',
        employee_name: req.headers['x-user-name'] || req.body.creatorName || 'Employee',
        role: req.headers['x-user-role'] || req.body.creatorRole || 'Sales Executive'
      };

      const userRoleLower = (creatorUser.role || '').toLowerCase();
      const isCeo = ['ceo', 'md', 'managing director'].some(r => userRoleLower.includes(r));
      const isTechSupport = ['tech support', 'technical support', 'technical administrator', 'technical admin', 'developer', 'admin'].some(r => userRoleLower.includes(r));
      const isSalesPerson = userRoleLower.includes('sales');

      if (isSalesPerson && !isCeo && !isTechSupport) {
        return res.status(403).json({
          success: false,
          error: 'Access Denied: Only Tech Support and CEO/MD are authorized to create leads.'
        });
      }

      const createdLead = await createDbLead(leadData, creatorUser);
      broadcastRealtimeEvent('crm_lead_created', { lead: createdLead });

      // If lead was assigned upon creation, trigger immediate real-time notification to salesperson
      if (createdLead?.assigned_to_user_id && !createdLead?._notificationDispatched) {
        try {
          await createInternalNotification({
            recipientEmpCode: createdLead.assigned_to_user_id,
            recipientRole: null, // Strictly target the assigned employee code only
            eventType: 'LEAD_ASSIGNED',
            documentType: 'lead',
            documentId: createdLead.id,
            title: `🎯 New Lead Assigned: ${createdLead.company_name || 'Prospect'}`,
            message: `Lead #${createdLead.lead_number || createdLead.id} (${createdLead.company_name}) has been assigned to you by ${creatorUser.employee_name || 'Management'}.`,
            actorEmpCode: creatorUser.employee_code,
            actorName: creatorUser.employee_name || 'Management',
            actorRole: creatorUser.role || 'CEO',
            targetTab: 'Leads',
            targetRecordId: createdLead.id,
            dedupId: `lead_assigned_${createdLead.id}_${createdLead.assigned_to_user_id}_${Date.now()}`
          });
        } catch (notifErr) {
          console.warn('[Lead Creation Notification Notice]:', notifErr.message);
        }
      }

      res.json({ success: true, message: 'Lead created successfully', lead: createdLead, data: createdLead });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Update Existing Lead
  router.put(['/api/crm/leads/:id', '/api/leads/:id'], requireBusinzSession, async (req, res) => {
    try {
      const { id } = req.params;
      const leadData = (req.body && req.body.lead) ? req.body.lead : req.body;
      if (!leadData || Object.keys(leadData).length === 0) {
        return res.status(400).json({ success: false, error: 'No update data provided' });
      }

      const updated = await updateDbLead(id, leadData);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Lead not found' });
      }

      broadcastRealtimeEvent('crm_lead_updated', { lead: updated });
      res.json({ success: true, message: 'Lead updated successfully', lead: updated, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Centralized Lead Assignment (Only CEO & Tech Support)
  router.post(['/api/crm/leads/:id/assign', '/api/leads/:id/assign'], requireBusinzSession, async (req, res) => {
    try {
      const { id } = req.params;
      const { assignedToId, assignedToName, assignedToRole, reason } = req.body;

      if (!assignedToId || !assignedToName) {
        return res.status(400).json({ success: false, error: 'Target assignee employee ID and Name are required.' });
      }

      const assignerUser = {
        employee_code: req.headers['x-user-emp-id'] || req.body.assignerEmpId,
        employee_name: req.headers['x-user-name'] || req.body.assignerName,
        role: req.headers['x-user-role'] || req.body.assignerRole
      };

      const updated = await assignDbLead({
        leadId: id,
        assignedToId,
        assignedToName,
        assignedToRole: assignedToRole || 'Sales Executive',
        assignerUser,
        reason: reason || 'Direct assignment from CRM'
      });

      // Also persist assignment to server/crm_leads.json and memory cache
      try {
        const diskPath = getStoreFilePath('crm_leads.json');
        if (fs.existsSync(diskPath)) {
          let leads = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
          leads = leads.map(l => (l.id === id || l.lead_number === id) ? {
            ...l,
            assigned_to_user_id: assignedToId,
            assigned_to_name: assignedToName,
            assigned_to_role: assignedToRole || 'Sales Executive',
            assigned_salesperson: assignedToName,
            status: (l.status === 'New' || l.status === 'Unassigned' || !l.status) ? 'Assigned' : l.status,
            updated_at: new Date().toISOString()
          } : l);
          fs.writeFileSync(diskPath, JSON.stringify(leads, null, 2), 'utf8');
        }
        if (supabaseMemoryStore.crm_leads && Array.isArray(supabaseMemoryStore.crm_leads)) {
          supabaseMemoryStore.crm_leads = supabaseMemoryStore.crm_leads.map(l => (l.id === id || l.lead_number === id) ? {
            ...l,
            assigned_to_user_id: assignedToId,
            assigned_to_name: assignedToName,
            assigned_to_role: assignedToRole || 'Sales Executive',
            assigned_salesperson: assignedToName,
            status: (l.status === 'New' || l.status === 'Unassigned' || !l.status) ? 'Assigned' : l.status,
            updated_at: new Date().toISOString()
          } : l);
        }
      } catch (diskErr) {
        console.warn('crm_leads.json assignment update notice:', diskErr.message);
      }

      broadcastRealtimeEvent('crm_lead_assigned', { lead: updated });
      broadcastRealtimeEvent('controlroom_crm_updated', { lead: updated });

      // Send real-time notification to the assigned salesperson (unless assignDbLead already dispatched it)
      if (!updated?._notificationDispatched) {
        try {
          const isReassign = Boolean(updated?._isReassignment);
          await createInternalNotification({
            recipientEmpCode: assignedToId,
            recipientRole: null, // Strictly target the assigned employee code only
            eventType: isReassign ? 'LEAD_REASSIGNED' : 'LEAD_ASSIGNED',
            documentType: 'lead',
            documentId: id,
            title: isReassign
              ? `🔄 Lead Reassigned: ${updated.company_name || 'Prospect'}`
              : `🎯 New Lead Assigned: ${updated.company_name || 'Prospect'}`,
            message: `Lead #${updated.lead_number || id} (${updated.company_name}) has been ${isReassign ? 'reassigned' : 'assigned'} to you by ${assignerUser.employee_name || 'Management'}.`,
            actorEmpCode: assignerUser.employee_code,
            actorName: assignerUser.employee_name || 'Management',
            actorRole: assignerUser.role || 'CEO',
            targetTab: 'Leads',
            targetRecordId: id,
            dedupId: `lead_${isReassign ? 'reassigned' : 'assigned'}_${id}_${assignedToId}_${Date.now()}`
          });
        } catch (notifErr) {
          console.warn('[Lead Notification Notice]:', notifErr.message);
        }
      }

      res.json({ success: true, message: `Lead assigned to ${assignedToName}`, lead: updated, data: updated });
    } catch (err) {
      res.status(err.message.includes('Unauthorized') ? 403 : 500).json({ success: false, error: err.message });
    }
  });

  // 🎯 Assign / Reassign Proforma Invoice (PI) to Sales Executive (Used by Tech Support, CEO, Sales Head)
  router.post(['/api/crm/proforma-invoices/:piNo/assign', '/api/proforma-invoices/:piNo/assign', '/api/crm/sales-pis/:piNo/assign'], async (req, res) => {
    try {
      const { piNo } = req.params;
      const { assignedToId, assignedToName, assignedToRole, assignedToEmail, reason } = req.body;

      if (!assignedToId || !assignedToName) {
        return res.status(400).json({ success: false, error: 'Target assignee employee ID and Name are required.' });
      }

      // Resolve assignee actual personal email if generic sales email was provided or missing
      let finalAssignedEmail = assignedToEmail;
      if (!finalAssignedEmail || finalAssignedEmail.toLowerCase().startsWith('sales@')) {
        try {
          const emps = await getDatabaseStore('employees_store');
          const found = Array.isArray(emps) ? emps.find(e => e && (e.employee_code === assignedToId || e.code === assignedToId)) : null;
          if (found && found.email) finalAssignedEmail = found.email;
        } catch (_) {}
      }

      const assignerUser = {
        employee_code: req.headers['x-user-emp-id'] || req.body.assignerEmpId || 'TS-001',
        employee_name: req.headers['x-user-name'] || req.body.assignerName || 'Tech Support',
        role: req.headers['x-user-role'] || req.body.assignerRole || 'Tech Support'
      };

      const cleanPiNo = String(piNo || '').trim();
      const assignedTimestamp = new Date().toISOString();
      let updatedPi = null;

      // 1. Authoritative Relational Database Update (public.proforma_invoices)
      try {
        updatedPi = await assignProformaInvoiceInDatabase(cleanPiNo, {
          assignedToId,
          assignedToName,
          assignedToRole,
          assignedToEmail: finalAssignedEmail,
          assignedBy: assignerUser.employee_name,
          assignedByRole: assignerUser.role,
          reason
        });
      } catch (dbErr) {
        console.warn('[PI Database Assign Warning]:', dbErr.message);
      }

      // 2. Update sales_pi_store on disk and memory
      const pSales = getStoreFilePath('sales_pi_store.json');
      let localSales = [];
      if (fs.existsSync(pSales)) {
        try {
          localSales = JSON.parse(fs.readFileSync(pSales, 'utf8'));
        } catch (_) {}
      }
      if (!Array.isArray(localSales) && Array.isArray(supabaseMemoryStore['sales_pi_store'])) {
        localSales = [...supabaseMemoryStore['sales_pi_store']];
      }

      let prevAssignedToCode = null;
      let prevAssignedToName = null;

      const assignmentMeta = {
        salesPerson: assignedToName,
        salesperson: assignedToName,
        salesRep: assignedToName,
        salesPersonCode: assignedToId,
        salesPersonEmail: finalAssignedEmail || (updatedPi ? updatedPi.salesPersonEmail : ''),
        assignedSalesperson: assignedToName,
        assignedSalespersonCode: assignedToId,
        assignedToCode: assignedToId,
        assignedToId: assignedToId,
        assignedToName: assignedToName,
        assignedBy: assignerUser.employee_name,
        assignedByRole: assignerUser.role,
        assignedAt: assignedTimestamp,
        assignmentReason: reason || 'Assigned by Tech Support'
      };

      if (Array.isArray(localSales)) {
        let foundInSales = false;
        localSales = localSales.map(p => {
          const match = String(p.piNo || p.id || '').trim().toLowerCase() === cleanPiNo.toLowerCase();
          if (match) {
            foundInSales = true;
            prevAssignedToCode = p.assignedSalespersonCode || p.salesPersonCode || p.assignedToCode || null;
            prevAssignedToName = p.assignedSalesperson || p.salesPerson || p.assignedToName || null;
            const prevHistory = Array.isArray(p.assignmentHistory) ? p.assignmentHistory : [];
            const newHistoryItem = {
              assigned_to_name: assignedToName,
              assigned_to_code: assignedToId,
              assigned_to_role: assignedToRole || 'Sales Executive',
              assigned_by_name: assignerUser.employee_name,
              assigned_by_code: assignerUser.employee_code,
              assigned_by_role: assignerUser.role,
              assigned_at: assignedTimestamp,
              reason: reason || 'Assigned by Tech Support'
            };
            const merged = {
              ...(updatedPi || p),
              ...assignmentMeta,
              assignmentHistory: [...prevHistory, newHistoryItem]
            };
            if (!updatedPi) updatedPi = merged;
            return merged;
          }
          return p;
        });

        if (!foundInSales && updatedPi) {
          localSales = [updatedPi, ...localSales];
        }

        fs.writeFileSync(pSales, JSON.stringify(localSales, null, 2), 'utf8');
        supabaseMemoryStore['sales_pi_store'] = localSales;
        pushStoreToSupabase('sales_pi_store', localSales).catch(() => {});
      }

      // 3. Also update proforma_invoice_store on disk and memory
      const pProforma = getStoreFilePath('proforma_invoice_store.json');
      if (fs.existsSync(pProforma)) {
        try {
          let localProforma = JSON.parse(fs.readFileSync(pProforma, 'utf8'));
          if (Array.isArray(localProforma)) {
            let foundInProforma = false;
            localProforma = localProforma.map(p => {
              if (String(p.piNo || p.id || '').trim().toLowerCase() === cleanPiNo.toLowerCase()) {
                foundInProforma = true;
                if (!prevAssignedToCode) {
                  prevAssignedToCode = p.assignedSalespersonCode || p.salesPersonCode || p.assignedToCode || null;
                  prevAssignedToName = p.assignedSalesperson || p.salesPerson || p.assignedToName || null;
                }
                const merged = {
                  ...(updatedPi || p),
                  ...assignmentMeta
                };
                if (!updatedPi) updatedPi = merged;
                return merged;
              }
              return p;
            });
            if (!foundInProforma && updatedPi) {
              localProforma = [updatedPi, ...localProforma];
            }
            fs.writeFileSync(pProforma, JSON.stringify(localProforma, null, 2), 'utf8');
            supabaseMemoryStore['proforma_invoice_store'] = localProforma;
            pushStoreToSupabase('proforma_invoice_store', localProforma).catch(() => {});
          }
        } catch (_) {}
      }

      broadcastRealtimeEvent('sales_pi_assigned', {
        piNo: cleanPiNo,
        assignedToId,
        assignedToName,
        previousAssigneeId: prevAssignedToCode,
        previousAssigneeName: prevAssignedToName,
        updatedPi,
        pi: updatedPi
      });
      broadcastRealtimeEvent('pi_updated', {
        action: 'assign',
        piNo: cleanPiNo,
        assignedToId,
        assignedToName,
        previousAssigneeId: prevAssignedToCode,
        previousAssigneeName: prevAssignedToName,
        updatedPi,
        pi: updatedPi
      });

      // Send real-time internal notification to the newly assigned salesperson
      try {
        await createInternalNotification({
          recipientEmpCode: assignedToId,
          recipientRole: assignedToRole || 'Sales Executive',
          eventType: 'PI_ASSIGNED',
          documentType: 'proforma_invoice',
          documentId: cleanPiNo,
          title: `📄 Proforma Invoice Assigned: ${cleanPiNo}`,
          message: `Proforma Invoice #${cleanPiNo} (${(updatedPi && (updatedPi.vendor || updatedPi.customerName)) || 'Customer'}) has been assigned to you by ${assignerUser.employee_name}. You can convert it to a BOM Order.`,
          actorEmpCode: assignerUser.employee_code,
          actorName: assignerUser.employee_name,
          actorRole: assignerUser.role,
          targetTab: 'Proforma Invoice',
          targetRecordId: cleanPiNo,
          dedupId: `pi_assigned_${cleanPiNo}_${assignedToId}_${Date.now()}`
        });
      } catch (notifErr) {
        console.warn('[PI Notification Warning]:', notifErr.message);
      }

      // Also notify previous assignee if reassigned so their screen removes it in real time
      if (prevAssignedToCode && String(prevAssignedToCode).trim().toLowerCase() !== String(assignedToId).trim().toLowerCase()) {
        try {
          await createInternalNotification({
            recipientEmpCode: prevAssignedToCode,
            recipientRole: 'Sales Executive',
            eventType: 'PI_REASSIGNED',
            documentType: 'proforma_invoice',
            documentId: cleanPiNo,
            title: `ℹ️ Proforma Invoice Reassigned: ${cleanPiNo}`,
            message: `Proforma Invoice #${cleanPiNo} has been reassigned to ${assignedToName} by ${assignerUser.employee_name}.`,
            actorEmpCode: assignerUser.employee_code,
            actorName: assignerUser.employee_name,
            actorRole: assignerUser.role,
            targetTab: 'Proforma Invoice',
            targetRecordId: cleanPiNo,
            dedupId: `pi_reassigned_${cleanPiNo}_${prevAssignedToCode}_${Date.now()}`
          });
        } catch (prevNotifErr) {
          console.warn('[PI Reassign Notification Warning]:', prevNotifErr.message);
        }
      }

      res.json({
        success: true,
        message: `Proforma Invoice ${cleanPiNo} assigned to ${assignedToName}`,
        pi: updatedPi,
        data: updatedPi
      });
    } catch (err) {
      console.error('[POST /api/crm/proforma-invoices/:piNo/assign error]:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Customer Interaction Activity Logger (Resets 24h timer on qualifying activities)
  router.post(['/api/crm/leads/:id/activity', '/api/leads/:id/activity'], async (req, res) => {
    try {
      const { id } = req.params;
      const { activityType, summary, customerResponse, callDurationSeconds } = req.body;

      if (!activityType || !summary) {
        return res.status(400).json({ success: false, error: 'Activity type and summary are required.' });
      }

      const user = {
        employee_code: req.headers['x-user-emp-id'] || req.body.userEmpId,
        employee_name: req.headers['x-user-name'] || req.body.userName,
        role: req.headers['x-user-role'] || req.body.userRole
      };

      const result = await recordLeadActivity({
        leadId: id,
        activityType,
        summary,
        customerResponse: customerResponse || '',
        callDurationSeconds: Number(callDurationSeconds) || 0,
        user
      });

      // Also append to lead.notes for instant visibility across Tech Support and CEO views
      const formattedNote = `[${user.employee_name || 'Sales'} • ${new Date().toLocaleDateString('en-IN')}]: ${summary}`;
      try {
        await pool.query(`
          UPDATE public.leads SET
            notes = CASE
              WHEN notes IS NULL OR TRIM(notes) = '' THEN $1
              ELSE notes || E'\\n---\\n' || $1
            END,
            updated_at = NOW()
          WHERE id = $2 OR lead_number = $2
        `, [formattedNote, id]);
      } catch (_) {}

      try {
        const diskPath = getStoreFilePath('crm_leads.json');
        if (fs.existsSync(diskPath)) {
          let leads = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
          leads = leads.map(l => (l.id === id || l.lead_number === id) ? {
            ...l,
            notes: l.notes ? `${l.notes}\n---\n${formattedNote}` : formattedNote,
            updated_at: new Date().toISOString()
          } : l);
          fs.writeFileSync(diskPath, JSON.stringify(leads, null, 2), 'utf8');
        }
        if (supabaseMemoryStore.crm_leads && Array.isArray(supabaseMemoryStore.crm_leads)) {
          supabaseMemoryStore.crm_leads = supabaseMemoryStore.crm_leads.map(l => (l.id === id || l.lead_number === id) ? {
            ...l,
            notes: l.notes ? `${l.notes}\n---\n${formattedNote}` : formattedNote,
            updated_at: new Date().toISOString()
          } : l);
        }
      } catch (diskErr) {
        console.warn('crm_leads.json activity note notice:', diskErr.message);
      }

      broadcastRealtimeEvent('crm_lead_activity_logged', { leadId: id, activity: result, note: formattedNote });
      broadcastRealtimeEvent('controlroom_crm_updated', { leadId: id, activity: result, note: formattedNote });
      res.json({ success: true, message: 'Activity recorded successfully', ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Status Transition with Audit Trail & Customer Conversion Linking
  router.all(['/api/crm/leads/:id/status', '/api/leads/:id/status'], async (req, res, next) => {
    if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT') return next();
    try {
      const { id } = req.params;
      const status = req.body.newStatus || req.body.status;
      const remarks = req.body.remarks;
      const convertedCustomerId = req.body.convertedCustomerId || req.body.converted_customer_id || null;
      const convertedCustomerCode = req.body.convertedCustomerCode || req.body.converted_customer_code || null;

      if (!status) return res.status(400).json({ success: false, error: 'New status is required.' });

      const user = {
        employee_code: req.headers['x-user-emp-id'] || req.body.userEmpId,
        employee_name: req.headers['x-user-name'] || req.body.userName,
        role: req.headers['x-user-role'] || req.body.userRole
      };

      const result = await updateDbLeadStatus({
        leadId: id,
        newStatus: status,
        remarks: remarks || '',
        convertedCustomerId,
        convertedCustomerCode,
        user
      });

      // Also update server/crm_leads.json for disk persistence
      try {
        const diskPath = getStoreFilePath('crm_leads.json');
        if (fs.existsSync(diskPath)) {
          let leads = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
          leads = leads.map(l => (l.id === id || l.lead_number === id) ? {
            ...l,
            status,
            converted_customer_id: convertedCustomerId || l.converted_customer_id,
            converted_customer_code: convertedCustomerCode || l.converted_customer_code,
            convertedCustomerCode: convertedCustomerCode || l.convertedCustomerCode,
            updated_at: new Date().toISOString()
          } : l);
          fs.writeFileSync(diskPath, JSON.stringify(leads, null, 2), 'utf8');
        }
      } catch (diskErr) {
        console.warn('crm_leads.json update notice:', diskErr.message);
      }

      broadcastRealtimeEvent('crm_lead_status_updated', { leadId: id, ...result });
      res.json({ success: true, message: 'Status updated', ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Schedule Follow-up
  router.post(['/api/crm/leads/:id/followup', '/api/leads/:id/followup'], async (req, res) => {
    try {
      const { id } = req.params;
      const { scheduledAt, notes } = req.body;

      if (!scheduledAt) return res.status(400).json({ success: false, error: 'Scheduled date/time is required.' });

      const user = {
        employee_code: req.headers['x-user-emp-id'] || req.body.userEmpId,
        employee_name: req.headers['x-user-name'] || req.body.userName,
        role: req.headers['x-user-role'] || req.body.userRole
      };

      const result = await scheduleLeadFollowup({
        leadId: id,
        scheduledAt,
        notes: notes || '',
        user
      });

      res.json({ success: true, message: 'Follow-up scheduled', ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Sales & Support Staff for Lead Assignment (Strictly genuine registered accounts created in BUSINZ)
  router.get('/api/crm/salespersons', async (req, res) => {
    try {
      let employees = [];
      try {
        employees = await getDatabaseStore('employees_store');
      } catch (_) {}

      const salesList = [];
      const seenCodes = new Set();

      if (Array.isArray(employees)) {
        employees.forEach(emp => {
          const code = emp.employee_code || emp.code || emp.id;
          const name = emp.employee_name || emp.name;
          const role = emp.role || emp.designation || '';
          const roleNorm = (role || '').trim().toLowerCase();
          const deptNorm = (emp.department || '').trim().toLowerCase();
          const isSales = roleNorm === 'sales executive' || roleNorm === 'sales head' ||
                          roleNorm.includes('sales') || roleNorm.includes('salesperson') ||
                          deptNorm.includes('sales');
          if (code && isSales && !seenCodes.has(code)) {
            seenCodes.add(code);
            salesList.push({
              employee_code: code,
              employee_name: name || code,
              role: role || 'Sales Executive',
              email: emp.email || ''
            });
          }
        });
      }

      res.json({ success: true, salespersons: salesList, data: salesList });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Automatic 24h & 48h Inactivity Background Checker (Runs 5s after startup and 5m after each completion)
  if (!isOptimizationTestMode()) {
    setTimeout(async () => {
      try {
        if (isMaintenanceModeActive()) return;
        await checkAndProcessLeadInactivity({ source: 'startup' });
      } catch (err) {
        console.warn('[Initial Lead Inactivity Check Error]:', err.message);
      }
    }, 5000);
  } else {
    console.log('🛡️ [Startup Lead Inactivity] Test mode active: initial inactivity check disabled.');
  }

  let inactivityTimer = null;
  function scheduleNextInactivityCheck() {
    if (isOptimizationTestMode()) {
      console.log('🛡️ [Lead Inactivity Scheduler] Test mode active: background scheduling disabled.');
      return;
    }
    inactivityTimer = setTimeout(async () => {
      try {
        if (!isMaintenanceModeActive()) {
          await checkAndProcessLeadInactivity({ source: 'scheduler' });
        }
      } catch (err) {
        console.warn('[Background Lead Inactivity Check Error]:', err.message);
      } finally {
        scheduleNextInactivityCheck();
      }
    }, 5 * 60 * 1000);
  }
  scheduleNextInactivityCheck();

  router.post('/api/crm/leads/check-inactivity', async (req, res) => {
    try {
      const session = await getVerifiedUserSession(req);
      if (!session || !session.valid) {
        return res.status(401).json({ success: false, error: session?.error || 'Unauthorized: Authentication session required' });
      }
      if (!['Technical Administrator', 'Super Admin', 'CEO', 'Director', 'Admin', 'Sales Manager'].includes(session.role)) {
        return res.status(403).json({ success: false, error: 'Forbidden: Insufficient privileges to trigger inactivity check' });
      }

      const result = await checkAndProcessLeadInactivity({ source: 'manual-api' });
      if (result && result.skipped) {
        return res.status(200).json({
          success: true,
          message: 'Inactivity check is already in progress; skipped duplicate execution',
          skipped: true,
          overlappingSkipped: result.overlappingSkipped
        });
      }
      res.json({ success: true, message: 'Inactivity check completed successfully' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
