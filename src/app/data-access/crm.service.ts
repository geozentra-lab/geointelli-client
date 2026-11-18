import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Page } from '../core/models/api';
import {
  CrmActivityDTO,
  CrmClientCreateRequest,
  CrmClientDTO,
  CrmClientUpdateRequest,
  CrmLeadCreateRequest,
  CrmLeadDTO,
  CrmLeadUpdateRequest,
  CrmPipelineDTO,
  CrmSubjectType,
  CrmTaskCreateRequest,
  CrmTaskDTO,
  CrmTaskStatus,
  CrmTaskSummaryDTO,
  CrmTaskUpdateRequest,
  CrmTransactionCreateRequest,
  CrmTransactionDTO,
  CrmTransactionStage,
  CrmTransactionUpdateRequest,
  LeadStage,
} from '../core/models/crm';
import { queryParams } from './http-params';

const historyPaths: Record<CrmSubjectType, string> = {
  CLIENT: 'clients',
  LEAD: 'leads',
  TASK: 'tasks',
  TRANSACTION: 'transactions',
};

@Injectable({ providedIn: 'root' })
export class CrmService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  clients(page = 0, size = 20) {
    return this.http.get<Page<CrmClientDTO>>(this.api + '/clients', {
      params: queryParams({ page, size }),
    });
  }
  createClient(body: CrmClientCreateRequest) {
    return this.http.post<CrmClientDTO>(this.api + '/clients', body);
  }
  updateClient(id: number, body: CrmClientUpdateRequest) {
    return this.http.patch<CrmClientDTO>(`${this.api}/clients/${id}`, body);
  }
  deleteClient(id: number) {
    return this.http.delete<void>(`${this.api}/clients/${id}`);
  }

  leads(page = 0, stage: LeadStage | null = null, size = 20) {
    return this.http.get<Page<CrmLeadDTO>>(this.api + '/leads', {
      params: queryParams({ page, size, stage }),
    });
  }
  /** The key makes a retried submission return the same lead instead of a duplicate. */
  createLead(body: CrmLeadCreateRequest, idempotencyKey: string) {
    return this.http.post<CrmLeadDTO>(this.api + '/leads', body, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }
  updateLead(id: number, body: CrmLeadUpdateRequest) {
    return this.http.patch<CrmLeadDTO>(`${this.api}/leads/${id}`, body);
  }

  tasks(page = 0, status: CrmTaskStatus | null = null, size = 20) {
    return this.http.get<Page<CrmTaskDTO>>(this.api + '/tasks', {
      params: queryParams({ page, size, status }),
    });
  }
  taskSummary() {
    return this.http.get<CrmTaskSummaryDTO>(this.api + '/tasks/summary');
  }
  createTask(body: CrmTaskCreateRequest) {
    return this.http.post<CrmTaskDTO>(this.api + '/tasks', body);
  }
  updateTask(id: number, body: CrmTaskUpdateRequest) {
    return this.http.patch<CrmTaskDTO>(`${this.api}/tasks/${id}`, body);
  }
  deleteTask(id: number) {
    return this.http.delete<void>(`${this.api}/tasks/${id}`);
  }

  deals(page = 0, stage: CrmTransactionStage | null = null, size = 20) {
    return this.http.get<Page<CrmTransactionDTO>>(this.api + '/transactions', {
      params: queryParams({ page, size, stage }),
    });
  }
  pipeline() {
    return this.http.get<CrmPipelineDTO>(this.api + '/transactions/pipeline');
  }
  createDeal(body: CrmTransactionCreateRequest) {
    return this.http.post<CrmTransactionDTO>(this.api + '/transactions', body);
  }
  updateDeal(id: number, body: CrmTransactionUpdateRequest) {
    return this.http.patch<CrmTransactionDTO>(`${this.api}/transactions/${id}`, body);
  }

  activities(page = 0, size = 20) {
    return this.http.get<Page<CrmActivityDTO>>(this.api + '/crm/activities', {
      params: queryParams({ page, size }),
    });
  }
  history(subject: CrmSubjectType, id: number, page = 0, size = 20) {
    return this.http.get<Page<CrmActivityDTO>>(
      `${this.api}/${historyPaths[subject]}/${id}/activities`,
      { params: queryParams({ page, size }) },
    );
  }
  /** Notes can be added to clients and leads only. */
  addNote(subject: 'CLIENT' | 'LEAD', id: number, description: string) {
    return this.http.post<CrmActivityDTO>(`${this.api}/${historyPaths[subject]}/${id}/activities`, {
      description,
    });
  }
}
