-- ==============================================================================
-- Migration: Remove Specifically Requested Test Leads from Database
-- Target Leads: VRM-LD-2026-10, VRM-LD-2026-04, VRM-LD-2026-03, VRM-LD-2026-02
-- ==============================================================================

DO $$
DECLARE
  target_ids TEXT[];
  matched_count INT := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
    SELECT ARRAY_AGG(id), COUNT(*) INTO target_ids, matched_count
    FROM public.leads
    WHERE lead_number IN ('VRM-LD-2026-10', 'VRM-LD-2026-04', 'VRM-LD-2026-03', 'VRM-LD-2026-02')
       OR id IN ('VRM-LD-2026-10', 'VRM-LD-2026-04', 'VRM-LD-2026-03', 'VRM-LD-2026-02');

    IF target_ids IS NOT NULL AND array_length(target_ids, 1) > 0 THEN
      -- 1. Remove inactivity incidents for target leads
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_inactivity_incidents') THEN
        DELETE FROM public.lead_inactivity_incidents WHERE lead_id = ANY(target_ids);
      END IF;

      -- 2. Remove activities for target leads
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_activities') THEN
        DELETE FROM public.lead_activities WHERE lead_id = ANY(target_ids);
      END IF;

      -- 3. Remove status transition history for target leads
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_status_history') THEN
        DELETE FROM public.lead_status_history WHERE lead_id = ANY(target_ids);
      END IF;

      -- 4. Remove follow-ups for target leads
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_followups') THEN
        DELETE FROM public.lead_followups WHERE lead_id = ANY(target_ids);
      END IF;

      -- 5. Remove assignment history for target leads
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_assignment_history') THEN
        DELETE FROM public.lead_assignment_history WHERE lead_id = ANY(target_ids);
      END IF;

      -- 6. Disassociate notifications referencing target leads
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_notifications') THEN
        UPDATE public.lead_notifications SET lead_id = NULL WHERE lead_id = ANY(target_ids);
      END IF;

      -- 7. Disassociate quotations referencing target leads
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quotations') THEN
        UPDATE public.quotations SET lead_id = NULL WHERE lead_id = ANY(target_ids);
      END IF;

      -- 8. Delete the leads themselves
      DELETE FROM public.leads WHERE id = ANY(target_ids);
      
      RAISE NOTICE 'Successfully deleted % target leads (%): %', matched_count, array_to_string(target_ids, ', ');
    ELSE
      RAISE NOTICE 'No matching leads found for VRM-LD-2026-10, 04, 03, 02 in public.leads';
    END IF;
  END IF;
END $$;

