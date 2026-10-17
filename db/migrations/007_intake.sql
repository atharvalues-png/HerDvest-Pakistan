-- Attach a file received by an authenticated intake webhook (no signed-in user).
-- Only allowed while the intake item is still awaiting review.
create or replace function hv.intake_add_attachment(
  p_intake uuid, p_name text, p_mime text, p_size bigint, p_key text, p_sha text)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare v_id uuid;
begin
  if not exists (select 1 from hv.intake_items where id = p_intake and status in ('pending_review','unmatched')) then
    raise exception 'Intake item not open for attachments';
  end if;
  insert into hv.attachments (entity_type, entity_id, category, original_name, mime_type, size_bytes, storage_key, sha256, caption)
  values ('intake_item', p_intake, 'other', left(p_name, 200), p_mime, p_size, p_key, p_sha, 'Received via intake')
  returning id into v_id;
  return v_id;
end $$;

-- Reviewer marks the outcome; created_records lists what was written.
create or replace function hv.intake_mark_reviewed(p_intake uuid, p_status text, p_note text, p_created jsonb)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  perform hv.require_perm('intake.review');
  if p_status not in ('approved','rejected','duplicate') then raise exception 'Invalid review outcome'; end if;
  update hv.intake_items set status = p_status, review_note = p_note, created_records = coalesce(p_created, '[]'),
         reviewed_by = hv.current_user_id(), reviewed_at = now()
   where id = p_intake and status in ('pending_review','unmatched');
  if not found then raise exception 'This intake item has already been reviewed'; end if;
end $$;

grant execute on all functions in schema hv to herdvest_app;
