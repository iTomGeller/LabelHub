import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('8.146.231.216', username='root', password='REDACTED_USE_ENV_VAR')

commands = [
    ('git pull', 'cd /opt/labelhub-a && git pull origin feature/member-a-task-config'),
    ('rebuild agent', 'cd /opt/labelhub-a/deploy && export COMPOSE_ANSI=never && docker compose -p labelhub_a up -d --build agent-runtime 2>&1 | tail -5'),
    ('rebuild web', 'cd /opt/labelhub-a/deploy && export COMPOSE_ANSI=never && docker compose -p labelhub_a up -d --build web 2>&1 | tail -10'),
]

for label, cmd in commands:
    print(f"\n=== {label} ===")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=600)
    ec = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    print(out[-2000:] if out else "")
    if err:
        print("ERR:", err[-1000:])
    print(f"exit: {ec}")

ssh.close()
print("\nDone.")
