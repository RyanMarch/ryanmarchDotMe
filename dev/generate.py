import os
import re
import json
from datetime import datetime

# 1. Configuration
BASE_URL = "https://ryanmarch.me"
PROJECTS_DATA_PATH = './assets/js/project-data.js'
CONTENT_DIR = './content'
OUTPUT_DIR = './project'
TEMPLATE_PATH = './dev/project-template.html'

def write_if_changed(path, content):
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                existing = f.read()
            if existing == content:
                return
        except Exception:
            pass
            
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def get_projects():
    if not os.path.exists(PROJECTS_DATA_PATH):
        print(f"❌ Error: {PROJECTS_DATA_PATH} not found. Are you in the root directory?")
        return []

    with open(PROJECTS_DATA_PATH, 'r') as f:
        content = f.read()
    
    match = re.search(r'const myProjects = (\[[\s\S]*?\]);', content)
    if not match:
        print("❌ Error: Could not find projects array in project-data.js")
        return []
    
    js_data = match.group(1)
    
    # Clean JS representation to make it a valid Python literal
    # Strip comments safely (ignoring protocol double-slashes in URLs like https://)
    js_data = re.sub(r'(?<!:)//.*$', '', js_data, flags=re.MULTILINE)
    # Quote unquoted keys (e.g. key: -> "key":)
    py_data = re.sub(r'(\s)(\w+):', r'\1"\2":', js_data)
    # Remove trailing commas inside objects/arrays for JSON compliance (just in case, though AST is fine with them)
    py_data = re.sub(r',\s*([\]}])', r'\1', py_data)
    # Convert JS values to Python values
    py_data = py_data.replace('true', 'True').replace('false', 'False').replace('null', 'None')
    
    try:
        import ast
        return ast.literal_eval(py_data)
    except Exception as e:
        print(f"❌ Error parsing project data with AST: {e}")
        return []

def generate_seo_files(project_ids):
    print("🛰️ Generating SEO files (sitemap.xml & robots.txt)...")
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Sitemap
    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    # Add home page
    sitemap.append(f'  <url><loc>{BASE_URL}/</loc><lastmod>{today}</lastmod><priority>1.0</priority></url>')
    
    # Add projects
    for p_id in project_ids:
        sitemap.append(f'  <url><loc>{BASE_URL}/project/{p_id}/</loc><lastmod>{today}</lastmod><priority>0.8</priority></url>')
    
    sitemap.append('</urlset>')
    
    write_if_changed('./sitemap.xml', '\n'.join(sitemap))
        
    # Robots.txt
    robots = [
        "User-agent: *",
        "Allow: /",
        "",
        f"Sitemap: {BASE_URL}/sitemap.xml"
    ]
    write_if_changed('./robots.txt', '\n'.join(robots))

def build_tags_html(tags):
    if not tags:
        return ''
    tags_html = []
    for tag in tags:
        label = tag.get('label', '')
        color = tag.get('color', 'gray')
        priority = tag.get('priority', '')
        cls = f' tag-priority-{priority}' if priority else ''
        tags_html.append(f'<span class="tag tag-{color}{cls}">{label}</span>')
    return '\n'.join(tags_html)

def upload_audio_to_r2():
    # 1. Fast Check: Scan local files and compare with cache to see if any uploads are actually needed.
    cache_path = './dev/.r2_cache.json'
    cache = {}
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r') as f:
                cache = json.load(f)
        except Exception:
            pass

    has_changes = False
    for root, dirs, files in os.walk('./content'):
        for file in files:
            if file.endswith('.mp3'):
                local_path = os.path.join(root, file)
                mtime = os.path.getmtime(local_path)
                if local_path not in cache or cache[local_path] != mtime:
                    has_changes = True
                    break
        if has_changes:
            break

    if not has_changes:
        # No audio files are new or changed; exit instantly (takes < 1ms)
        return

    # 2. Audio files changed; proceed with R2 upload credentials & setup
    secrets_path = './dev/.r2_secrets.json'
    if not os.path.exists(secrets_path):
        # Gracefully skip in environments that don't have local secrets (like Cloudflare build)
        return
        
    try:
        with open(secrets_path, 'r') as f:
            secrets = json.load(f)
    except Exception as e:
        print(f"⚠️ R2 Upload: Failed to load local secrets: {e}")
        return
        
    account_id = secrets.get("account_id")
    access_key_id = secrets.get("access_key_id")
    secret_access_key = secrets.get("secret_access_key")
    bucket_name = "ryanmarchdotme-media"
    
    if not all([account_id, access_key_id, secret_access_key]):
        print("⚠️ R2 Upload: Missing credentials in local secrets file.")
        return
        
    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        print("⚠️ R2 Upload: boto3 library not installed locally.")
        print("👉 Please run: python3 -m pip install boto3")
        return
        
    print("🎙️ R2 Upload: Checking and uploading audio files to R2...")
            
    try:
        r2 = boto3.client(
            service_name='s3',
            endpoint_url=f'https://{account_id}.r2.cloudflarestorage.com',
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=Config(
                signature_version='s3v4',
                connect_timeout=1.5,
                read_timeout=1.5,
                retries={'max_attempts': 0}
            )
        )
    except Exception as e:
        print(f"⚠️ R2 Upload: Failed to initialize R2 client: {e}")
        return
        
    uploaded_any = False
    
    for root, dirs, files in os.walk('./content'):
        for file in files:
            if file.endswith('.mp3'):
                local_path = os.path.join(root, file)
                mtime = os.path.getmtime(local_path)
                
                if local_path not in cache or cache[local_path] != mtime:
                    print(f"⬆️ Uploading {file} to R2...")
                    try:
                        r2.upload_file(
                            Filename=local_path,
                            Bucket=bucket_name,
                            Key=file,
                            ExtraArgs={'ContentType': 'audio/mpeg'}
                        )
                        cache[local_path] = mtime
                        uploaded_any = True
                        print(f"✅ Successfully uploaded {file}")
                    except Exception as e:
                        print(f"⚠️ Failed to upload {file}: {e}")
                        
    if uploaded_any:
        try:
            with open(cache_path, 'w') as f:
                json.dump(cache, f)
        except Exception:
            pass

