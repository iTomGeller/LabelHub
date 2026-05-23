"""Quick redeploy script for LabelHub A module on ECS."""
import os
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = os.environ.get('ECS_HOST', '8.146.231.216')
USER = os.environ.get('ECS_USER', 'root')
PASSWORD = os.environ.get('ECS_PASSWORD', '')

if not PASSWORD:
    print("ERROR: ECS_PASSWORD environment variable is required.")
    print("Usage: ECS_PASSWORD=xxx python scripts/redeploy.py")
    sys.exit(1)


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD)

    commands = [
        ('git pull', 'cd /opt/labelhub-a && git pull origin feature/member-a-task-config'),
        ('rebuild api', 'cd /opt/labelhub-a/deploy && docker compose -p labelhub_a up -d --build api 2>&1 | tail -10'),
        ('rebuild web', 'cd /opt/labelhub-a/deploy && docker compose -p labelhub_a up -d --build web 2>&1 | tail -10'),
        ('health: api', 'sleep 5 && curl -s http://localhost:8080/api/tasks/health'),
        ('health: web', 'curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/'),
        ('health: deepseek', 'curl -s http://localhost:8080/agents/health'),
    ]

    for label, cmd in commands:
        print(f'\n=== {label} ===')
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=600)
        ec = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        if out:
            print(out[:2000])
        if err:
            print(err[:1000])
        if ec != 0:
            print(f'[WARN] exit code: {ec}')

    ssh.close()
    print('\n=== DONE ===')


if __name__ == '__main__':
    main()
