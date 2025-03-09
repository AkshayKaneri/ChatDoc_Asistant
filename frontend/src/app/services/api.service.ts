import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) { }

  uploadPDF(formData: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}/upload`, formData);
  }

  queryPDF(data: { question: string; namespace: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/query`, data);
  }

  getNamespaces(): Observable<any> {
    return this.http.get(`${this.baseUrl}/namespaces`);
  }

  deleteNamespace(namespace: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/namespaces/delete/${namespace}`);
  }

  getChatHistory(namespace: string): Observable<{ namespace: string, history: { sender: string, message: string }[] }> {
    return this.http.get<{ namespace: string, history: { sender: string, message: string }[] }>(`${this.baseUrl}/namespaces/history/${namespace}`);
  }

  queryGlobalChat(question: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/query/global`, { question });
  }

  getGlobalChatHistory(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/chat/global/history`);
  }
}