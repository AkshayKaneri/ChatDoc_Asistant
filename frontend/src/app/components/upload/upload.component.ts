import { Component, EventEmitter, Output, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Modal, Toast } from 'bootstrap';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css'],
  imports: [FormsModule],
  providers: [ApiService]
})
export class UploadComponent implements AfterViewInit {
  namespace: string = '';
  selectedFiles: File[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';

  @Output() uploadComplete = new EventEmitter<string>();

  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('toastContainer', { static: true }) toastContainer!: ElementRef;
  @ViewChild('uploadModal', { static: true }) modalRef!: ElementRef;

  private modalInstance: Modal | null = null;

  constructor(private apiService: ApiService) { }

  ngAfterViewInit() {
    if (this.modalRef?.nativeElement) {
      this.modalInstance = new Modal(this.modalRef.nativeElement, { backdrop: 'static', keyboard: false });

      this.modalRef.nativeElement.addEventListener('hidden.bs.modal', () => {
        this.resetForm();
      });
    }
  }

  onFileSelected(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    if (inputElement.files) {
      this.selectedFiles = Array.from(inputElement.files);
    }
  }

  onSubmit() {
    if (!this.namespace.trim() || this.selectedFiles.length === 0) {
      this.showToast("❌ Please enter a namespace and select at least one PDF.", "danger");
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const formData = new FormData();
    formData.append('namespace', this.namespace);
    this.selectedFiles.forEach(file => formData.append('pdf', file));

    this.apiService.uploadPDF(formData).subscribe({
      next: (response) => {
        this.showToast("✅ PDFs uploaded successfully!", "success");

        this.uploadComplete.emit(this.namespace);
        this.closeModal();
      },
      error: (error) => {
        console.error("❌ Upload Failed:", error);
        this.showToast(this.getErrorMessage(error), "danger");
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  private closeModal() {
    if (this.modalInstance) {
      this.modalInstance.hide();
    }

    setTimeout(() => {
      document.body.classList.remove("modal-open");
      document.querySelectorAll(".modal-backdrop").forEach(el => el.remove());
    }, 300);

    this.resetForm();
  }

  private resetForm() {
    this.namespace = '';
    this.selectedFiles = [];

    if (this.fileInput && this.fileInput.nativeElement) {
      setTimeout(() => {
        requestAnimationFrame(() => {
          this.fileInput.nativeElement.value = '';
        });
      }, 100);
    }
  }

  private showToast(message: string, type: string) {
    const toastElement = document.createElement("div");
    toastElement.className = `toast align-items-center text-white bg-${type} border-0 show`;
    toastElement.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    `;

    document.body.appendChild(toastElement);

    const toastInstance = new Toast(toastElement);
    toastInstance.show();

    setTimeout(() => {
      toastElement.remove();
    }, 3500);
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return "❌ Network error! Please check your connection.";
    } else if (error.status >= 500) {
      return "❌ Server is currently down. Try again later.";
    } else if (error.status === 400) {
      return error.error?.error || "❌ Bad request! Please check your inputs.";
    } else {
      return "❌ An unexpected error occurred. Please try again.";
    }
  }
}