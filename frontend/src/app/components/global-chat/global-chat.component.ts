import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
@Component({
    selector: 'app-global-chat',
    standalone: true,
    templateUrl: './global-chat.component.html',
    styleUrls: ['./global-chat.component.css'],
    imports: [CommonModule, FormsModule],
    providers: [ApiService]
})
export class GlobalChatComponent implements AfterViewInit {
    userMessage: string = '';
    messages: { sender: 'user' | 'assistant'; text: string; isTyping?: boolean }[] = [];
    isLoading = false;
    isUserAtBottom: boolean = true;

    @ViewChild('chatMessages') chatMessagesContainer!: ElementRef;

    constructor(private apiService: ApiService, private sanitizer: DomSanitizer) { }

    sanitizeHTML(content: string): SafeHtml {
        return this.sanitizer.bypassSecurityTrustHtml(content);
    }
    ngAfterViewInit() {
        this.fetchGlobalChatHistory();
        this.scrollToBottom();

        // ✅ Setup Scroll Listener
        if (this.chatMessagesContainer) {
            const container = this.chatMessagesContainer.nativeElement;
            container.addEventListener("scroll", () => {
                this.isUserAtBottom =
                    container.scrollHeight - container.scrollTop <= container.clientHeight + 50; // ✅ 50px buffer
            });
        }
    }

    /** ✅ Fetch Global Chat History */
    fetchGlobalChatHistory() {
        this.apiService.getGlobalChatHistory().subscribe({
            next: (data) => {
                console.log("✅ Global Chat History Loaded:", data);

                this.messages = data.history.map((msg: any) => ({
                    sender: msg.sender as 'user' | 'assistant',
                    text: msg.message
                }));

                this.scrollToBottom();
            },
            error: (error) => {
                console.error("❌ Error fetching global chat history:", error);
            }
        });
    }

    /** ✅ Send user message and get AI response */
    sendMessage() {
        if (!this.userMessage.trim() || this.isLoading) return;

        const userMsg = this.userMessage.trim();
        this.messages.push({ sender: 'user', text: userMsg });
        this.userMessage = '';
        this.isLoading = true;

        this.scrollToBottom();
        this.messages.push({ sender: 'assistant', text: '', isTyping: true });

        this.apiService.queryGlobalChat(userMsg).subscribe({
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

    /** ✅ Simulate typing effect */
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
            }, 10);
        }
    }

    /** ✅ Smooth Auto-Scroll */
    private scrollToBottom() {
        setTimeout(() => {
            if (this.chatMessagesContainer) {
                const container = this.chatMessagesContainer.nativeElement;
                if (this.isUserAtBottom) {
                    container.scrollTo({
                        top: container.scrollHeight,
                        behavior: "smooth",
                    });
                }
            }
        }, 100);
    }
}