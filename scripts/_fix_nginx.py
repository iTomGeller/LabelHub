import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('8.146.231.216', username='root', password='POIUlkjh123@', timeout=15)

def run(cmd):
    print(f'>>> {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=120)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-3000:] if len(out) > 3000 else out)
    if err.strip():
        print(f'STDERR: {err[-2000:] if len(err) > 2000 else err}')
    print(f'EXIT: {code}\n')
    return code

# Step 1: Check which config file is active and if /agent-api/ already exists
run('cat /etc/nginx/sites-available/labelhub-a')
run('grep -c "agent-api" /etc/nginx/sites-available/labelhub-a || echo "NOT_FOUND"')

# Step 2: Add /agent-api/ if not present
run("""
if ! grep -q "agent-api" /etc/nginx/sites-available/labelhub-a; then
  sed -i '/location \\/api\\//i\\    location /agent-api/ {\\n        proxy_pass http://127.0.0.1:8080/;\\n        proxy_set_header Host $host;\\n        proxy_set_header X-Real-IP $remote_addr;\\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\\n        proxy_set_header X-Forwarded-Proto $scheme;\\n        proxy_read_timeout 60s;\\n        proxy_connect_timeout 10s;\\n    }\\n' /etc/nginx/sites-available/labelhub-a
  echo "ADDED"
else
  echo "ALREADY_EXISTS"
fi
""")

# Step 3: Verify config and reload
run('nginx -t && systemctl reload nginx')

# Step 4: Test from host
run('curl -s http://127.0.0.1/agent-api/agents/health')
run('curl -s http://127.0.0.1/agent-api/agents/overview | head -c 200')

# Step 5: Test from INSIDE web container to confirm the rewrite issue
run('docker exec labelhub_a-web-1 wget -qO- http://localhost:8080/agents/health 2>&1 || echo "FAILS_INSIDE_CONTAINER"')

ssh.close()
print('DONE')
