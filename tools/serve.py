"""Local test server for UNFOLD: serves ../app at http://127.0.0.1:8771 and writes POST /save?name=... into ./out/."""
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "app")
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def do_POST(self):
        u = urlparse(self.path)
        if u.path != "/save":
            self.send_error(404)
            return
        name = os.path.basename(parse_qs(u.query).get("name", ["out.bin"])[0])
        n = int(self.headers.get("Content-Length", 0))
        with open(os.path.join(OUT, name), "wb") as f:
            remaining = n
            while remaining:
                chunk = self.rfile.read(min(1 << 20, remaining))
                if not chunk:
                    break
                f.write(chunk)
                remaining -= len(chunk)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")


ThreadingHTTPServer(("127.0.0.1", 8771), H).serve_forever()
