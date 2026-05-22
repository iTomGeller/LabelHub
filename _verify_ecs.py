import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('8.146.231.216', username='root', password='REDACTED_USE_ENV_VAR')

cmds = [
    'curl -s http://localhost:8000/health',
    'curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/',
    'curl -s http://localhost:3000/agent-api/health',
    'docker logs labelhub_a-agent-runtime-1 --tail 5 2>&1',
]

for cmd in cmds:
    print(f'>>> {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=15)
    ec = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out: print(out[:500])
    if err: print('err:', err[:300])
    print(f'exit: {ec}\n')

ssh.close()
print('Done.')
