import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { backEndurl } from '../url';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDialogModule } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-pdf-viewer-dialog',
  standalone: true,
  imports: [
    CommonModule,MatListModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatDialogModule
  ],
  templateUrl: './pdf-viewer-dialog.component.html',
  styleUrls: ['./pdf-viewer-dialog.component.css']
})
export class PdfViewerDialogComponent implements OnInit {
  sanitizedPdfUrl!: SafeResourceUrl;
  loading = true;
  error?: string;

  constructor(
    public dialogRef: MatDialogRef<PdfViewerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { fileId: string; fileName: string },
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.http.get(`${backEndurl}/pdf/${this.data.fileId}`, {
      responseType: 'blob',
      observe: 'response'
    }).subscribe({
      next: res => {
        const blob = res.body!;
        if (!blob || blob.size === 0 || !(res.headers.get('content-type') ?? blob.type).includes('pdf')) {
          this.readAsText(blob).then(t => this.error = t || 'Empty response');
          this.loading = false;
          return;
        }
        const url = URL.createObjectURL(blob);
        this.sanitizedPdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.loading = false;
      },
      error: err => {
        this.error = JSON.stringify(err);
        this.loading = false;
      }
    });
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  private readAsText(blob: Blob): Promise<string> {
    return new Promise(resolve => {
      if (!blob || blob.size === 0) return resolve('');
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.readAsText(blob);
    });
  }
}
