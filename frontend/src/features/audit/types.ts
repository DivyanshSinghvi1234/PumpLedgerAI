export interface AuditLog {
  id: number;
  actor_id: number | null;
  action: string;
  target_table: string;
  target_id: string;
  changes_json: string | null;
  created_at: string;
}
