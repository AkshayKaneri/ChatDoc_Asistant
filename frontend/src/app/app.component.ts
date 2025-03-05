import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UploadComponent } from './components/upload/upload.component';
import { Modal } from 'bootstrap';
import { FormsModule } from '@angular/forms';
import { ApiService } from './services/api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [CommonModule, UploadComponent, FormsModule],
  providers: [ApiService]
})
export class AppComponent implements AfterViewInit {
  namespaces: string[] = [];
  selectedNamespace: string | null = localStorage.getItem('selectedNamespace') || null;
  userMessage: string = '';
  messages: { sender: 'user' | 'assistant'; text: string; isTyping?: boolean }[] = [];
  isLoading = false;
  isUserAtBottom: boolean = true;
  lockedNamespaces: string[] = ["dialysis"];

  @ViewChild('uploadModal') uploadModal!: ElementRef;
  @ViewChild('chatMessages') chatMessagesContainer!: ElementRef;
  private modalInstance: Modal | null = null;

  constructor(private apiService: ApiService) { }

  ngAfterViewInit() {
    this.fetchNamespaces();

    // ✅ Initialize Bootstrap Modal
    if (this.uploadModal?.nativeElement) {
      this.modalInstance = new Modal(this.uploadModal.nativeElement, { backdrop: 'static', keyboard: false });
    }

    // ✅ Setup Scroll Listener
    if (this.chatMessagesContainer) {
      const container = this.chatMessagesContainer.nativeElement;
      container.addEventListener("scroll", () => {
        this.isUserAtBottom =
          container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
      });
    }

    this.scrollToBottom();
  }

  // ✅ Fetch namespaces from backend
  fetchNamespaces() {
    this.apiService.getNamespaces().subscribe({
      next: (data) => {
        this.namespaces = data.sort((a: string, b: string) => {
          const isA_locked = this.lockedNamespaces.includes(a) ? 1 : 0;
          const isB_locked = this.lockedNamespaces.includes(b) ? 1 : 0;
          return isB_locked - isA_locked;
        });
        if (this.namespaces.length > 0) {
          this.selectedNamespace = this.namespaces[0];
          this.fetchChatHistory(this.selectedNamespace);
        }
      },
      error: (err) => {
        console.error("❌ Error fetching namespaces:", err);
      }
    });
  }

  // ✅ Fetch chat history when a namespace is selected
  fetchChatHistory(namespace: string) {
    this.apiService.getChatHistory(namespace).subscribe({
      next: (data) => {
        this.messages = data.history.map(msg => ({
          sender: msg.sender as 'user' | 'assistant',
          text: msg.message
        }));
      },
      error: (error) => {
        console.error("❌ Error fetching chat history:", error);
      }
    });
  }

  openModal() {
    if (this.modalInstance) {
      this.modalInstance.show();
    } else {
      console.error("❌ Modal instance is not initialized.");
    }
  }

  onNamespaceChange(namespace: string) {
    this.selectedNamespace = namespace;
    this.messages = [];

    if (!this.namespaces.includes(namespace)) {
      this.namespaces.push(namespace);
      localStorage.setItem('namespaces', JSON.stringify(this.namespaces));
    }

    localStorage.setItem('selectedNamespace', namespace);

    if (this.modalInstance) {
      this.modalInstance.hide();
    }

    document.body.classList.remove("modal-open");
    document.querySelector(".modal-backdrop")?.remove();

    setTimeout(() => {
      this.fetchNamespaces();
      this.fetchChatHistory(namespace);
    }, 300);
  }

  selectNamespace(ns: string) {
    this.selectedNamespace = ns;
    this.fetchChatHistory(ns);
    localStorage.setItem('selectedNamespace', ns);
  }

  sendMessage() {
    if (!this.userMessage.trim() || this.isLoading || !this.selectedNamespace) return;

    const userMsg = this.userMessage.trim();
    this.messages.push({ sender: 'user', text: userMsg });
    this.userMessage = '';
    this.isLoading = true;

    this.scrollToBottom();

    this.messages.push({ sender: 'assistant', text: '', isTyping: true });

    this.apiService.queryPDF({ question: userMsg, namespace: this.selectedNamespace }).subscribe({
      next: (response) => {
        this.simulateTyping(response.answer || "I don't know.");
      },
      error: (error) => {
        console.error("❌ API Error:", error);
        this.simulateTyping("Oops! Something went wrong. Please try again.");
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  private simulateTyping(finalText: string) {
    let typingIndex = this.messages.findIndex(m => m.isTyping);
    if (typingIndex !== -1) {
      this.messages[typingIndex].isTyping = false;
      let text = '';
      let interval = setInterval(() => {
        text += finalText.charAt(text.length);
        this.messages[typingIndex].text = text;

        this.scrollToBottom();

        if (text === finalText) {
          clearInterval(interval);
        }
      }, 50);
    }
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.chatMessagesContainer) {
        const container = this.chatMessagesContainer.nativeElement;

        if (this.isUserAtBottom) {
          container.scrollTop = container.scrollHeight;
        }
      }
    }, 100);
  }

  deleteNamespace(ns: string) {
    if (this.lockedNamespaces.includes(ns)) {
      return;
    }
    if (!confirm(`Are you sure you want to delete the namespace "${ns}"?`)) return;

    this.apiService.deleteNamespace(ns).subscribe({
      next: () => {
        this.namespaces = this.namespaces.filter(namespace => namespace !== ns);

        if (this.selectedNamespace === ns) {
          this.selectedNamespace = this.namespaces.length > 0 ? this.namespaces[0] : null;
        }
      },
      error: (error) => {
        console.error(`❌ Error deleting namespace '${ns}':`, error);
        alert("Failed to delete namespace. Please try again.");
      }
    });
  }
}