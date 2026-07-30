import api from "@/api/client";
import type { AuditLog } from "../types";

class AuditService {
  async getAuditLogs(params?: { targetTable?: string; targetId?: string | number }): Promise<AuditLog[]> {
    const response = await api.get<AuditLog[]>("/v1/audit-logs", {
      params: {
        target_table: params?.targetTable,
        target_id: params?.targetId !== undefined ? String(params.targetId) : undefined,
      },
    });
    return response.data;
  }
}

const auditService = new AuditService();
export default auditService;