def generate(target_id=None, skip_r2=False):
    if target_id:
        print(f"🚀 Starting Single-Page Build for: {target_id}...")
    else:
        print("🚀 Starting Full Build Process...")
        # Only attempt to upload audio to R2 during full build (runs locally)
        if not skip_r2:
            upload_audio_to_r2()
    
    projects = get_projects()
    if not projects: return

    if not os.path.exists(TEMPLATE_PATH):
        print(f"❌ Error: Template {TEMPLATE_PATH} missing.")
        return

    with open(TEMPLATE_PATH, 'r') as f:
        template = f.read()

    generated_ids = []

    for project in projects:
        if not project.get('hasExtendedContent'):
            continue

        p_id = project['id']
        generated_ids.append(p_id)
        
        if target_id and p_id != target_id:
            continue
        
        project_dir = os.path.join(OUTPUT_DIR, p_id)
        if not os.path.exists(project_dir):
            os.makedirs(project_dir)

        content_path = os.path.join(CONTENT_DIR, f"{p_id}.html")
        project_content = "Coming soon..."
        if os.path.exists(content_path):
            with open(content_path, 'r') as f:
                project_content = f.read()
        else:
            print(f"⚠️ Warning: Content file for {p_id} missing.")

        # Generate Table of Contents from h4 IDs
        headings = re.findall(r'<h4\s+id="([^"]+)"[^>]*>(?:<span>)?(.*?)(?:</span>)?</h4>', project_content)
        nav_html = ''
        if headings:
            links = []
            for h_id, text in headings:
                links.append(f'<a href="#{h_id}">{text}</a>')
            if project.get('actionUrl') or project.get('sourceUrl'):
                links.append('<a href="#modal-footer-actions">Links</a>')
            nav_html = f'<nav class="project-nav"><div class="nav-links">{"".join(links)}</div></nav>'
            
            # Inject nav_html dynamically right after subtitle or description in content
            if 'class="project-description"' in project_content:
                desc_match = re.search(r'(<p class="project-description">.*?</p>)', project_content, re.DOTALL)
                if desc_match:
                    project_content = project_content.replace(desc_match.group(1), desc_match.group(1) + '\n' + nav_html, 1)
            elif 'class="project-subtitle"' in project_content:
                sub_match = re.search(r'(<p class="project-subtitle">.*?</p>)', project_content, re.DOTALL)
                if sub_match:
                    project_content = project_content.replace(sub_match.group(1), sub_match.group(1) + '\n' + nav_html, 1)

        # Generate premium static footer actions
        footer_html = ''
        if project.get('actionUrl') or project.get('sourceUrl'):
            footer_html += '<hr class="modal-footer-divider">\n<div class="modal-footer-actions" id="modal-footer-actions">\n'
            if project.get('sourceUrl'):
                footer_html += f'''    <a href="{project['sourceUrl']}" class="project-btn modal-full-btn btn-secondary" target="_blank" rel="noopener noreferrer">
        <span>View More</span>
        <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2 2v-7h-2v7z"/></svg>
    </a>\n'''
            if project.get('actionUrl'):
                footer_html += f'''    <a href="{project['actionUrl']}" class="project-btn modal-full-btn" target="_blank" rel="noopener noreferrer">
        <span>{project.get('actionText', 'Visit')}</span>
        <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2 2v-7h-2v7z"/></svg>
    </a>\n'''
            footer_html += '    <a href="#top" class="modal-back-to-top-btn">Back to Top</a>\n</div>'
        else:
            footer_html = '<div class="modal-footer-actions"><a href="#top" class="modal-back-to-top-btn">Back to Top</a></div>'

        # Injection
        page_html = template.replace('{{title}}', project.get('title', p_id))
        page_html = page_html.replace('{{subtitle}}', project.get('subtitle', ''))
        page_html = page_html.replace('{{content}}', project_content)
        page_html = page_html.replace('{{tags}}', build_tags_html(project.get('tags', [])))
        page_html = page_html.replace('{{footer}}', footer_html)

        # Automatically rewrite local audio file paths to high-performance R2 URLs
        page_html = re.sub(
            r'(src|href)="(?:\./)?content/[^"]+/audio/([^"]+\.mp3)"',
            r'\1="https://media.ryanmarch.me/\2"',
            page_html
        )

        write_if_changed(os.path.join(project_dir, 'index.html'), page_html)
            
    # SEO Files
    if not target_id:
        generate_seo_files(generated_ids)
        print("✅ Full Build Complete! Your site is ready for search engines.")
    else:
        print(f"✅ Single-Page Build Complete for {target_id}!")

if __name__ == "__main__":
    import sys
    args = sys.argv[1:]
    skip_r2 = False
    if '--skip-r2' in args:
        skip_r2 = True
        args.remove('--skip-r2')
        
    target = args[0] if len(args) > 0 else None
    generate(target, skip_r2)
