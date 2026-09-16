#!/usr/bin/env python3
"""
ICKT 2027 ローカルプレビューサーバー
Markdown + Jekyll レイアウトをエミュレートして http://localhost:8000 で表示します
"""
import http.server
import socketserver
import os
import re
import markdown as md_lib

PORT = 8001
SITE_DIR = os.path.dirname(os.path.abspath(__file__))

def render_markdown(text):
    """Front Matter を除去して Markdown → HTML"""
    # Front Matter 除去
    text = re.sub(r'^---\n.*?---\n', '', text, flags=re.DOTALL)
    # Kramdown インライン ID記法: ## 見出し {#id} → <h2 id="id">見出し</h2>
    def replace_heading_id(m):
        hashes = m.group(1)        # '##' など
        title  = m.group(2).strip()# 見出しテキスト
        hid    = m.group(3)        # id値
        level  = len(hashes)
        return f'<h{level} id="{hid}">{title}</h{level}>'
    text = re.sub(r'^(#{1,6})\s+(.+?)\s+\{#(\w+)\}\s*$', replace_heading_id,
                  text, flags=re.MULTILINE)
    # 旧形式 {: #id} も除去（残存対策）
    text = re.sub(r'^\{:\s*#\w+\s*\}\s*$', '', text, flags=re.MULTILINE)
    return md_lib.markdown(text, extensions=['extra', 'toc', 'tables'])


def load_layout():
    layout_path = os.path.join(SITE_DIR, '_layouts', 'default.html')
    with open(layout_path, encoding='utf-8') as f:
        return f.read()

def build_page(md_path):
    with open(md_path, encoding='utf-8') as f:
        raw = f.read()
    content_html = render_markdown(raw)
    layout = load_layout()

    # Liquid タグを置換
    html = layout.replace('{{ content }}', content_html)
    html = re.sub(r'\{%.*?%\}', '', html)  # {% %} タグ除去
    html = html.replace('{{ site.title }}', 'ICKT 2027')
    html = html.replace('{{ site.description }}', 'The 3rd Symposium on Information, Communication, and Knowledge Technologies')
    html = re.sub(r'\{\{.*?\}\}', '', html)  # 残りの {{ }} 除去
    return html

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0]
        # index.md → レンダリング
        if path in ('/', '/index.html', ''):
            md_path = os.path.join(SITE_DIR, 'index.md')
            html = build_page(md_path)
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(html.encode('utf-8'))
        else:
            # 静的ファイル（CSS, 画像等）
            super().do_GET()

    def log_message(self, format, *args):
        print(f"  {self.address_string()} - {format % args}")

os.chdir(SITE_DIR)
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
print()
print(f"  [START] ICKT 2027 Preview Server")
print(f"  URL  -> http://localhost:{PORT}")
print(f"  Stop -> Ctrl+C")
print()

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
