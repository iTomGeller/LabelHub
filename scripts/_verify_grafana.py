import paramiko, sys, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('8.146.231.216', username='root', password='POIUlkjh123@', timeout=15)

def run(cmd):
    print(f'\n>>> {cmd}')
    _, o, e = ssh.exec_command(cmd, timeout=60)
    out = o.read().decode('utf-8', 'replace')
    err = e.read().decode('utf-8', 'replace')
    code = o.channel.recv_exit_status()
    if out.strip(): print(out[:5000])
    if err.strip(): print(f'STDERR: {err[:2000]}')
    print(f'EXIT: {code}')
    return code, out

# Get the last lines of logs including the crash reason
run('docker logs labelhub_a-grafana-1 2>&1 | tail -50')

# Check the provisioning file on the server
run('cat /opt/labelhub-a/deploy/grafana/provisioning/datasources/prometheus.yml')

# Try running grafana with more output
run('cd /opt/labelhub-a/deploy && docker compose -p labelhub_a rm -f grafana')
run('cd /opt/labelhub-a/deploy && docker compose -p labelhub_a up -d grafana 2>&1')
time.sleep(20)
run('docker logs labelhub_a-grafana-1 2>&1 | grep -i "error\\|fatal\\|panic\\|fail" | tail -20')
run('docker ps --filter "name=labelhub_a-grafana" --format "{{.Names}} {{.Status}}"')

# If still failing, check if it's the provisioning yaml format
run('docker exec labelhub_a-grafana-1 cat /etc/grafana/provisioning/datasources/prometheus.yml 2>&1')

ssh.close()
print('\nDONE')
