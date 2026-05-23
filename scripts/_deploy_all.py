import paramiko, sys, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('8.146.231.216', username='root', password='POIUlkjh123@', timeout=15)

def run(cmd, timeout=180):
    print(f'\n>>> {cmd}')
    _, o, e = ssh.exec_command(cmd, timeout=timeout)
    out = o.read().decode('utf-8', 'replace')
    err = e.read().decode('utf-8', 'replace')
    code = o.channel.recv_exit_status()
    if out.strip(): print(out[:4000])
    if err.strip(): print(f'STDERR: {err[:2000]}')
    print(f'EXIT: {code}')
    return code, out

# 1. Pull
print("=" * 40, "PULL")
run('cd /opt/labelhub-a && git pull')

# 2. Rebuild API + Web
print("=" * 40, "BUILD")
run('cd /opt/labelhub-a/deploy && export COMPOSE_ANSI=never && export BUILDKIT_PROGRESS=plain && docker compose -p labelhub_a up -d --build api web 2>&1 | tail -15', timeout=300)

# 3. Restart Grafana (fresh provisioning with uid)
print("=" * 40, "GRAFANA")
run('cd /opt/labelhub-a/deploy && docker compose -p labelhub_a stop grafana')
run('docker volume rm labelhub_a_grafana-data 2>/dev/null; echo ok')
run('cd /opt/labelhub-a/deploy && docker compose -p labelhub_a up -d grafana')

# 4. Wait
print("=" * 40, "WAIT")
time.sleep(20)

# 5. Verify
print("=" * 40, "VERIFY")
for i in range(8):
    code, out = run('curl -s http://127.0.0.1:8080/agents/health')
    if 'ok' in out:
        print("API OK")
        break
    time.sleep(5)

run('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/')

# 6. Verify Grafana datasource UID
run('curl -s -u admin:labelhub http://127.0.0.1:3001/grafana/api/datasources')

# 7. Test generate-sample-data with count
print("=" * 40, "TEST SAMPLE GEN")
run('curl -s -X POST http://8.146.231.216/agent-api/agents/generate-sample-data -H "Content-Type: application/json" -d \'{"taskName":"NER实体抽取","instruction":"从电商评论中抽取产品名、品牌、属性实体","count":3}\' | head -c 400')

# 8. Check metrics after call
time.sleep(3)
run('curl -s http://127.0.0.1:8080/actuator/prometheus | grep agent_invocations | head -8')

# 9. Verify Grafana can query
run('curl -s -u admin:labelhub "http://127.0.0.1:3001/grafana/api/ds/query" -H "Content-Type: application/json" -d \'{"queries":[{"refId":"A","datasource":{"type":"prometheus","uid":"prometheus"},"expr":"agent_invocations_total"}],"from":"now-1h","to":"now"}\' | head -c 300')

ssh.close()
print("\n" + "=" * 40, "ALL DONE")
