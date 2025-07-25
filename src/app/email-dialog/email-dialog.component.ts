import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ToastrModule } from 'ngx-toastr';
import { backEndurl } from '../url';
import { MatProgressBarModule } from '@angular/material/progress-bar';

interface EmailResponse {
  success?: string;
  error?: string;
}

@Component({
  selector: 'app-email-dialog',
  standalone: true,
  imports: [
    MatButtonModule,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    CommonModule,
    MatIconModule,
    MatProgressBarModule,
    ToastrModule
  ],
  templateUrl: './email-dialog.component.html',
  styleUrls: ['./email-dialog.component.css']
})
export class EmailDialogComponent {
  sanitizedThumbnailUrl: SafeResourceUrl;
  fileName: string;
  downloadUrl: string;
  email: string = '';
  fromEmail: string = 'dmrinfo@dinamalar.in';
  thumbnail: string = '';
  toemail: string = '';
  date:string;
  edition:string='';
  publication:string='';
  file: File | null = null;
  backendurl = backEndurl.apiUrl;
  isSendingEmail: boolean = false;


  constructor(
    public dialogRef: MatDialogRef<EmailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { pdfUrl: string, fileName: string, downloadUrl: string, thumbnailUrl: string, edition:string,publication:string, date:string },
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    private toastr: ToastrService
  ) {
    this.sanitizedThumbnailUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.data.thumbnailUrl);
    this.thumbnail = this.data.thumbnailUrl;
    this.fileName = this.data.fileName;
    this.downloadUrl = this.data.downloadUrl;

    this.date = this.data.date;
    this.publication=this.data.publication;
    this.edition=this.data.edition;
  }

  isDialogOpen: boolean = true;
  async fetchFile(url: string): Promise<Blob> {
    const response = await fetch(url);
    const blob = await response.blob();
    return blob;
  }

  async sendMail(): Promise<void> {
    try {
      this.isSendingEmail = true;
      const subject = `PDF File: ${this.fileName}`;
      const htmlContent = `
      <p>Please find the PDF file attached.</p>
      <br>
      Publication:${this.publication}
      <br>
      Edition: ${this.edition}
      <br>
      Date: ${this.date}
      `;
      const emailData = new FormData();
      emailData.append('to', this.toemail);
      emailData.append('subject', subject);
      emailData.append('html', htmlContent);
      emailData.append('from', this.fromEmail);

      const fileBlob = await this.fetchFile(this.downloadUrl);
      const file = new File([fileBlob], this.fileName, { type: fileBlob.type });
      emailData.append('attachment', file);

      this.http.post<EmailResponse>(this.backendurl + '/send-email', emailData)
        .subscribe(
          response => {
            this.isSendingEmail = false;
            if (response && response.success === 'Email sent successfully') {
              this.toastr.success('Email sent successfully!', null, { timeOut: 1000 });
              this.dialogRef.close();
            } else {
              this.toastr.error('Failed to send email');
            }
          },
          error => {
            this.isSendingEmail = false;
            this.toastr.error('Failed to send email');
          }
          
        );
    } catch (error) {
      this.isSendingEmail = false;
      this.toastr.error('Failed to fetch and attach the file');
    }
  }

  closeDialog(): void {
    this.dialogRef.close();
  }


 
}
