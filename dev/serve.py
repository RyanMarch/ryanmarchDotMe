import http.server
import socketserver
import urllib.parse
import os
import sys
import time
import socket
import threading
import webbrowser

PORT = 8000
SITE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
os.chdir(SITE_DIR)

# Site-relative path -> on-disk path for the one admin-editable file that lives outside public/
def disk_path(p):
    return '../config/redirects.json' if p == 'redirects.json' else p

# Keep track of file modifications
last_modified_time = 0

def get_last_modified():
    max_mtime = 0
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'node_modules']
        for file in files:
            if file.endswith(('.html', '.css', '.js', '.json')):
                try:
                    mtime = os.path.getmtime(os.path.join(root, file))
                    if mtime > max_mtime:
                        max_mtime = mtime
                except OSError:
                    pass
    return max_mtime

# Initialize last modified time and dev version for cache busting
last_modified_time = get_last_modified()
dev_version = str(int(time.time() * 1000))

# A list of active SSE clients
clients = []
clients_lock = threading.Lock()

def check_for_changes():
    global last_modified_time, dev_version
    while True:
        time.sleep(0.5)
        current_mtime = get_last_modified()
        if current_mtime > last_modified_time:
            # Wait a tiny moment for write to finish completely
            time.sleep(0.1)
            last_modified_time = get_last_modified()
            dev_version = str(int(time.time() * 1000))
            print(f"🔄 Changes detected! New dev version: {dev_version}. Reloading browser clients...")
            with clients_lock:
                for client in clients:
                    try:
                        client.write(b"data: reload\n\n")
                        client.flush()
                    except Exception:
                        pass
                clients.clear()

