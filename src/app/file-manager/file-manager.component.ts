import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { MatToolbarModule } from '@angular/material/toolbar';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { PdfViewerDialogComponent } from '../pdf-viewer-dialog/pdf-viewer-dialog.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgOptimizedImage } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import { DateAdapter, MAT_DATE_FORMATS, MatDateFormats } from '@angular/material/core';
import { debounceTime } from 'rxjs/operators';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { backEndurl } from '../url';

interface PdfFile {
  name: string;
  path?: string; // optional since not used in new flow
  thumbnail: string | SafeResourceUrl;
  fileId: string;
}

interface Publications {
  value: string;
  viewValue: string;
}

interface Editions {
  value: string;
  viewValue: string;
}

const MOMENT_DATE_FORMATS: MatDateFormats = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  selector: 'app-file-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  providers: [
    { provide: MAT_DATE_FORMATS, useValue: MOMENT_DATE_FORMATS },
    { provide: DateAdapter, useClass: MomentDateAdapter }
  ],
  imports: [
    NgOptimizedImage, MatButtonModule, MatInputModule, MatSelectModule, FormsModule, MatProgressBarModule,
    MatIconModule, MatToolbarModule, MatFormFieldModule, MatCardModule,
    MatDatepickerModule, CommonModule, MatTooltipModule
  ],
  templateUrl: './file-manager.component.html',
  styleUrls: ['./file-manager.component.css']
})
export class FileManagerComponent implements OnInit {
backendurl=backEndurl.apiUrl;
  pdfFiles: PdfFile[] = [];
  downloadPdfUrl: string | null = null;
  loadingThumbnails: boolean = false;
folders: any[] = [];
selectedFolderId: string = '';

  EditionSelected: string = "Chennai";
  selectedDate: Date = new Date();
  errorLoadingPdfFiles: boolean = false;
userEmail="";
  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer,
    
    private dateAdapter: DateAdapter<any>,
    private router: Router,
    private cdr: ChangeDetectorRef // Inject ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.dateAdapter.setLocale('en-GB');
    this.loadPdfFiles();
     this.fetchFolders();
  }
fetchFolders(): void {
  this.http.get<any[]>(this.backendurl + '/gdrive-folders').subscribe(
    data => {
   //   console.log("Folders fetched:", data); // 👈 CHECK THIS
      this.folders = data;
      if (data.length > 0) {
        this.loadFilesInFolder(data[0].id);
      }
    },
    error => {
      console.error("Failed to load folders", error);
    }
  );
}

loadPdfFiles(): void {
  this.loadingThumbnails = true;
  this.http.get<any[]>(this.backendurl + '/gdrive-files', { responseType: 'json' }).pipe(
    debounceTime(300)
  ).subscribe(
    data => {
    //  console.log("PDF data received:", data); // 👈 Check what it is
      this.pdfFiles = (data as any[]).map(file => ({
        name: file.name,
        path: '',
        thumbnail: this.sanitizer.bypassSecurityTrustUrl(
          this.backendurl + `/pdf-thumbnail?file_name=${encodeURIComponent(file.name)}`
        ),
        fileId: file.id
      }));
      this.cdr.markForCheck();
      this.loadingThumbnails = false;
    },
    error => {
      console.error("Error loading PDF files:", error); // 👈 Log the error
      this.errorLoadingPdfFiles = true;
      this.cdr.markForCheck();
      this.loadingThumbnails = false;
    }
  );
}



openPdfViewerDialog(pdfFile: PdfFile): void {
  const pdfUrl = `${this.backendurl}/download-pdf?file_id=${pdfFile.fileId}#toolbar=0`;

  this.dialog.open(PdfViewerDialogComponent, {
    height: '90%',
    width: '90%',
    panelClass: 'full-screen-modal',
    data: {
      pdfUrl,
      fileName: pdfFile.name,
    }
  });
}


  
  

  formatDate(date: Date): string {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
  }

loadFilesInFolder(folderId: string): void {
  this.selectedFolderId = folderId;
  this.loadingThumbnails = true;
  this.http.get<any[]>(`${this.backendurl}/gdrive-files?folder_id=${folderId}`).subscribe(
    data => {
      this.pdfFiles = data.map(file => ({
        name: file.name,
        path: '',
        thumbnail: this.sanitizer.bypassSecurityTrustUrl(this.backendurl + `/pdf-thumbnail?file_name=${encodeURIComponent(file.name)}`),
        fileId: file.id
      }));
      this.cdr.markForCheck();
      this.loadingThumbnails = false;
    },
    error => {
      this.errorLoadingPdfFiles = true;
      this.cdr.markForCheck();
      this.loadingThumbnails = false;
    }
  );
}



}
