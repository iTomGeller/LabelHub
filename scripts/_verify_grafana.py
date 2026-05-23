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
    if out.strip(): print(out[:3000])
    if err.strip(): print(f'STDERR: {err[:1000]}')
    print(f'EXIT: {code}')
    return code, out

# Check dashboards loaded
run('curl -s -u admin:labelhub http://127.0.0.1:3001/grafana/api/search?type=dash-db')

# Query via datasource to verify data is visible
run('curl -s -u admin:labelhub "http://127.0.0.1:3001/grafana/api/ds/query" -H "Content-Type: application/json" -d \'{"queries":[{"refId":"A","datasource":{"type":"prometheus","uid":"prometheus"},"expr":"agent_invocations_total","instant":true}],"from":"now-1h","to":"now"}\'')

# Public access test
run('curl -s -o /dev/null -w "%{http_code}" http://8.146.231.216/grafana/api/health')

ssh.close()
print('\nDONE')