class SPA_RequestHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def handle(self):
        try:
            super().handle()
        except (ConnectionResetError, BrokenPipeError):
            pass

    def do_GET(self):
        self.handle_request(is_head=False)

    def do_HEAD(self):
        self.handle_request(is_head=True)

    def do_POST(self):
        url_parts = urllib.parse.urlparse(self.path)
        path = url_parts.path
        
        if path == '/api/admin/file':
            # Local API endpoint: write file directly to disk
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            import json
            import base64
            
            try:
                body = json.loads(post_data.decode('utf-8'))
                query_params = urllib.parse.parse_qs(url_parts.query)
                file_path = query_params.get('path', [None])[0]
                if not file_path and 'path' in body:
                    file_path = body['path']
                    
                if not file_path:
                    self.send_error(400, "Missing path")
                    return
                
                # Restrict path to make sure it's valid
                is_allowed = (
                    file_path.startswith('content/') or 
                    file_path == 'index.html' or 
                    file_path == 'assets/js/project-data.js' or
                    file_path == 'sitemap.xml' or
                    file_path == 'redirects.json'
                )
                if not is_allowed:
                    self.send_error(403, "Forbidden path")
                    return
                
                # Write file directly to local filesystem
                # The content is base64 encoded
                file_content_b64 = body.get('content', '')
                file_content = base64.b64decode(file_content_b64)
                
                # Make sure directory exists
                file_path = disk_path(file_path)
                dir_name = os.path.dirname(file_path)
                if dir_name and not os.path.exists(dir_name):
                    os.makedirs(dir_name)
                    
                with open(file_path, 'wb') as f:
                    f.write(file_content)
                
                # Success response
                response_data = json.dumps({'success': True, 'sha': 'local-dev-mock-sha'}).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(response_data)))
                self.end_headers()
                # Local dev can return a mock sha since we don't care about git SHAs locally
                self.wfile.write(response_data)
                print(f"💾 Local Admin Edit: Saved file '{file_path}' to local disk.")
            except Exception as e:
                self.send_error(500, f"Local Server Error: {e}")
            return
            
        # Default fallback
        self.send_error(404, "Not Found")

    def handle_request(self, is_head):
        url_parts = urllib.parse.urlparse(self.path)
        path = url_parts.path

        # Handle local /api/admin/file GET request
        if path == '/api/admin/file':
            query_params = urllib.parse.parse_qs(url_parts.query)
            file_path = query_params.get('path', [None])[0]
            if not file_path:
                self.send_error(400, "Missing path")
                return
            
            # Read from filesystem directly
            file_path = disk_path(file_path)
            if os.path.exists(file_path):
                import base64
                import json
                with open(file_path, 'rb') as f:
                    raw_data = f.read()
                b64_content = base64.b64encode(raw_data).decode('utf-8')
                
                response_data = json.dumps({
                    'content': b64_content,
                    'sha': 'local-dev-mock-sha'
                }).encode('utf-8')
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(response_data)))
                self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
                self.end_headers()
                self.wfile.write(response_data)
            else:
                self.send_error(404, "File Not Found")
            return

        # 1. Handle live-reload SSE endpoint
        if path == '/live-reload':
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Connection', 'keep-alive')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            if is_head:
                return
            
            # Keep the request alive by adding to client list
            with clients_lock:
                clients.append(self.wfile)
            
            # Keep connection open until client disconnects
            try:
                while True:
                    time.sleep(10)
                    with clients_lock:
                        if self.wfile not in clients:
                            break
                        # Send ping
                        self.wfile.write(b": ping\n\n")
                        self.wfile.flush()
            except Exception:
                pass
            finally:
                with clients_lock:
                    if self.wfile in clients:
                        clients.remove(self.wfile)
            return

        # 2. Map path to physical file
        # Remove leading slash and decode URL-encoded paths
        decoded_path = urllib.parse.unquote(path.lstrip('/'))
        
        # If it's a directory or empty, default to index.html
        if not decoded_path or os.path.isdir(decoded_path):
            file_to_serve = os.path.join(decoded_path, 'index.html')
        else:
            file_to_serve = decoded_path

        # SPA routing: if file doesn't exist and has no extension, fallback to root index.html
        _, ext = os.path.splitext(file_to_serve)
        if not os.path.exists(file_to_serve) and not ext:
            file_to_serve = 'index.html'

        # If file still doesn't exist, serve 404
        if not os.path.exists(file_to_serve):
            if os.path.exists('404.html'):
                self.send_response(404)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
                if is_head:
                    self.end_headers()
                    return
                with open('404.html', 'rb') as f:
                    content = f.read()
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_error(404, "File Not Found")
            return

        # Serve the file
        ctype = self.guess_type(file_to_serve)
        
        # Check if we should inject live-reload script into HTML (skip for admin.html to preserve workspace state)
        if ctype == 'text/html' and os.path.basename(file_to_serve) != 'admin.html':
            try:
                with open(file_to_serve, 'r', encoding='utf-8', errors='ignore') as f:
                    html_content = f.read()
                
                # Replace ?v=1 with dynamic dev version to bypass browser module loader cache
                html_content = html_content.replace('?v=1', f'?v={dev_version}')
                
                # Inject live reload script before </body>
                lr_script = """
                <script>
                (function() {
                    const evtSource = new EventSource('/live-reload');
                    evtSource.onmessage = function(e) {
                        if (e.data === 'reload') {
                            console.log('🔄 Live reload triggered.');
                            try {
                                sessionStorage.setItem('live_reload_scroll_x', window.scrollX);
                                sessionStorage.setItem('live_reload_scroll_y', window.scrollY);
                            } catch (err) {}
                            window.location.reload();
                        }
                    };
                    evtSource.onerror = function() {
                        try {
                            sessionStorage.setItem('live_reload_scroll_x', window.scrollX);
                            sessionStorage.setItem('live_reload_scroll_y', window.scrollY);
                        } catch (err) {}
                        // Attempt reconnect after delay
                        setTimeout(() => window.location.reload(), 2000);
                    };
                })();
                </script>
                """
                if '</body>' in html_content:
                    html_content = html_content.replace('</body>', lr_script + '</body>')
                else:
                    html_content += lr_script
                
                response_bytes = html_content.encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(response_bytes)))
                # Disable caching for HTML so changes are always loaded fresh
                self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
                self.end_headers()
                if not is_head:
                    self.wfile.write(response_bytes)
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f"Server Error injecting live reload: {e}".encode())
            return

        # Serve static assets (CSS, JS, images, etc.)
        try:
            # Check if it's JS to dynamically replace version cache buster
            if ctype in ('application/javascript', 'text/javascript') or file_to_serve.endswith('.js'):
                with open(file_to_serve, 'r', encoding='utf-8', errors='ignore') as f:
                    js_content = f.read()
                js_content = js_content.replace('?v=1', f'?v={dev_version}')
                content = js_content.encode('utf-8')
            else:
                with open(file_to_serve, 'rb') as f:
                    content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(content)))
            # Force no-cache locally during development so saved changes display immediately
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.end_headers()
            if not is_head:
                self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server Error: {e}".encode())

class ThreadingTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        # Ignore common client disconnections to keep console clean
        exc_type, exc_value, _ = sys.exc_info()
        if exc_type in (ConnectionResetError, BrokenPipeError):
            return
        super().handle_error(request, client_address)

if __name__ == '__main__':
    # Start file watcher thread
    watcher_thread = threading.Thread(target=check_for_changes, daemon=True)
    watcher_thread.start()
    
    # Try starting the server
    try:
        with ThreadingTCPServer(("", PORT), SPA_RequestHandler) as httpd:
            print(f"🚀 Serving SPA locally with live-reload at http://127.0.0.1:{PORT}")
            # Try to automatically open browser on startup
            try:
                webbrowser.open(f"http://127.0.0.1:{PORT}")
            except Exception:
                pass
            httpd.serve_forever()
    except Exception as e:
        print(f"❌ Server failed to start: {e}", file=sys.stderr)
        sys.exit(1)
