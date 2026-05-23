import paramiko, sys, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('8.146.231.216', username='root', password='POIUlkjh123@', timeout=15)

def run(cmd):
    print(f'\n>>> {cmd}')
    _, o, e = ssh.exec_command(cmd, timeout=120)
    out = o.read().decode('utf-8', 'replace')
    err = e.read().decode('utf-8', 'replace')
    code = o.channel.recv_exit_status()
    if out.strip(): print(out[:3000])
    if err.strip(): print(f'STDERR: {err[:1500]}')
    print(f'EXIT: {code}')
    return code, out

run('cd /opt/labelhub-a && git pull')
run('cd /opt/labelhub-a/deploy && docker compose -p labelhub_a stop grafana')
run('docker volume rm labelhub_a_grafana-data 2>/dev/null; echo volume_cleared')
run('cd /opt/labelhub-a/deploy && docker compose -p labelhub_a up -d grafana')

time.sleep(12)

# Verify datasource UID
run('curl -s -u admin:labelhub http://127.0.0.1:3001/grafana/api/datasources')

# Check Prometheus has data
run('curl -s "http://127.0.0.1:9090/api/v1/query?query=up" | head -c 300')
run('curl -s "http://127.0.0.1:9090/api/v1/query?query=agent_invocations_total" | head -c 500')

# Trigger a sample-gen call to create fresh metrics
run('curl -s -X POST http://127.0.0.1:8080/agents/generate-sample-data -H "Content-Type: application/json" -d \'{"taskName":"test","instruction":"test"}\' | head -c 100')

time.sleep(3)
run('curl -s "http://127.0.0.1:9090/api/v1/query?query=agent_invocations_total" | head -c 500')

ssh.close()
print('\nDONE')
