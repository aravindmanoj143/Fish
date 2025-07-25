import os
import threading
import sys
from datetime import datetime
from flask_cors import CORS
import psycopg2
import psycopg2.extras
from psycopg2 import sql
import subprocess
import urllib.parse
import smtplib
from flask_mail import Mail, Message
from flask import Flask, request, jsonify, send_file
import shlex 
from googleapiclient.discovery import build
from google.oauth2 import service_account
from googleapiclient.http import MediaIoBaseDownload  
import io

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": [
    "http://10.100.6.133:4400",
    "http://10.100.1.249:4400",
    "http://localhost:4400",
    "http://10.100.6.133:4200",
    "http://localhost:4200"
]}})

progress = {}
completion_flag = False
THUMBNAIL_CACHE_PATH = './thumbnails'
thumbnail_cache_path = os.getenv('THUMBNAIL_CACHE_PATH', './thumbnails')

# Google Drive service account setup
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
SERVICE_ACCOUNT_FILE = 'service_account.json'

credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
drive_service = build('drive', 'v3', credentials=credentials)

if not os.path.exists(thumbnail_cache_path):
    os.makedirs(thumbnail_cache_path)


@app.route('/download-pdf', methods=['GET'])
def download_pdf_file():
    file_id = request.args.get('file_id')
    if not file_id:
        return jsonify({"error": "file_id is required"}), 400
    try:
        file = drive_service.files().get(fileId=file_id, fields='name').execute()
        file_name = file['name']
        request_dl = drive_service.files().get_media(fileId=file_id)
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request_dl)
        done = False
        while not done:
            status, done = downloader.next_chunk()
        buffer.seek(0)
        return send_file(buffer, mimetype='application/pdf', as_attachment=False, download_name=file_name)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

POPPLER_PATH = r'C:\\poppler-24.02.0\\Library\\bin'

# Utility functions
def get_db_connection():
    return psycopg2.connect(**db_config)

def list_folders():
    query = "mimeType='application/vnd.google-apps.folder' and trashed=false"
    results = drive_service.files().list(
        q=query,
        fields="files(id, name)",
        pageSize=100
    ).execute()
    return results.get('files', [])

def list_files():
    query = "mimeType='application/pdf' and trashed=false"
    results = drive_service.files().list(
        q=query,
        fields="files(id, name, parents)",
        pageSize=1000
    ).execute()
    return results.get('files', [])



@app.route('/pdf', methods=['GET'])
def get_pdf():
    path = request.args.get('path')
    download = request.args.get('download')
    if not path:
        return 'Path parameter is required', 400
    try:
        return send_file(path, as_attachment=(download == 'true'))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def generate_pdf_thumbnail(pdf_path):
    if not os.path.exists(THUMBNAIL_CACHE_PATH):
        os.makedirs(THUMBNAIL_CACHE_PATH)
    thumbnail_filename = os.path.join(THUMBNAIL_CACHE_PATH, os.path.basename(pdf_path) + '.png')
    if os.path.exists(thumbnail_filename):
        return thumbnail_filename
    try:
        result = subprocess.run([
            os.path.join(POPPLER_PATH, 'pdftoppm'),
            '-png', '-singlefile', pdf_path, thumbnail_filename.replace('.png', '')
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return thumbnail_filename
    except subprocess.CalledProcessError as e:
        print(f"Error generating thumbnail: {e}")
        return None

@app.route('/pdf-thumbnail', methods=['GET'])
def get_pdf_thumbnail():
    file_name = request.args.get('file_name')
    if not file_name:
        return 'File name is required', 400
    thumbnail_path = os.path.join(THUMBNAIL_CACHE_PATH, file_name + '.png')
    if os.path.exists(thumbnail_path):
        return send_file(thumbnail_path, mimetype='image/png')
    else:
        return jsonify({'error': 'Thumbnail not found'}), 404

@app.route('/generate-thumbnails', methods=['POST'])
def generate_thumbnails():
    data = request.get_json()
    pdf_paths = data.get('pdf_paths')
    if not pdf_paths:
        return jsonify({"error": "PDF paths are required"}), 400
    try:
        for pdf_path in pdf_paths:
            generate_pdf_thumbnail(pdf_path)
        return jsonify({"message": "Thumbnail generation complete", "total_pdfs": len(pdf_paths)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500




@app.route("/gdrive-folders", methods=["GET"])
def list_gdrive_folders():
    try:
        query = "mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = drive_service.files().list(
            q=query,
            fields="files(id, name)",
            pageSize=100,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True
        ).execute()
        
        folders = results.get("files", [])
        return jsonify(folders)  # <== send just the list of folders
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route("/gdrive-files", methods=["GET"])
def list_gdrive_files():
    try:
        folder_id = request.args.get("folder_id")
        if folder_id:
            query = f"'{folder_id}' in parents and mimeType='application/pdf' and trashed=false"
        else:
            query = "mimeType='application/pdf' and trashed=false"

        results = drive_service.files().list(
            q=query,
            fields="files(id, name, mimeType, parents)",
            pageSize=100,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True
        ).execute()

        files = results.get("files", [])
        return jsonify(files)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def download_drive_pdf(file_id: str) -> tuple[io.BytesIO, str]:
    """
    Downloads a PDF from Google Drive into a BytesIO buffer and returns (buffer, filename).
    Raises if the file doesn't exist or isn't accessible.
    """
    # get the name (optional, but nice for Content-Disposition)
    meta = drive.files().get(fileId=file_id, fields="name, mimeType").execute()
    if meta.get("mimeType") != "application/pdf":
        # You can remove this guard if you also want to preview non-pdf (Drive can convert)
        raise ValueError("File is not a PDF")

    file_name = meta["name"]
    req = drive.files().get_media(fileId=file_id)

    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, req)

    done = False
    while not done:
        status, done = downloader.next_chunk()

    buf.seek(0)
    return buf, file_name

@app.route("/pdf/<file_id>", methods=["GET", "HEAD"])
def serve_pdf(file_id: str):
    try:
        buf, fname = download_drive_pdf(file_id)

        # Werkzeug will respect Range requests when conditional=True
        resp = send_file(
            buf,
            mimetype="application/pdf",
            as_attachment=False,
            download_name=fname,
            conditional=True,  # enables range / partial content
            max_age=0          # prevent caching while you debug
        )

        # make sure it renders inline
        resp.headers["Content-Disposition"] = f'inline; filename="{fname}"'
        resp.headers["Accept-Ranges"] = "bytes"
        return resp

    except HttpError as e:
        # Google API error (permissions, not found, etc.)
        return jsonify({"error": e._get_reason()}), e.resp.status if hasattr(e, "resp") else 500
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500    

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=3010)