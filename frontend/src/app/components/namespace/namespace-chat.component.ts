import { Component, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UploadComponent } from '../upload/upload.component';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Modal } from 'bootstrap';

@Component({
    selector: 'app-namespace-chat',
    standalone: true,
    templateUrl: './namespace-chat.component.html',
    styleUrls: ['./namespace-chat.component.css'],
    imports: [CommonModule, UploadComponent, FormsModule],
    providers: [ApiService]
})
export class NamespaceChatComponent implements AfterViewInit {
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

    constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) { }


    ngAfterViewInit() {
        this.fetchNamespaces();

        if (this.uploadModal?.nativeElement) {
            this.modalInstance = new Modal(this.uploadModal.nativeElement, { backdrop: 'static', keyboard: false });
        }

        if (this.chatMessagesContainer) {
            const container = this.chatMessagesContainer.nativeElement;
            container.addEventListener("scroll", () => {
                this.isUserAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
            });
        }

        this.scrollToBottom();
    }

    fetchNamespaces(callback?: () => void) {
        this.apiService.getNamespaces().subscribe({
            next: (data) => {
                this.namespaces = data.sort((a: string, b: string) => {
                    const isA_locked = this.lockedNamespaces.includes(a) ? 1 : 0;
                    const isB_locked = this.lockedNamespaces.includes(b) ? 1 : 0;
                    return isB_locked - isA_locked;
                });

                // ✅ Ensure the newly added namespace remains selected
                if (this.selectedNamespace && this.namespaces.includes(this.selectedNamespace)) {
                    this.selectedNamespace = this.selectedNamespace;
                } else if (this.namespaces.length > 0) {
                    this.selectedNamespace = this.namespaces[0];
                }

                // ✅ Execute the callback to fetch chat history
                if (callback) {
                    callback();
                }
            },
            error: (err) => {
                console.error("❌ Error fetching namespaces:", err);
            }
        });
    }

    fetchChatHistory(namespace: string) {
        this.apiService.getChatHistory(namespace).subscribe({
            next: (data) => {
                this.messages = data.history.map(msg => ({
                    sender: msg.sender as 'user' | 'assistant',
                    text: msg.message
                }));

                this.cdr.detectChanges();
                this.scrollToBottom(true);
            },
            error: (error) => {
                console.error("❌ Error fetching chat history:", error);
            }
        });
    }

    openModal() {
        if (this.modalInstance) {
            this.modalInstance.show();
        }
    }

    onNamespaceChange(namespace: string) {
        this.selectedNamespace = namespace;
        this.messages = [];

        if (!this.namespaces.includes(namespace)) {
            this.namespaces.push(namespace);
        }

        localStorage.setItem('selectedNamespace', namespace);

        if (this.modalInstance) {
            this.modalInstance.hide();
        }

        document.body.classList.remove("modal-open");
        document.querySelector(".modal-backdrop")?.remove();

        // ✅ Delay fetching to ensure the backend updates properly
        setTimeout(() => {
            this.fetchNamespaces(() => {
                this.selectedNamespace = namespace;
                this.fetchChatHistory(namespace);
            });
        }, 500);
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

                this.cdr.detectChanges();
                this.scrollToBottom();

                if (text === finalText) {
                    clearInterval(interval);
                }
            }, 10);
        }
    }

    private scrollToBottom(force: boolean = false) {
        setTimeout(() => {
            if (this.chatMessagesContainer) {
                const container = this.chatMessagesContainer.nativeElement;

                if (force || this.isUserAtBottom) {
                    container.scrollTo({
                        top: container.scrollHeight,
                        behavior: "smooth"
                    });
                }
            }
        }, 50);
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