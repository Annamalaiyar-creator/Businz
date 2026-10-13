import React, { useState, useMemo } from 'react';
import {
  Calendar, Clock, CheckCircle2, AlertTriangle, Phone, MessageSquare,
  Plus, Search, Filter, X, User, ArrowRight, ShieldAlert, Check
} from 'lucide-react';

export default function CrmFollowupsView({
  followups = [],
  onSaveFollowup,
  onOpenWhatsAppChat,
  onNavigateTab
}) {
  const [activeSubTab, setActiveSubTab] = useState('Today'); // 'Today' | 'Upcoming' | 'Overdue' | 'Completed'
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newFollowup, setNewFollowup] = useState({
    customerName: '',
    type: 'Call',
    date: new Date().toISOString().split('T')[0],
    time: '11:00 AM',
    notes: '',
    assignedSalesperson: localStorage.getItem('controlroom_logged_user_name') || 'Sales Representative'
  });

  const todayStr = new Date().toISOString().split('T')[0];

  const categorizedFollowups = useMemo(() => {
    const today = [];
    const upcoming = [];
    const overdue = [];
    const completed = [];

    followups.forEach(f => {
      if (f.status === 'Completed') {
        completed.push(f);
      } else if (f.date < todayStr || f.status === 'Overdue') {
        overdue.push(f);
      } else if (f.date === todayStr) {
        today.push(f);
      } else {
        upcoming.push(f);
      }
    });

    return { today, upcoming, overdue, completed };
  }, [followups, todayStr]);

  const currentList = useMemo(() => {
    let list = [];
    if (activeSubTab === 'Today') list = categorizedFollowups.today;
    else if (activeSubTab === 'Upcoming') list = categorizedFollowups.upcoming;
    else if (activeSubTab === 'Overdue') list = categorizedFollowups.overdue;
    else list = categorizedFollowups.completed;

    if (!searchTerm) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(f =>
      f.customerName?.toLowerCase().includes(q) ||
      f.notes?.toLowerCase().includes(q) ||
      f.type?.toLowerCase().includes(q)
    );
  }, [categorizedFollowups, activeSubTab, searchTerm]);

  const handleMarkComplete = (f) => {
    onSaveFollowup({
      ...f,
      status: 'Completed',
      completedAt: new Date().toISOString()
    });
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newFollowup.customerName || !newFollowup.date) {
      alert('Please fill out customer name and date.');
      return;
    }

    const item = {
      id: `FU-${Date.now()}`,
      ...newFollowup,
      status: newFollowup.date < todayStr ? 'Overdue' : 'Scheduled',
      createdAt: new Date().toISOString()
    };

    onSaveFollowup(item);
    setShowCreateModal(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: '#0E7490',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Calendar size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              Sales Follow-up & Task Tracker
            </h2>
            <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
              Ensure zero dropped solar leads with scheduled calls, WhatsApp reminders, and quotation follow-ups
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#0E7490',
            color: '#FFFFFF',
            border: 'none',
            padding: '9px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} /> Schedule Follow-up
        </button>
      </div>

      {/* Tabs for Today, Upcoming, Overdue, Completed */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: '12px 18px',
        borderRadius: '10px',
        border: '1px solid #E2E8F0'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveSubTab('Today')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeSubTab === 'Today' ? '#0E7490' : '#F1F5F9',
              color: activeSubTab === 'Today' ? '#FFFFFF' : '#475569',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Today's Follow-ups ({categorizedFollowups.today.length})
          </button>

          <button
            onClick={() => setActiveSubTab('Overdue')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeSubTab === 'Overdue' ? '#DC2626' : '#FEE2E2',
              color: activeSubTab === 'Overdue' ? '#FFFFFF' : '#B91C1C',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <AlertTriangle size={14} /> Overdue ({categorizedFollowups.overdue.length})
          </button>

          <button
            onClick={() => setActiveSubTab('Upcoming')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeSubTab === 'Upcoming' ? '#0284C7' : '#F1F5F9',
              color: activeSubTab === 'Upcoming' ? '#FFFFFF' : '#475569',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Upcoming ({categorizedFollowups.upcoming.length})
          </button>

          <button
            onClick={() => setActiveSubTab('Completed')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeSubTab === 'Completed' ? '#16A34A' : '#F1F5F9',
              color: activeSubTab === 'Completed' ? '#FFFFFF' : '#475569',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Completed ({categorizedFollowups.completed.length})
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#F8FAFC', padding: '6px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', width: '240px' }}>
          <Search size={14} color="#64748B" />
          <input id="crm-followups-search-follow-ups" name="searchFollowUps" aria-label="Search follow-ups"
            type="text"
            placeholder="Search follow-ups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '12px', width: '100%' }}
           />
        </div>
      </div>

      {/* Follow-up Cards / Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {currentList.length === 0 ? (
          <div style={{ padding: '40px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', textAlign: 'center', color: '#64748B' }}>
            <p style={{ fontWeight: '700', fontSize: '15px', margin: '0 0 6px' }}>No follow-ups in this tab</p>
            <p style={{ fontSize: '12px', margin: 0 }}>All scheduled communications are up to date.</p>
          </div>
        ) : (
          currentList.map(f => (
            <div
              key={f.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  backgroundColor: f.type === 'WhatsApp' ? '#DCFCE7' : '#E0F2FE',
                  color: f.type === 'WhatsApp' ? '#16A34A' : '#0284C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {f.type === 'WhatsApp' ? <MessageSquare size={18} /> : <Phone size={18} />}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '800', fontSize: '14px', color: '#0F172A' }}>
                      {f.customerName}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: f.status === 'Completed' ? '#DCFCE7' : (f.date < todayStr ? '#FEE2E2' : '#FEF3C7'),
                      color: f.status === 'Completed' ? '#15803D' : (f.date < todayStr ? '#B91C1C' : '#B45309')
                    }}>
                      {f.date < todayStr && f.status !== 'Completed' ? 'OVERDUE' : f.type}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#475569' }}>
                    {f.notes || 'Follow-up on structure quotation & delivery timeline'}
                  </p>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                    <span>📅 Date: <strong>{f.date}</strong></span>
                    <span>⏰ Time: <strong>{f.time || '10:00 AM'}</strong></span>
                    <span>👤 Rep: <strong>{f.assignedSalesperson}</strong></span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {f.type === 'WhatsApp' && (
                  <button
                    onClick={() => onOpenWhatsAppChat ? onOpenWhatsAppChat(f) : onNavigateTab('WhatsApp Inbox')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #16A34A',
                      backgroundColor: '#F0FDF4',
                      color: '#16A34A',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <MessageSquare size={13} /> Chat Now
                  </button>
                )}

                {f.status !== 'Completed' && (
                  <button
                    onClick={() => handleMarkComplete(f)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Check size={14} /> Done
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Schedule Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Schedule New Follow-up</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label htmlFor="crm-followups-customer-lead-name" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Customer / Lead Name *</label>
                <input id="crm-followups-customer-lead-name" name="customerLeadName" aria-label="Customer / Lead Name"
                  type="text"
                  required
                  placeholder="e.g. Vikram Solar Ltd"
                  value={newFollowup.customerName}
                  onChange={(e) => setNewFollowup({ ...newFollowup, customerName: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                 />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label htmlFor="crm-followups-follow-up-channel" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Follow-up Channel</label>
                  <select id="crm-followups-follow-up-channel" name="followUpChannel" aria-label="Follow-up Channel"
                    value={newFollowup.type}
                    onChange={(e) => setNewFollowup({ ...newFollowup, type: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                  >
                    <option value="Call">Phone Call</option>
                    <option value="WhatsApp">WhatsApp Message</option>
                    <option value="Email">Email Follow-up</option>
                    <option value="Meeting">Site / Office Meeting</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="crm-followups-date" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Date *</label>
                  <input id="crm-followups-date" name="date" aria-label="Date"
                    type="date"
                    required
                    value={newFollowup.date}
                    onChange={(e) => setNewFollowup({ ...newFollowup, date: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                   />
                </div>
              </div>

              <div>
                <label htmlFor="crm-followups-agenda-notes" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Agenda / Notes</label>
                <textarea id="crm-followups-agenda-notes" name="agendaNotes" aria-label="Agenda / Notes"
                  rows={3}
                  placeholder="Confirm payment proof, negotiate rail pricing, schedule dispatch..."
                  value={newFollowup.notes}
                  onChange={(e) => setNewFollowup({ ...newFollowup, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                 />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
