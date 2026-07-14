import api from "@/api/client";
import type { AuditLog } from "../types";

class AuditService {
  async getAuditLogs(): Promise<AuditLog[]> {
    const response = await api.get<AuditLog[]>("/v1/audit-logs");
    return response.data;
  }
}

const auditService = new AuditService();
export default auditService;
