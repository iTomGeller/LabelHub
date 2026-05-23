import paramiko
import sys
import time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('8.146.231.216', username='root', password='POIUlkjh123@', timeout=15)

def run(cmd, timeout=180):
    print(f'\n>>> {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-4000:] if len(out) > 4000 else out)
    if err.strip():
        print(f'STDERR: {err[-2000:] if len(err) > 2000 else err}')
    print(f'EXIT: {code}')
    return code, out

# 1. Pull latest code
print("=" * 50)
print("STEP 1: Pull latest code")
print("=" * 50)
run('cd /opt/labelhub-a && git pull')

# 2. Stop old containers
print("\n" + "=" * 50)
print("STEP 2: Stop & remove old containers")
print("=" * 50)
run('cd /opt/labelhub-a/deploy && docker compose -p labelhub_a stop api web')
run('cd /opt/labelhub-a/deploy && docker compose -p labelhub_a rm -f api web')

# 3. Rebuild and start
print("\n" + "=" * 50)
print("STEP 3: Rebuild & start api and web")
print("=" * 50)
run('cd /opt/labelhub-a/deploy && export COMPOSE_ANSI=never && export BUILDKIT_PROGRESS=plain && docker compose -p labelhub_a up -d --build api web 2>&1 | tail -30', timeout=300)

# 4. Wait for containers to be ready
print("\n" + "=" * 50)
print("STEP 4: Wait for services to start")
print("=" * 50)
time.sleep(15)

# 5. Verify containers running
run('docker ps --filter "name=labelhub_a" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"')

# 6. Verify API health
print("\n" + "=" * 50)
print("STEP 5: Verify endpoints")
print("=" * 50)
run('curl -s http://127.0.0.1:8080/agents/health')
run('curl -s http://127.0.0.1/agent-api/agents/health')
run('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/')

# 7. Test the new generate-sample-data endpoint
print("\n" + "=" * 50)
print("STEP 6: Test generate-sample-data endpoint")
print("=" * 50)
run("""curl -s -X POST http://127.0.0.1/agent-api/agents/generate-sample-data -H 'Content-Type: application/json' -d '{"taskName":"电商评论情感分类","instruction":"根据电商平台用户评论判断情感倾向"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Message: {d.get(chr(109)+chr(101)+chr(115)+chr(115)+chr(97)+chr(103)+chr(101),chr(78)+chr(47)+chr(65))}'); print(f'Sample count: {len(d.get(chr(115)+chr(97)+chr(109)+chr(112)+chr(108)+chr(101)+chr(68)+chr(97)+chr(116)+chr(97),[]))}')" """)

# 8. Verify Nginx routing for the new endpoint works publicly
print("\n" + "=" * 50)
print("STEP 7: Verify public access")
print("=" * 50)
run('curl -s http://8.146.231.216/agent-api/agents/health')
run('curl -s -o /dev/null -w "%{http_code}" http://8.146.231.216/')

# 9. Check Prometheus has metrics
run('curl -s http://127.0.0.1:8080/actuator/prometheus | grep agent_invocations | head -5')

ssh.close()
print("\n" + "=" * 50)
print("DEPLOYMENT COMPLETE")
print("=" * 50)
