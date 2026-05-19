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
    
    with open('./sitemap.xml', 'w') as f:
        f.write('\n'.join(sitemap))
        
    # Robots.txt
    robots = [
        "User-agent: *",
        "Allow: /",
        "",
        f"Sitemap: {BASE_URL}/sitemap.xml"
    ]
    with open('./robots.txt', 'w') as f:
        f.write('\n'.join(robots))

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

def generate():
    print("🚀 Starting Build Process...")
    
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
            footer_html += '    <a href="/" class="modal-back-to-top-btn">Back to Home</a>\n</div>'
        else:
            footer_html = '<div class="modal-footer-actions"><a href="/" class="modal-back-to-top-btn">Back to Home</a></div>'

        # Injection
        page_html = template.replace('{{title}}', project.get('title', p_id))
        page_html = page_html.replace('{{subtitle}}', project.get('subtitle', ''))
        page_html = page_html.replace('{{content}}', project_content)
        page_html = page_html.replace('{{tags}}', build_tags_html(project.get('tags', [])))
        page_html = page_html.replace('{{footer}}', footer_html)

        with open(os.path.join(project_dir, 'index.html'), 'w') as f:
            f.write(page_html)
            
    # SEO Files
    generate_seo_files(generated_ids)

    print("✅ Build Complete! Your site is ready for search engines.")

if __name__ == "__main__":
    generate()
